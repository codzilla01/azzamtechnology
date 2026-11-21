'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {
    RequestError,
    isProduction,
    isHttps,
    securityHeaders,
    handleError
} = require('../server/http');

const ADMIN_FILE = path.join(__dirname, '..', 'private', 'admin.html');

function createAdminHandler(options = {}) {
    const env = options.env || process.env;

    return async function handleAdmin(req, res) {
        securityHeaders(res, env);
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        try {
            if (isProduction(env) && !isHttps(req, env)) throw new RequestError(403, 'HTTPS_REQUIRED');
            const method = req.method || 'GET';
            if (method !== 'GET' && method !== 'HEAD') throw new RequestError(405, 'METHOD_NOT_ALLOWED');
            const document = await fs.readFile(ADMIN_FILE);
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Length': document.length
            });
            return res.end(method === 'HEAD' ? undefined : document);
        } catch (error) {
            return handleError(res, error);
        }
    };
}

const defaultHandler = createAdminHandler();
module.exports = (req, res) => defaultHandler(req, res);
module.exports.createAdminHandler = createAdminHandler;
