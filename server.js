'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createStoreFromEnv, FileStore } = require('./server/store');
const { isHttps, isProduction, securityHeaders } = require('./server/http');
const { createStoreHandler } = require('./api/store');
const { createCouponsHandler } = require('./api/coupons');
const { createOrdersHandler } = require('./api/orders');
const { createAuthHandler } = require('./api/auth');
const { createAdminHandler } = require('./api/admin');
const { createAdminDataHandler } = require('./api/admin-data');

const ROOT = __dirname;
const PUBLIC_FILES = new Set([
    'index.html',
    'admin-login.html',
    'chat-bot.html',
    'i18n.js',
    'i18n.css',
    'storefront.css',
    'auth.css'
]);
const PUBLIC_DIRS = ['assets/', 'images/'];
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.txt': 'text/plain; charset=utf-8'
};

const AUTH_ROUTES = new Set(['/api/auth/session', '/api/auth/login', '/api/auth/logout']);
const ADMIN_DATA_ROUTES = new Set([
    '/api/admin/data',
    '/api/admin/products',
    '/api/admin/coupons',
    '/api/admin/orders',
    '/api/admin/settings',
    '/api/admin/chatbot',
    '/api/admin/import',
    '/api/admin/reset'
]);

function createServer(store, env = process.env) {
    const opts = { store, env };
    const handleStore = createStoreHandler(opts);
    const handleCoupons = createCouponsHandler(opts);
    const handleOrders = createOrdersHandler(opts);
    const handleAuth = createAuthHandler(opts);
    const handleAdmin = createAdminHandler(opts);
    const handleAdminData = createAdminDataHandler(opts);

    return http.createServer(async (req, res) => {
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        } catch {
            res.writeHead(400).end('Bad request');
            return;
        }

        if ((pathname === '/admin' || pathname === '/admin/') && (req.method === 'GET' || req.method === 'HEAD')) {
            res.writeHead(302, { Location: '/admin.html', 'Cache-Control': 'no-store' }).end();
            return;
        }
        if (pathname === '/admin.html' || pathname === '/api/admin') return handleAdmin(req, res);
        if (pathname === '/api/store') return handleStore(req, res);
        if (pathname === '/api/coupons/validate') return handleCoupons(req, res);
        if (pathname === '/api/orders') return handleOrders(req, res);
        if (AUTH_ROUTES.has(pathname)) return handleAuth(req, res);
        if (ADMIN_DATA_ROUTES.has(pathname)) return handleAdminData(req, res);

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405).end('Method not allowed');
            return;
        }

        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        if (!(PUBLIC_FILES.has(relative) || PUBLIC_DIRS.some(dir => relative.startsWith(dir))) || relative.includes('\\') || relative.split('/').some(part => part === '..' || part.startsWith('.'))) {
            res.writeHead(404).end('Not found');
            return;
        }
        if (relative === 'admin-login.html' && isProduction(env) && !isHttps(req, env)) {
            securityHeaders(res, env);
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('HTTPS required');
            return;
        }
        try {
            const target = await fs.realpath(path.join(ROOT, relative));
            const directory = PUBLIC_DIRS.find(dir => relative.startsWith(dir));
            const allowedRoot = directory ? path.resolve(ROOT, directory) + path.sep : null;
            if (directory ? !target.startsWith(allowedRoot) : target !== path.join(ROOT, relative)) throw new Error('Outside public root');
            const stat = await fs.stat(target);
            if (!stat.isFile()) throw new Error('Not a file');
            const type = MIME[path.extname(target).toLowerCase()];
            if (!type) throw new Error('Not a public file type');
            if (relative === 'admin-login.html') securityHeaders(res, env);
            else {
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600');
            }
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
            if (req.method === 'HEAD') return res.end();
            res.end(await fs.readFile(target));
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('Not found');
        }
    });
}

async function main() {
    const store = createStoreFromEnv();
    if (typeof store.initialize === 'function') await store.initialize();
    const server = createServer(store);
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 8000);
    server.listen(port, host, () => {
        console.log(`Azzam Technology listening on ${host}:${port}`);
        if (store instanceof FileStore && !process.env.AZZAM_ADMIN_PASSCODE) {
            console.log(`Local admin passcode file: ${store.passcodePath}`);
        }
    });
}

if (require.main === module) {
    main().catch(error => {
        console.error('Cannot start server:', error.message);
        process.exitCode = 1;
    });
}
module.exports = { createServer };
