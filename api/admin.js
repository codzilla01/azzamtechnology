'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const ADMIN_FILE = path.join(__dirname, '..', 'private', 'admin.html');

module.exports = async function handleAdmin(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');

    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Method not allowed');
    }

    try {
        const document = await fs.readFile(ADMIN_FILE);
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Length': document.length
        });
        return res.end(method === 'HEAD' ? undefined : document);
    } catch (error) {
        console.error('Failed to serve admin dashboard:', error.message);
        if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Admin dashboard unavailable');
    }
};
