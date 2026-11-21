'use strict';

const BASE = 'http://127.0.0.1:8010';
const PASSCODE = 'test-passcode-1234';

async function adminHeaders() {
    const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: BASE },
        body: JSON.stringify({ passcode: PASSCODE })
    });
    if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    return { 'Content-Type': 'application/json', Origin: BASE, Cookie: cookie };
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
    await page.goto('/admin-login.html');
    await page.locator('#admin-passcode').fill(PASSCODE);
    await page.locator('#login-submit').click();
    await page.waitForURL(/\/admin\.html$/, { timeout: 6000 });
}

module.exports = {
    BASE,
    PASSCODE,
    resetServerStore,
    seedServerStore,
    loginAdmin
};
