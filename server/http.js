'use strict';

const crypto = require('node:crypto');
const { ValidationError } = require('./validate');

const COOKIE = 'azzam_admin_session';
const DEFAULT_SESSION_SECONDS = 24 * 60 * 60;
const MAX_SESSION_SECONDS = 90 * 24 * 60 * 60;

class RequestError extends Error {
    constructor(status, code, retryAfter, details) {
        super(code);
        this.status = status;
        this.code = code;
        this.retryAfter = retryAfter;
        this.details = details;
    }
}

function resolveSessionSeconds(env = process.env) {
    const raw = env.AZZAM_SESSION_HOURS;
    if (raw === undefined || String(raw).trim() === '') return DEFAULT_SESSION_SECONDS;
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours <= 0) throw new Error('AZZAM_SESSION_HOURS must be a positive number of hours');
    const seconds = Math.floor(hours * 3600);
    if (seconds > MAX_SESSION_SECONDS) throw new Error('AZZAM_SESSION_HOURS must not exceed 2160 (90 days)');
    return Math.max(60, seconds);
}

function isProduction(env = process.env) {
    return env.NODE_ENV === 'production' || Boolean(env.VERCEL);
}

function isHttps(req, env = process.env) {
    if (req.socket && req.socket.encrypted) return true;
    const trustProxy = env.AZZAM_TRUST_PROXY === '1' || Boolean(env.VERCEL);
    return trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}

function securityHeaders(res, env = process.env, { noStore = true } = {}) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (noStore) res.setHeader('Cache-Control', 'no-store');
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

function setCookie(res, token, env = process.env, maxAge = DEFAULT_SESSION_SECONDS) {
    const secure = isProduction(env) || env.AZZAM_COOKIE_SECURE === '1';
    res.setHeader(
        'Set-Cookie',
        `${COOKIE}=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`
    );
}

function checkOrigin(req, env = process.env) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (typeof origin !== 'string' || !host || req.headers['sec-fetch-site'] === 'cross-site') {
        throw new RequestError(403, 'INVALID_ORIGIN');
    }
    try {
        const expected = new URL(`${isHttps(req, env) ? 'https' : 'http'}://${host}`).origin;
        if (new URL(origin).origin !== expected || origin === 'null') throw new Error('Origin mismatch');
    } catch {
        throw new RequestError(403, 'INVALID_ORIGIN');
    }
}

async function readJson(req, limit = 65536) {
    if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) {
        throw new RequestError(415, 'JSON_REQUIRED');
    }
    const length = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(length) && length > limit) throw new RequestError(413, 'BODY_TOO_LARGE');

    let suppliedBody;
    try { suppliedBody = req.body; } catch { throw new RequestError(400, 'INVALID_REQUEST'); }
    if (suppliedBody !== undefined) {
        let parsed;
        try { parsed = typeof suppliedBody === 'string' ? JSON.parse(suppliedBody) : suppliedBody; }
        catch { throw new RequestError(400, 'INVALID_REQUEST'); }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Buffer.byteLength(JSON.stringify(parsed)) > limit) {
            throw new RequestError(Buffer.byteLength(JSON.stringify(parsed || '')) > limit ? 413 : 400, Buffer.byteLength(JSON.stringify(parsed || '')) > limit ? 'BODY_TOO_LARGE' : 'INVALID_REQUEST');
        }
        return parsed;
    }

    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
        size += chunk.length;
        if (size > limit) throw new RequestError(413, 'BODY_TOO_LARGE');
        chunks.push(chunk);
    }
    try {
        const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('not an object');
        return data;
    } catch {
        throw new RequestError(400, 'INVALID_REQUEST');
    }
}

function attemptKey(req, env = process.env) {
    const trustProxy = env.AZZAM_TRUST_PROXY === '1' || Boolean(env.VERCEL);
    const ip = (trustProxy && req.headers['x-real-ip']) || (req.socket && req.socket.remoteAddress) || 'unknown';
    return crypto.createHash('sha256').update(String(ip).slice(0, 128)).digest('hex');
}

function newToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyPasscode(supplied, expected) {
    if (typeof supplied !== 'string' || typeof expected !== 'string' || !expected) return false;
    const a = crypto.createHash('sha256').update(supplied).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}

async function currentSession(store, req) {
    const token = cookieValue(req);
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await store.getSession(tokenHash);
    if (!session) return null;
    return { tokenHash, session };
}

function handleError(res, error) {
    if (error instanceof RequestError) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        return sendJson(res, error.status, { code: error.code, ...(error.details ? { details: error.details } : {}) });
    }
    if (error instanceof ValidationError) {
        return sendJson(res, error.status, { code: error.code, ...(error.details ? { details: error.details } : {}) });
    }
    console.error('API request failed:', error.name, error.message);
    return sendJson(res, error.status || 503, { code: error.code || 'SERVICE_UNAVAILABLE' });
}

module.exports = {
    RequestError,
    resolveSessionSeconds,
    isProduction,
    isHttps,
    securityHeaders,
    sendJson,
    redirect,
    cookieValue,
    setCookie,
    checkOrigin,
    readJson,
    attemptKey,
    newToken,
    hashToken,
    verifyPasscode,
    currentSession,
    handleError
};
