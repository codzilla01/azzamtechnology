'use strict';

const { createStoreFromEnv } = require('../server/store');
const {
    RequestError,
    resolveSessionSeconds,
    isProduction,
    isHttps,
    securityHeaders,
    sendJson,
    setCookie,
    checkOrigin,
    readJson,
    attemptKey,
    newToken,
    hashToken,
    verifyPasscode,
    currentSession,
    handleError
} = require('../server/http');

const ATTEMPT_LIMIT = 6;
const ATTEMPT_WINDOW = 15 * 60;

function resolveAction(req) {
    const parsed = new URL(req.url, 'http://localhost');
    return parsed.searchParams.get('action') || parsed.pathname.split('/').filter(Boolean).pop();
}

function createAuthHandler(options = {}) {
    const env = options.env || process.env;
    const sessionSeconds = resolveSessionSeconds(env);
    let store = options.store;
    const getStore = () => (store ||= createStoreFromEnv(env));

    return async function handleAuth(req, res) {
        securityHeaders(res, env);
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            const action = resolveAction(req);
            const dataStore = getStore();

            if (action === 'session') {
                if (req.method !== 'GET') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const session = await currentSession(dataStore, req);
                return sendJson(res, 200, { authenticated: Boolean(session) });
            }

            if (action === 'login') {
                if (req.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                checkOrigin(req, env);
                const limitKey = 'auth:' + attemptKey(req, env);
                const rate = await dataStore.takeAttempt(limitKey, ATTEMPT_LIMIT, ATTEMPT_WINDOW);
                if (!rate.allowed) throw new RequestError(429, 'TOO_MANY_ATTEMPTS', rate.retryAfter);
                const body = await readJson(req, 4096);
                const expected = await dataStore.getPasscode();
                if (!verifyPasscode(body.passcode, expected)) {
                    throw new RequestError(401, 'INVALID_PASSCODE');
                }
                const token = newToken();
                await dataStore.putSession(hashToken(token), sessionSeconds);
                setCookie(res, token, env, sessionSeconds);
                await dataStore.clearAttempts(limitKey).catch(() => {});
                return sendJson(res, 200, { authenticated: true });
            }

            if (action === 'logout') {
                if (req.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                checkOrigin(req, env);
                const session = await currentSession(dataStore, req);
                if (session) await dataStore.deleteSession(session.tokenHash).catch(() => {});
                setCookie(res, '', env, 0);
                return sendJson(res, 200, { ok: true });
            }

            throw new RequestError(404, 'NOT_FOUND');
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createAuthHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createAuthHandler = createAuthHandler;
