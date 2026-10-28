'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStoreFromEnv } = require('./store');
const { validateUsername, validatePassword, hashPassword, verifyPassword, newVersion, newToken, hashToken } = require('./passwords');

const COOKIE = 'azzam_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const ATTEMPT_LIMIT = 6;
const ATTEMPT_WINDOW = 15 * 60;
const BODY_LIMIT = 4096;
const ADMIN_FILE = path.join(__dirname, '..', 'private', 'admin.html');

class RequestError extends Error {
    constructor(status, code, retryAfter) { super(code); this.status = status; this.code = code; this.retryAfter = retryAfter; }
}

function isProduction(env) { return env.NODE_ENV === 'production' || Boolean(env.VERCEL); }
function isHttps(req, env) {
    if (req.socket && req.socket.encrypted) return true;
    const trustProxy = env.AZZAM_TRUST_PROXY === '1' || Boolean(env.VERCEL);
    return trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}
function securityHeaders(res, env) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (isProduction(env)) {
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
        res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }
}
function sendJson(res, status, data) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
}
function redirect(res, destination) {
    res.statusCode = 302;
    res.setHeader('Location', destination);
    res.end();
}
function cookieValue(req) {
    const parts = String(req.headers.cookie || '').split(';');
    const matches = parts.map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
    if (matches.length !== 1) return null;
    const value = matches[0].slice(COOKIE.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
function setCookie(res, token, env, maxAge = SESSION_SECONDS) {
    const secure = isProduction(env) || env.AZZAM_COOKIE_SECURE === '1';
    res.setHeader('Set-Cookie', `${COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}
function checkOrigin(req, env) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (typeof origin !== 'string' || !host || req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, 'INVALID_ORIGIN');
    try {
        const expected = new URL(`${isHttps(req, env) ? 'https' : 'http'}://${host}`).origin;
        if (new URL(origin).origin !== expected || origin === 'null') throw new Error('Origin mismatch');
    } catch { throw new RequestError(403, 'INVALID_ORIGIN'); }
}
async function readJson(req) {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) throw new RequestError(415, 'JSON_REQUIRED');
    const length = Number(req.headers['content-length'] || 0);
    if (length > BODY_LIMIT) throw new RequestError(413, 'BODY_TOO_LARGE');
    // Vercel's body helper is a getter that parses JSON when first accessed.
    let suppliedBody;
    try { suppliedBody = req.body; } catch { throw new RequestError(400, 'INVALID_REQUEST'); }
    if (suppliedBody !== undefined) {
        let parsed;
        try { parsed = typeof suppliedBody === 'string' ? JSON.parse(suppliedBody) : suppliedBody; }
        catch { throw new RequestError(400, 'INVALID_REQUEST'); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Buffer.byteLength(JSON.stringify(parsed)) > BODY_LIMIT) throw new RequestError(400, 'INVALID_REQUEST');
        return parsed;
    }
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > BODY_LIMIT) throw new RequestError(413, 'BODY_TOO_LARGE');
        chunks.push(chunk);
    }
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
        return data;
    } catch { throw new RequestError(400, 'INVALID_REQUEST'); }
}
function attemptKey(req, env) {
    // Vercel supplies x-real-ip at its trusted edge. A self-hosted reverse proxy
    // must overwrite x-real-ip when AZZAM_TRUST_PROXY=1, not append user input.
    const trustProxy = env.AZZAM_TRUST_PROXY === '1' || Boolean(env.VERCEL);
    const ip = (trustProxy && req.headers['x-real-ip']) || (req.socket && req.socket.remoteAddress) || 'unknown';
    return crypto.createHash('sha256').update(String(ip).slice(0, 128)).digest('hex');
}
async function limitAttempts(store, req, env) {
    const key = attemptKey(req, env);
    const result = await store.takeAttempt(key, ATTEMPT_LIMIT, ATTEMPT_WINDOW);
    if (!result.allowed) throw new RequestError(429, 'TOO_MANY_ATTEMPTS', result.retryAfter);
    return key;
}
async function currentSession(store, req) {
    const token = cookieValue(req);
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await store.getSession(tokenHash);
    if (!session || typeof session.version !== 'string') return null;
    const account = await store.getAccount();
    if (session.version !== account.version) return null;
    return { tokenHash, account };
}
async function issueSession(store, res, account, env) {
    const token = newToken();
    await store.putSession(hashToken(token), { version: account.version }, SESSION_SECONDS);
    setCookie(res, token, env);
}

