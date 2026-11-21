'use strict';

const BASE = 'http://127.0.0.1:8010';

async function adminHeaders() {
    return { 'Content-Type': 'application/json', Origin: BASE };
}

async function resetServerStore() {
    const headers = await adminHeaders();
    const res = await fetch(`${BASE}/api/admin/reset`, {
        method: 'POST',
        headers,
        body: '{}'
    });
    if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
}

async function seedServerStore(products, extra = {}) {
    const headers = await adminHeaders();
    const res = await fetch(`${BASE}/api/admin/import`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            merge: false,
            data: {
                products,
                coupons: extra.coupons || [{ code: 'WELCOME10', type: 'percent', discount: 10, minOrder: 1000, active: true }],
                chatbot: extra.chatbot || { welcome: 'مرحباً!', qa: [] },
                settings: extra.settings || { name: 'Azzam Technology', phone: '201025555207', address: 'مول البستان - القاهرة' },
                orders: extra.orders || []
            }
        })
    });
    if (!res.ok) throw new Error(`Seed failed: ${res.status}`);
}

async function loginAdmin(page) {
    await page.goto('/admin.html');
}

module.exports = {
    BASE,
    resetServerStore,
    seedServerStore,
    loginAdmin
};
