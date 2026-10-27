'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createApp, isHttps, securityHeaders } = require('./server/app');
const { createStoreFromEnv, FileStore } = require('./server/store');

const ROOT = __dirname;
const PUBLIC_FILES = new Set(['index.html', 'login.html', 'chat-bot.html', 'i18n.js', 'i18n.css', 'auth.js', 'auth.css', 'storefront.css']);
const PUBLIC_DIRS = ['assets/', 'images/'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8' };

function createServer(store, env = process.env) {
    const auth = createApp({ store, env });
    return http.createServer(async (req, res) => {
        let pathname;
        try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
        catch { res.writeHead(400).end('Bad request'); return; }

        if ((pathname === '/admin' || pathname === '/admin/') && (req.method === 'GET' || req.method === 'HEAD')) {
            res.writeHead(302, { Location: '/admin.html', 'Cache-Control': 'no-store' }).end();
            return;
        }
        const endpoints = { '/admin.html': 'admin', '/api/admin': 'admin', '/api/auth/login': 'login', '/api/auth/session': 'session', '/api/auth/change': 'change', '/api/auth/logout': 'logout' };
        if (endpoints[pathname]) return auth(req, res, endpoints[pathname]);
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end('Method not allowed'); return; }

        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        if (!(PUBLIC_FILES.has(relative) || PUBLIC_DIRS.some(dir => relative.startsWith(dir))) || relative.includes('\\') || relative.split('/').some(part => part === '..' || part.startsWith('.'))) {
            res.writeHead(404).end('Not found'); return;
        }
        // Never present a password form over plaintext HTTP in production.
        if (relative === 'login.html' && (env.NODE_ENV === 'production' || env.VERCEL) && !isHttps(req, env)) {
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
            if (relative === 'login.html') securityHeaders(res, env);
            else {
                res.setHeader('X-Content-Type-Options', 'nosniff');
                res.setHeader('Cache-Control', type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600');
            }
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
            if (req.method === 'HEAD') return res.end();
            // Local assets are small; keeping a simple allowlisted file server avoids
            // accidentally exposing the private dashboard or authentication data.
            res.end(await fs.readFile(target));
        } catch { if (!res.headersSent) res.writeHead(404); res.end('Not found'); }
    });
}

async function main() {
    const store = createStoreFromEnv();
    await store.initialize();
    const server = createServer(store);
    // Local access is the safe default; set HOST=0.0.0.0 only behind a trusted proxy.
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 8000);
    server.listen(port, host, () => {
        console.log(`Azzam Technology listening on ${host}:${port}`);
        if (store instanceof FileStore) console.log(`Initial login details, if still needed: ${store.initialPath}`);
    });
}

if (require.main === module) main().catch(error => { console.error('Cannot start authentication:', error.message); process.exitCode = 1; });
module.exports = { createServer };
