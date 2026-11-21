'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { createServer } = require('../server');
const { FileStore, createStoreFromEnv } = require('../server/store');

async function startTestServer(t, passcode = 'test-passcode-1234') {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'azzam-auth-test-'));
    const env = { ...process.env, AZZAM_ADMIN_PASSCODE: passcode };
    const store = new FileStore(dataDir, env);
    await store.initialize();
    const server = createServer(store, env);
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

function cookieHeaderFrom(res) {
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) return '';
    return setCookie.split(';')[0];
}

test('admin routes require authentication and protect against CSRF and path traversal', async t => {
    const { base } = await startTestServer(t);

    for (const route of ['/admin', '/admin/']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/admin.html');
    }

    for (const route of ['/admin.html', '/api/admin']) {
        const res = await fetch(base + route, { redirect: 'manual' });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/admin-login.html');
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    }

    const adminDataUnauth = await fetch(base + '/api/admin/data');
    assert.equal(adminDataUnauth.status, 401);

    const sessionUnauth = await fetch(base + '/api/auth/session');
    assert.equal(sessionUnauth.status, 200);
    assert.deepEqual(await sessionUnauth.json(), { authenticated: false });

    const crossOriginLogin = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' },
        body: JSON.stringify({ passcode: 'test-passcode-1234' })
    });
    assert.equal(crossOriginLogin.status, 403);

    for (const route of ['/private/admin.html', '/server.js', '/supabase/schema.sql', '/tests/auth.test.cjs', '/assets/%2e%2e/private/admin.html']) {
        assert.equal((await fetch(base + route)).status, 404, route);
    }

    const homeHtml = await (await fetch(base + '/')).text();
    assert.match(homeHtml, /id="secret-admin-trigger"/);
    assert.doesNotMatch(homeHtml, /href="\/admin\.html"/);
});

test('/admin redirects to /admin.html and /admin-login.html is public', async t => {
    const { base } = await startTestServer(t);

    const adminRedirect = await fetch(base + '/admin', { redirect: 'manual' });
    assert.equal(adminRedirect.status, 302);
    assert.equal(adminRedirect.headers.get('location'), '/admin.html');

    const loginPage = await fetch(base + '/admin-login.html');
    assert.equal(loginPage.status, 200);
    assert.match(await loginPage.text(), /id="passcode-form"/);
});

test('passcode login issues HttpOnly cookie, locks out brute-force attempts, and logout revokes session', async t => {
    const { base } = await startTestServer(t, 'correct-horse-battery');

    // 6 wrong attempts should succeed in failing 401, 7th returns 429
    for (let i = 0; i < 6; i++) {
        const bad = await fetch(base + '/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: base },
            body: JSON.stringify({ passcode: 'wrong-' + i })
        });
        assert.equal(bad.status, 401);
    }
    const locked = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ passcode: 'correct-horse-battery' })
    });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
});

test('authenticated admin CRUD, public store, coupon validation, and order stock flow work end-to-end', async t => {
    const { base } = await startTestServer(t, 'super-secret-pass');

    const loginRes = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({ passcode: 'super-secret-pass' })
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie');
    assert.match(setCookie, /azzam_admin_session=.*; Path=\/; HttpOnly; SameSite=Strict/);
    const cookie = cookieHeaderFrom(loginRes);

    // Admin dashboard HTML now served
    const adminPage = await fetch(base + '/admin.html', { headers: { Cookie: cookie } });
    assert.equal(adminPage.status, 200);
    assert.match(await adminPage.text(), /id="panel-dashboard"/);

    // Create monitor & component products
    const addMonitor = await fetch(base + '/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
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
            headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
            body: JSON.stringify({ id, type: 'component', componentType: compType, name, price, stock: 3 })
        });
        assert.equal(res.status, 200);
    }

    // Create coupon SAVE20 (20% off, min 5000)
    const addCoupon = await fetch(base + '/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
        body: JSON.stringify({ code: 'SAVE20', type: 'percent', discount: 20, minOrder: 5000, active: true })
    });
    assert.equal(addCoupon.status, 200);

    // Public store returns products & settings (without orders or sessions)
    const pubStoreRes = await fetch(base + '/api/store');
    assert.equal(pubStoreRes.status, 200);
    const pubStore = await pubStoreRes.json();
    assert.equal(pubStore.products.length, 4);
    assert.equal(pubStore.orders, undefined);

    // Validate coupon below minimum fails, above minimum succeeds
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

    // Place order with 1 monitor + 1 custom build
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

    // Stock decremented: mon-1 now 1, ordering 2 should fail 409 OUT_OF_STOCK
    const overOrder = await fetch(base + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: base },
        body: JSON.stringify({
            customer: { name: 'أحمد علي', phone: '01012345678', governorate: 'القاهرة', address: 'مدينة نصر' },
            items: [{ productId: 'mon-1', quantity: 2 }]
        })
    });
    assert.equal(overOrder.status, 409);

    // Admin updates order status
    const patchOrder = await fetch(base + '/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie },
        body: JSON.stringify({ id: order.id, status: 'confirmed' })
    });
    assert.equal(patchOrder.status, 200);
    assert.equal((await patchOrder.json()).order.status, 'confirmed');

    // Logout revokes session
    const logoutRes = await fetch(base + '/api/auth/logout', {
        method: 'POST',
        headers: { Origin: base, Cookie: cookie }
    });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(base + '/admin.html', { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(afterLogout.status, 302);
    assert.equal(afterLogout.headers.get('location'), '/admin-login.html');
});

test('production environment fails closed if Supabase or admin passcode env vars are missing', async () => {
    assert.throws(() => createStoreFromEnv({ VERCEL: '1' }), /Invalid SUPABASE_URL|SUPABASE_URL/);
    const store = createStoreFromEnv({
        NODE_ENV: 'production',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key'
    });
    await assert.rejects(() => store.getPasscode(), /AZZAM_ADMIN_PASSCODE/);
});
