'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SupabaseStore } = require('../server/store');

function createMockSupabaseFetch() {
    const db = {
        products: new Map(),
        coupons: new Map([['WELCOME10', { code: 'WELCOME10', type: 'percent', discount: 10, min_order: 1000, active: true }]]),
        orders: new Map(),
        store_config: new Map([
            ['settings', { key: 'settings', value: { name: 'Azzam Technology', phone: '201025555207' } }],
            ['chatbot', { key: 'chatbot', value: { welcome: 'مرحباً!', qa: [] } }]
        ]),
        admin_sessions: new Map(),
        auth_attempts: new Map()
    };

    const mockFetch = async (url, options = {}) => {
        const parsed = new URL(url);
        const table = parsed.pathname.split('/').pop();
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : null;
        const map = db[table];
        if (!map) return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });

        if (method === 'GET') {
            let rows = [...map.values()];
            for (const [key, val] of parsed.searchParams.entries()) {
                if (key === 'select' || key === 'order') continue;
                if (val.startsWith('eq.')) {
                    const target = val.slice(3);
                    rows = rows.filter(r => String(r[key]) === target);
                } else if (val.startsWith('in.(') && val.endsWith(')')) {
                    const inner = val.slice(4, -1);
                    const ids = inner.split(',').map(s => s.replace(/^"|"$/g, ''));
                    rows = rows.filter(r => ids.includes(String(r[key])));
                }
            }
            return new Response(JSON.stringify(rows), { status: 200 });
        }

        if (method === 'POST') {
            const pk = table === 'coupons' ? 'code' : table === 'store_config' ? 'key' : table === 'admin_sessions' ? 'token_hash' : table === 'auth_attempts' ? 'key' : 'id';
            const list = Array.isArray(body) ? body : [body];
            const saved = list.map(row => {
                const record = { ...row, created_at: row.created_at || new Date().toISOString(), updated_at: row.updated_at || new Date().toISOString() };
                map.set(record[pk], record);
                return record;
            });
            return new Response(JSON.stringify(saved), { status: 201 });
        }

        if (method === 'PATCH') {
            let rows = [...map.values()];
            for (const [key, val] of parsed.searchParams.entries()) {
                if (val.startsWith('eq.')) rows = rows.filter(r => String(r[key]) === val.slice(3));
            }
            const pk = table === 'coupons' ? 'code' : 'id';
            const updated = rows.map(row => {
                const next = { ...row, ...body };
                map.set(next[pk], next);
                return next;
            });
            return new Response(JSON.stringify(updated), { status: 200 });
        }

        if (method === 'DELETE') {
            let rows = [...map.values()];
            for (const [key, val] of parsed.searchParams.entries()) {
                if (val.startsWith('eq.')) rows = rows.filter(r => String(r[key]) === val.slice(3));
                else if (val.startsWith('neq.')) rows = rows.filter(r => String(r[key]) !== val.slice(4));
            }
            const pk = table === 'coupons' ? 'code' : table === 'admin_sessions' ? 'token_hash' : table === 'auth_attempts' ? 'key' : 'id';
            rows.forEach(r => map.delete(r[pk]));
            return new Response(JSON.stringify(rows), { status: 200 });
        }

        return new Response('Unsupported', { status: 400 });
    };

    return { db, mockFetch };
}

test('SupabaseStore supports CRUD, optimistic stock decrement, rollback on conflict, and sessions', async () => {
    const { db, mockFetch } = createMockSupabaseFetch();
    const store = new SupabaseStore('https://demo.supabase.co', 'service-key', { AZZAM_ADMIN_PASSCODE: 'secret-123' }, mockFetch);

    assert.equal(await store.getPasscode(), 'secret-123');

    const p1 = await store.upsertProduct({ id: 'p1', type: 'monitor', name: 'Monitor 1', price: 4000, stock: 3 });
    const p2 = await store.upsertProduct({ id: 'p2', type: 'laptop', name: 'Laptop 1', price: 20000, stock: 2 });
    assert.equal(p1.stock, 3);
    assert.equal(p2.stock, 2);

    const pub = await store.getPublicStore();
    assert.equal(pub.products.length, 2);

    // Order 1 succeeds and decrements stock
    const { order } = await store.createOrder({
        customerName: 'Nadia',
        customerPhone: '01099887766',
        governorate: 'Alexandria',
        address: 'Smouha Street 12',
        couponCode: 'WELCOME10',
        items: [{ id: 'p1', quantity: 2 }, { id: 'p2', quantity: 1 }]
    });
    assert.equal(order.subtotal, 28000);
    assert.equal(order.discountAmount, 2800);
    assert.equal(order.finalTotal, 25200);
    assert.equal(db.products.get('p1').stock, 1);
    assert.equal(db.products.get('p2').stock, 1);

    // Simulate concurrent modification on second item during order -> first item stock rolls back!
    const failingFetch = async (url, options = {}) => {
        if (options.method === 'PATCH' && String(url).includes('id=eq.p2')) {
            return new Response(JSON.stringify([]), { status: 200 });
        }
        return mockFetch(url, options);
    };
    const racingStore = new SupabaseStore('https://demo.supabase.co', 'service-key', { AZZAM_ADMIN_PASSCODE: 'secret-123' }, failingFetch);
    await assert.rejects(() => racingStore.createOrder({
        customerName: 'Nadia',
        customerPhone: '01099887766',
        governorate: 'Alexandria',
        address: 'Smouha Street 12',
        items: [{ id: 'p1', quantity: 1 }, { id: 'p2', quantity: 1 }]
    }), err => err.code === 'INSUFFICIENT_STOCK');
    assert.equal(db.products.get('p1').stock, 1, 'p1 stock must roll back to 1');

    // Sessions & attempts
    await store.putSession('hash-abc', 3600);
    const sess = await store.getSession('hash-abc');
    assert.ok(sess && sess.expires > Date.now());
    await store.deleteSession('hash-abc');
    assert.equal(await store.getSession('hash-abc'), null);

    const a1 = await store.takeAttempt('k1', 2, 60);
    assert.equal(a1.allowed, true);
    const a2 = await store.takeAttempt('k1', 2, 60);
    assert.equal(a2.allowed, true);
    const a3 = await store.takeAttempt('k1', 2, 60);
    assert.equal(a3.allowed, false);
});
