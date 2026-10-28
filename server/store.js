'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateUsername, validatePassword, hashPassword, newVersion, validateAccount } = require('./passwords');

class StoreError extends Error {}

function initialSettings(env) {
    const username = env.AZZAM_INITIAL_ADMIN_USERNAME || 'admin';
    if (!validateUsername(username)) throw new StoreError('Invalid initial admin username');
    return { username, password: env.AZZAM_INITIAL_ADMIN_PASSWORD };
}

async function makeAccount(username, password) {
    if (!validateUsername(username) || !validatePassword(password, username)) {
        throw new StoreError('Initial credentials do not meet the requirements');
    }
    const passwordHash = await hashPassword(password);
    return { username, ...passwordHash, version: newVersion(), mustChange: true };
}

class FileStore {
    // A file-backed account and in-memory sessions are intended for ONE Node process.
    constructor(directory, env = process.env) {
        this.directory = path.resolve(directory);
        this.env = env;
        this.accountPath = path.join(this.directory, 'account.json');
        this.initialPath = path.join(this.directory, 'initial-credentials.json');
        this.sessions = new Map();
        this.attempts = new Map();
        this.initialization = null;
        this.writeQueue = Promise.resolve();
    }

    async initialize() {
        if (!this.initialization) {
            this.initialization = this.bootstrap().catch(error => { this.initialization = null; throw error; });
        }
        await this.initialization;
    }