function createApp(options = {}) {
    const env = options.env || process.env;
    let store = options.store;
    function getStore() {
        if (!store) store = createStoreFromEnv(env);
        return store;
    }

    return async function handle(req, res, endpoint) {
        securityHeaders(res, env);
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            const method = req.method || 'GET';
            // Even when authentication storage is unconfigured, send visitors to
            // the friendly sign-in page rather than exposing the dashboard.
            if (endpoint === 'admin' && (method === 'GET' || method === 'HEAD') && !cookieValue(req)) return redirect(res, '/login.html');
            const authStore = getStore();

            if (endpoint === 'admin') {
                if (method !== 'GET' && method !== 'HEAD') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const session = await currentSession(authStore, req);
                if (!session) return redirect(res, '/login.html');
                if (session.account.mustChange) return redirect(res, '/login.html?setup=1');
                const document = await fs.readFile(ADMIN_FILE);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                return res.end(method === 'HEAD' ? undefined : document);
            }

            if (endpoint === 'session') {
                if (method !== 'GET') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const session = await currentSession(authStore, req);
                return sendJson(res, 200, session ? { authenticated: true, username: session.account.username, mustChange: session.account.mustChange } : { authenticated: false });
            }

            if (!['login', 'change', 'logout'].includes(endpoint)) throw new RequestError(404, 'NOT_FOUND');
            if (method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            checkOrigin(req, env);
            const body = await readJson(req);

            if (endpoint === 'login') {
                const key = await limitAttempts(authStore, req, env);
                const account = await authStore.getAccount();
                const passwordOK = await verifyPassword(body.password, account);
                if (body.username !== account.username || !passwordOK) throw new RequestError(401, 'INVALID_CREDENTIALS');
                await issueSession(authStore, res, account, env);
                await authStore.clearAttempts(key).catch(() => {});
                return sendJson(res, 200, { authenticated: true, username: account.username, mustChange: account.mustChange });
            }

            const session = await currentSession(authStore, req);
            if (!session) throw new RequestError(401, 'NOT_AUTHENTICATED');
            if (endpoint === 'logout') {
                await authStore.deleteSession(session.tokenHash);
                setCookie(res, '', env, 0);
                return sendJson(res, 200, { ok: true });
            }

            const key = await limitAttempts(authStore, req, env);
            const passwordOK = await verifyPassword(body.currentPassword, session.account);
            if (!passwordOK) throw new RequestError(401, 'INVALID_CREDENTIALS');
            if (!validateUsername(body.username)) throw new RequestError(400, 'INVALID_USERNAME');
            const hasNewPassword = typeof body.newPassword === 'string' && body.newPassword.length > 0;
            if (session.account.mustChange && !hasNewPassword) throw new RequestError(400, 'INVALID_PASSWORD');
            if (!hasNewPassword && body.username === session.account.username) throw new RequestError(400, 'NO_CHANGES');
            if (!validatePassword(hasNewPassword ? body.newPassword : body.currentPassword, body.username)) throw new RequestError(400, 'INVALID_PASSWORD');
            if (hasNewPassword && await verifyPassword(body.newPassword, session.account)) throw new RequestError(400, 'PASSWORD_UNCHANGED');
            const passwordHash = hasNewPassword ? await hashPassword(body.newPassword) : {
                salt: session.account.salt, hash: session.account.hash,
                ...(session.account.kdf ? { kdf: session.account.kdf } : {})
            };
            const replacement = { username: body.username, ...passwordHash, version: newVersion(), mustChange: false };
            if (!await authStore.replaceAccount(session.account.version, replacement)) throw new RequestError(409, 'ACCOUNT_CHANGED');
            await issueSession(authStore, res, replacement, env);
            await Promise.allSettled([authStore.deleteSession(session.tokenHash), authStore.clearAttempts(key)]);
            return sendJson(res, 200, { ok: true, username: replacement.username });
        } catch (error) {
            if (error instanceof RequestError) {
                if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
                return sendJson(res, error.status, { code: error.code });
            }
            // Do not expose storage configuration, request bodies, or secrets to clients.
            console.error('Authentication request failed:', error.name, error.message);
            return sendJson(res, 503, { code: 'AUTH_UNAVAILABLE' });
        }
    };
}

module.exports = { createApp, isHttps, securityHeaders, RequestError };
