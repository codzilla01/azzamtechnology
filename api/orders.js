'use strict';

const { createStoreFromEnv } = require('../server/store');
const {
    RequestError,
    isProduction,
    isHttps,
    securityHeaders,
    sendJson,
    checkOrigin,
    readJson,
    attemptKey,
    handleError
} = require('../server/http');

const ORDER_LIMIT = 20;
const ORDER_WINDOW = 15 * 60;

function createOrdersHandler(options = {}) {
    const env = options.env || process.env;
    let store = options.store;
    const getStore = () => (store ||= createStoreFromEnv(env));

    return async function handleOrders(req, res) {
        securityHeaders(res, env);
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            if (req.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            checkOrigin(req, env);
            const dataStore = getStore();
            const limitKey = 'order:' + attemptKey(req, env);
            const rate = await dataStore.takeAttempt(limitKey, ORDER_LIMIT, ORDER_WINDOW);
            if (!rate.allowed) throw new RequestError(429, 'TOO_MANY_ATTEMPTS', rate.retryAfter);
            const body = await readJson(req, 65536);
            const result = await dataStore.createOrder(body);
            return sendJson(res, 201, result);
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createOrdersHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createOrdersHandler = createOrdersHandler;
