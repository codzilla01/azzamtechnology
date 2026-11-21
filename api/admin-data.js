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
    currentSession,
    handleError
} = require('../server/http');

function resolveResource(req) {
    const parsed = new URL(req.url, 'http://localhost');
    return {
        resource: parsed.searchParams.get('resource') || parsed.pathname.split('/').filter(Boolean).pop(),
        query: parsed.searchParams
    };
}

function createAdminDataHandler(options = {}) {
    const env = options.env || process.env;
    let store = options.store;
    const getStore = () => (store ||= createStoreFromEnv(env));

    return async function handleAdminData(req, res) {
        securityHeaders(res, env);
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            const method = req.method || 'GET';
            if (method !== 'GET' && method !== 'HEAD') checkOrigin(req, env);

            const dataStore = getStore();
            const session = await currentSession(dataStore, req);
            if (!session) throw new RequestError(401, 'NOT_AUTHENTICATED');

            const { resource, query } = resolveResource(req);

            if (resource === 'data') {
                if (method !== 'GET') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                return sendJson(res, 200, await dataStore.getAdminData());
            }

            if (resource === 'products') {
                if (method === 'POST' || method === 'PUT') {
                    const body = await readJson(req, 2 * 1024 * 1024);
                    const product = await dataStore.upsertProduct(body);
                    return sendJson(res, 200, { product });
                }
                if (method === 'DELETE') {
                    let id = query.get('id');
                    if (!id) {
                        const body = await readJson(req, 4096);
                        id = body.id;
                    }
                    if (!id) throw new RequestError(400, 'MISSING_PRODUCT_ID');
                    await dataStore.deleteProduct(id);
                    return sendJson(res, 200, { ok: true });
                }
                throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            }

            if (resource === 'coupons') {
                if (method === 'POST' || method === 'PUT') {
                    const body = await readJson(req, 16384);
                    const coupon = await dataStore.upsertCoupon(body);
                    return sendJson(res, 200, { coupon });
                }
                if (method === 'DELETE') {
                    let code = query.get('code');
                    if (!code) {
                        const body = await readJson(req, 4096);
                        code = body.code;
                    }
                    if (!code) throw new RequestError(400, 'MISSING_COUPON_CODE');
                    await dataStore.deleteCoupon(code);
                    return sendJson(res, 200, { ok: true });
                }
                throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            }

            if (resource === 'orders') {
                if (method === 'PATCH') {
                    const body = await readJson(req, 8192);
                    const order = await dataStore.updateOrderStatus(body.id, body.status);
                    return sendJson(res, 200, { order });
                }
                if (method === 'DELETE') {
                    await dataStore.clearOrders();
                    return sendJson(res, 200, { ok: true });
                }
                throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            }

            if (resource === 'settings') {
                if (method !== 'PUT' && method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const body = await readJson(req, 16384);
                const settings = await dataStore.saveSettings(body);
                return sendJson(res, 200, { settings });
            }

            if (resource === 'chatbot') {
                if (method !== 'PUT' && method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const body = await readJson(req, 262144);
                const chatbot = await dataStore.saveChatbot(body);
                return sendJson(res, 200, { chatbot });
            }

            if (resource === 'import') {
                if (method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                const body = await readJson(req, 5 * 1024 * 1024);
                const data = await dataStore.importData(body.data || body, Boolean(body.merge));
                return sendJson(res, 200, data);
            }

            if (resource === 'reset') {
                if (method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
                await readJson(req, 4096);
                const data = await dataStore.resetData();
                return sendJson(res, 200, data);
            }

            throw new RequestError(404, 'NOT_FOUND');
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createAdminDataHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createAdminDataHandler = createAdminDataHandler;
