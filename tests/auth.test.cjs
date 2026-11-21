'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { createServer } = require('../server');
const handleAdmin = require('../api/admin');

async function startServer(t) {
    const server = createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    return base;
}

test('admin dashboard is served directly without login and redirects /admin to /admin.html', async t => {
    const base = await startServer(t);

    for (const route of ['/admin', '/admin/']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/admin.html');
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }

    for (const route of ['/admin.html', '/api/admin']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        const html = await res.text();
        assert.match(html, /id="panel-dashboard"/);
        assert.doesNotMatch(html, /\/api\/auth\/|login\.html|security-form|logout-btn/);
    }

    const head = await fetch(base + '/admin.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    const post = await fetch(base + '/admin.html', { method: 'POST' });
    assert.equal(post.status, 405);
});

test('public storefront excludes footer admin link and non-public paths return 404', async t => {
    const base = await startServer(t);

    const home = await fetch(base + '/');
    assert.equal(home.status, 200);
    const homeHtml = await home.text();
    assert.match(homeHtml, /id="secret-admin-trigger"/);
    assert.doesNotMatch(homeHtml, /href="\/admin\.html"/);

    for (const route of ['/login.html', '/private/admin.html', '/server.js', '/tests/auth.test.cjs', '/assets/%2e%2e/private/admin.html']) {
        assert.equal((await fetch(base + route)).status, 404, route);
    }

    assert.equal((await fetch(base + '/chat-bot.html')).status, 200);
    assert.equal((await fetch(base + '/assets/vendor/fontawesome/css/all.min.css')).status, 200);
    assert.equal((await fetch(base + '/images/product-placeholder.svg')).status, 200);
});

test('Vercel api/admin handler serves the dashboard directly on GET/HEAD and rejects POST', async t => {
    const server = http.createServer((req, res) => handleAdmin(req, res));
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;

    const getRes = await fetch(base + '/api/admin');
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('cache-control'), 'no-store');
    assert.equal(getRes.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.match(await getRes.text(), /id="panel-dashboard"/);

    const postRes = await fetch(base + '/api/admin', { method: 'POST' });
    assert.equal(postRes.status, 405);
});
