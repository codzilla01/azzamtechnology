'use strict';

const { createStoreFromEnv } = require('../server/store');
const { computeCouponDiscount, ValidationError } = require('../server/validate');
const { RequestError, isProduction, isHttps, securityHeaders, sendJson, checkOrigin, readJson, handleError } = require('../server/http');

function createCouponsHandler(options = {}) {
    const env = options.env || process.env;
    let store = options.store;
    const getStore = () => (store ||= createStoreFromEnv(env));

    return async function handleCoupons(req, res) {
        securityHeaders(res, env);
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            if (req.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            checkOrigin(req, env);
            const body = await readJson(req, 8192);
            const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
            const subtotal = Number(body.subtotal);
            if (!code) throw new ValidationError('INVALID_COUPON_CODE');
            if (!Number.isFinite(subtotal) || subtotal < 0) throw new ValidationError('INVALID_SUBTOTAL');
            const coupon = await getStore().getCoupon(code);
            const { discountAmount, finalTotal } = computeCouponDiscount(coupon, Math.round(subtotal * 100) / 100);
            return sendJson(res, 200, {
                valid: true,
                coupon: { code: coupon.code, type: coupon.type, discount: coupon.discount, minOrder: coupon.minOrder },
                discountAmount,
                finalTotal
            });
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createCouponsHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createCouponsHandler = createCouponsHandler;
