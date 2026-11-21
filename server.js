'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const handleAdmin = require('./api/admin');

const ROOT = __dirname;
const PUBLIC_FILES = new Set(['index.html', 'chat-bot.html', 'i18n.js', 'i18n.css', 'storefront.css']);
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

function createServer() {
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
        if (pathname === '/admin.html' || pathname === '/api/admin') {
            return handleAdmin(req, res);
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405).end('Method not allowed');
            return;
        }

        const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        if (!(PUBLIC_FILES.has(relative) || PUBLIC_DIRS.some(dir => relative.startsWith(dir))) || relative.includes('\\') || relative.split('/').some(part => part === '..' || part.startsWith('.'))) {
            res.writeHead(404).end('Not found');
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
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', type.startsWith('text/html') ? 'no-cache' : 'public, max-age=3600');
            res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
            if (req.method === 'HEAD') return res.end();
            res.end(await fs.readFile(target));
        } catch {
            if (!res.headersSent) res.writeHead(404);
            res.end('Not found');
        }
    });
}

function main() {
    const server = createServer();
    const host = process.env.HOST || '127.0.0.1';
    const port = Number(process.env.PORT || 8000);
    server.listen(port, host, () => {
        console.log(`Azzam Technology listening on ${host}:${port}`);
    });
}

if (require.main === module) main();
module.exports = { createServer };