    async bootstrap() {
        await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
        const realDirectory = await fs.realpath(this.directory);
        const projectRoot = await fs.realpath(path.join(__dirname, '..'));
        if (realDirectory === projectRoot || realDirectory.startsWith(projectRoot + path.sep)) {
            throw new StoreError('AZZAM_AUTH_DIR must be outside the project directory');
        }
        await fs.chmod(this.directory, 0o700);
        try {
            const account = JSON.parse(await fs.readFile(this.accountPath, 'utf8'));
            if (!validateAccount(account)) throw new StoreError('Invalid account file');
            await fs.chmod(this.accountPath, 0o600);
            return;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        let { username, password } = initialSettings(this.env);
        const suppliedPassword = Boolean(password);
        if (!password) {
            // Write the randomly generated password only to a private local file. If a
            // previous bootstrap was interrupted, reuse its file rather than losing it.
            try {
                const initial = JSON.parse(await fs.readFile(this.initialPath, 'utf8'));
                username = initial.username;
                password = initial.password;
                await fs.chmod(this.initialPath, 0o600);
            } catch (error) {
                if (error.code !== 'ENOENT') throw error;
                password = crypto.randomBytes(24).toString('base64url');
                await fs.writeFile(this.initialPath, JSON.stringify({ username, password }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
            }
        }
        const account = await makeAccount(username, password);
        if (suppliedPassword) {
            // Do not leave a misleading file from an interrupted earlier bootstrap.
            await fs.unlink(this.initialPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
        await fs.writeFile(this.accountPath, JSON.stringify(account) + '\n', { flag: 'wx', mode: 0o600 });
    }

    async getAccount() {
        await this.initialize();
        const account = JSON.parse(await fs.readFile(this.accountPath, 'utf8'));
        if (!validateAccount(account)) throw new StoreError('Invalid account file');
        return account;
    }

    async replaceAccount(expectedVersion, account) {
        const job = this.writeQueue.then(async () => {
            const current = await this.getAccount();
            if (current.version !== expectedVersion) return false;
            const temporary = `${this.accountPath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
            try {
                await fs.writeFile(temporary, JSON.stringify(account) + '\n', { flag: 'wx', mode: 0o600 });
                await fs.rename(temporary, this.accountPath);
            } finally {
                await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
            }
            // The old temporary password no longer works after a successful change.
            await fs.unlink(this.initialPath).catch(error => {
                if (error.code !== 'ENOENT') console.error('Could not remove the initial credentials file:', error.message);
            });
            return true;
        });
        this.writeQueue = job.catch(() => {});
        return job;
    }

    async putSession(tokenHash, session, ttlSeconds) {
        if (this.sessions.size >= 1000) {
            for (const [key, value] of this.sessions) if (value.expires <= Date.now()) this.sessions.delete(key);
            if (this.sessions.size >= 1000) this.sessions.delete(this.sessions.keys().next().value);
        }
        this.sessions.set(tokenHash, { ...session, expires: Date.now() + ttlSeconds * 1000 });
    }
    async getSession(tokenHash) {
        const session = this.sessions.get(tokenHash);
        if (session && session.expires > Date.now()) return session;
        this.sessions.delete(tokenHash);
        return null;
    }
    async deleteSession(tokenHash) { this.sessions.delete(tokenHash); }

    async takeAttempt(key, limit, windowSeconds) {
        const now = Date.now();
        let entry = this.attempts.get(key);
        if (!entry || entry.expires <= now) entry = { count: 0, expires: now + windowSeconds * 1000 };
        entry.count += 1;
        this.attempts.set(key, entry);
        // Opportunistically remove expired entries so a long-running process stays bounded.
        if (this.attempts.size > 1000) {
            for (const [oldKey, value] of this.attempts) if (value.expires <= now) this.attempts.delete(oldKey);
        }
        return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)) };
    }
    async clearAttempts(key) { this.attempts.delete(key); }
}

class RedisStore {
    constructor(url, token, env = process.env, fetchImpl = fetch) {
        let parsed;
        try { parsed = new URL(url); } catch { throw new StoreError('Invalid Redis REST URL'); }
        if (parsed.protocol !== 'https:' || !token) throw new StoreError('A secure Redis REST URL and token are required');
        this.url = parsed.href;
        this.token = token;
        this.env = env;
        this.fetch = fetchImpl;
        const namespace = env.AZZAM_AUTH_NAMESPACE || 'azzam-admin';
        if (!/^[A-Za-z0-9:_-]{1,80}$/.test(namespace)) throw new StoreError('Invalid authentication namespace');
        this.prefix = namespace + ':';
        this.initialization = null;
    }

    async command(args) {
        let response;
        try {
            response = await this.fetch(this.url, {
                method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(args), signal: AbortSignal.timeout(5000)
            });
            if (!response.ok) throw new Error('Redis request failed');
            const data = await response.json();
            if (data.error) throw new Error('Redis command failed');
            return data.result;
        } catch (error) {
            throw new StoreError('Authentication storage unavailable');
        }
    }

    async initialize() {
        if (!this.initialization) {
            this.initialization = this.bootstrap().catch(error => { this.initialization = null; throw error; });
        }
        await this.initialization;
    }
    async bootstrap() {
        const existing = await this.command(['GET', this.prefix + 'account']);
        if (existing !== null) {
            if (!validateAccount(JSON.parse(existing))) throw new StoreError('Invalid account record');
            return;
        }
        const { username, password } = initialSettings(this.env);
        if (!password) throw new StoreError('Set AZZAM_INITIAL_ADMIN_PASSWORD before initializing Redis');
        const account = await makeAccount(username, password);
        // Multiple cold starts may bootstrap concurrently; exactly one wins.
        await this.command(['SET', this.prefix + 'account', JSON.stringify(account), 'NX']);
    }
    async getAccount() {
        await this.initialize();
        const value = await this.command(['GET', this.prefix + 'account']);
        if (value === null) throw new StoreError('Account record missing');
        const account = JSON.parse(value);
        if (!validateAccount(account)) throw new StoreError('Invalid account record');
        return account;
    }
    async replaceAccount(expectedVersion, account) {
        const script = "local v=redis.call('GET',KEYS[1]); if not v then return 0 end; local ok,a=pcall(cjson.decode,v); if ok and a.version==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 end; return 0";
        return Number(await this.command(['EVAL', script, '1', this.prefix + 'account', expectedVersion, JSON.stringify(account)])) === 1;
    }
    async putSession(tokenHash, session, ttlSeconds) {
        await this.command(['SET', this.prefix + 'session:' + tokenHash, JSON.stringify(session), 'EX', String(ttlSeconds)]);
    }
    async getSession(tokenHash) {
        const value = await this.command(['GET', this.prefix + 'session:' + tokenHash]);
        return value === null ? null : JSON.parse(value);
    }
    async deleteSession(tokenHash) { await this.command(['DEL', this.prefix + 'session:' + tokenHash]); }
    async takeAttempt(key, limit, windowSeconds) {
        const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}";
        const [count, ttl] = await this.command(['EVAL', script, '1', this.prefix + 'attempt:' + key, String(windowSeconds)]);
        return { allowed: Number(count) <= limit, retryAfter: Math.max(1, Number(ttl)) };
    }
    async clearAttempts(key) { await this.command(['DEL', this.prefix + 'attempt:' + key]); }
}

function createStoreFromEnv(env = process.env) {
    const url = env.AZZAM_REDIS_REST_URL || env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
    const token = env.AZZAM_REDIS_REST_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
    if (url || token || env.VERCEL || env.AZZAM_AUTH_STORE === 'redis') return new RedisStore(url, token, env);
    return new FileStore(env.AZZAM_AUTH_DIR || path.join(os.homedir(), '.azzamtechnology'), env);
}

module.exports = { FileStore, RedisStore, StoreError, createStoreFromEnv };
