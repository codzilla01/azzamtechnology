'use strict';

const { createStoreFromEnv } = require('../server/store');
const { RequestError, securityHeaders, sendJson, handleError } = require('../server/http');

function createStoreHandler(options = {}) {
    const env = options.env || process.env;
    let store = options.store;
    const getStore = () => (store ||= createStoreFromEnv(env));

    return async function handleStore(req, res) {
        securityHeaders(res, env);
        try {
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            }
            const data = await getStore().getPublicStore();
            if (req.method === 'HEAD') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.end();
            }
            return sendJson(res, 200, data);
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createStoreHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createStoreHandler = createStoreHandler;
