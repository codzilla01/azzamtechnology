'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../server');
const { FileStore, createStoreFromEnv } = require('../server/store');

async function startTestServer(t) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'azzam-auth-test-'));
    const store = new FileStore(dataDir, process.env);
    await store.initialize();
    const server = createServer(store, process.env);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(() => new Promise(resolve => {
        server.close(() => {
            fs.rmSync(dataDir, { recursive: true, force: true });
            resolve();
        });
        server.closeAllConnections();
    }));
    return { base, store };
}

test('admin dashboard is served directly without login and redirects /admin to /admin.html', async t => {
    const { base } = await startTestServer(t);

    for (const route of ['/admin', '/admin/']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/admin.html');
    }

    for (const route of ['/admin.html', '/api/admin']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        const html = await res.text();
        assert.match(html, /id="panel-dashboard"/);
        assert.doesNotMatch(html, /\/api\/auth\/|admin-login\.html|admin-signout-btn/);
    }

    const head = await fetch(base + '/admin.html', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');

    const post = await fetch(base + '/admin.html', { method: 'POST' });
    assert.equal(post.status, 405);

    const adminData = await fetch(base + '/api/admin/data');
    assert.equal(adminData.status, 200);

    for (const route of ['/admin-login.html', '/api/auth/login', '/private/admin.html', '/server.js', '/supabase/schema.sql', '/tests/auth.test.cjs', '/assets/%2e%2e/private/admin.html']) {
        assert.equal((await fetch(base + route)).status, 404, route);
    }

    const homeHtml = await (await fetch(base + '/')).text();
    assert.match(homeHtml, /id="secret-admin-trigger"/);
    assert.doesNotMatch(homeHtml, /href="\/admin\.html"/);
});

test('mutating admin requests still enforce same-origin CSRF protection', async t => {
    const { base } = await startTestServer(t);

    const crossOrigin = await fetch(base + '/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ id: 'p1', type: 'laptop', name: 'Bad', price: 1000, stock: 1 })
    });
    assert.equal(crossOrigin.status, 403);
});

test('direct admin CRUD, public store, coupon validation, and order stock flow work end-to-end', async t => {
    const { base } = await startTestServer(t);

    const addMonitor = await fetch(base + '/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({
            id: 'mon-1',
            type: 'gaming',
            name: 'شاشة قيمنج 27',
            brand: 'LG',
            price: 10000,
            oldPrice: 12000,
            discount: 17,
            stock: 2,
            specs: { التحديث: '165Hz' }
        })
    });
    assert.equal(addMonitor.status, 200);

    for (const [id, compType, name, price] of [
        ['cpu-1', 'cpu', 'Intel i5', 5000],
        ['ram-1', 'ram', '16GB DDR5', 2500],
        ['gpu-1', 'gpu', 'RTX 4060', 15000]
    ]) {
        const res = await fetch(base + '/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: base },
            body: JSON.stringify({ id, type: 'component', componentType: compType, name, price, stock: 3 })
        });
        assert.equal(res.status, 200);
    }

    const addCoupon = await fetch(base + '/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ code: 'SAVE20', type: 'percent', discount: 20, minOrder: 5000, active: true })
    });
    assert.equal(addCoupon.status, 200);

    const pubStoreRes = await fetch(base + '/api/store');
    assert.equal(pubStoreRes.status, 200);
    const pubStore = await pubStoreRes.json();
    assert.equal(pubStore.products.length, 4);
    assert.equal(pubStore.orders, undefined);

    const invalidCoupon = await fetch(base + '/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ code: 'SAVE20', subtotal: 1000 })
    });
    assert.equal(invalidCoupon.status, 400);

    const validCoupon = await fetch(base + '/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ code: 'save20', subtotal: 10000 })
    });
    assert.equal(validCoupon.status, 200);
    const couponBody = await validCoupon.json();
    assert.equal(couponBody.discountAmount, 2000);
    assert.equal(couponBody.finalTotal, 8000);

    const orderRes = await fetch(base + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({
            customer: { name: 'أحمد علي', phone: '01012345678', governorate: 'القاهرة', address: 'مدينة نصر', notes: 'مساءً' },
            items: [
                { productId: 'mon-1', quantity: 1 },
                { type: 'custom_build', name: 'تجميعة PC مخصصة', componentIds: ['cpu-1', 'ram-1', 'gpu-1'], quantity: 1 }
            ],
            couponCode: 'SAVE20'
        })
    });
    assert.equal(orderRes.status, 201);
    const { order } = await orderRes.json();
    assert.equal(order.subtotal, 32500);
    assert.equal(order.discountAmount, 6500);
    assert.equal(order.finalTotal, 26000);
    assert.equal(order.status, 'new');

    const overOrder = await fetch(base + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({
            customer: { name: 'أحمد علي', phone: '01012345678', governorate: 'القاهرة', address: 'مدينة نصر' },
            items: [{ productId: 'mon-1', quantity: 2 }]
        })
    });
    assert.equal(overOrder.status, 409);

    const patchOrder = await fetch(base + '/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ id: order.id, status: 'confirmed' })
    });
    assert.equal(patchOrder.status, 200);
    assert.equal((await patchOrder.json()).order.status, 'confirmed');
});

test('production environment fails closed if Supabase env vars are missing', () => {
    assert.throws(() => createStoreFromEnv({ VERCEL: '1' }), /Invalid SUPABASE_URL|SUPABASE_URL/);
});
