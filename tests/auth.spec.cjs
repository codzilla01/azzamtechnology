const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { FileStore } = require('../server/store');
const { createServer } = require('../server');

async function login(page, username, password) {
    await page.locator('#login-username').fill(username);
    await page.locator('#login-password').fill(password);
    await page.locator('#login-submit').click();
}

test('first-run setup, credential changes, session revocation and sign-out work end to end', async ({ page, browser }) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azzam-auth-ui-'));
    const store = new FileStore(directory, {});
    await store.initialize();
    const initial = JSON.parse(await fs.readFile(path.join(directory, 'initial-credentials.json'), 'utf8'));
    const server = createServer(store, {});
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    const password1 = 'ui-first-strong-password-2026';
    const password2 = 'ui-next-strong-password-2026';
    try {
        await page.goto(base + '/');
        await page.evaluate(() => {
            localStorage.setItem('azzam_admin_auth', JSON.stringify({ verified: true }));
            sessionStorage.setItem('admin_verified', 'true');
        });
        await page.goto(base + '/admin.html');
        await expect(page).toHaveURL(/\/login\.html/);
        await expect(page.locator('#skip-login-btn')).toHaveCount(0);
        await login(page, initial.username, 'incorrect-password');
        await expect(page.locator('#login-error')).toContainText('غير صحيحة');
        await login(page, initial.username, initial.password);
        await expect(page.locator('#setup-view')).toBeVisible();
        await expect(page.locator('#setup-current-password')).toHaveValue(initial.password);
        await page.locator('#setup-username').fill('manager');
        await page.locator('#setup-new-password').fill(password1);
        await page.locator('#setup-confirm-password').fill(password1);
        await page.locator('#setup-submit').click();
        await expect(page.locator('#panel-dashboard')).toBeVisible();
        await expect(page.locator('#user-name-display')).toHaveText('manager');
        const cookies = await page.context().cookies(base);
        const authCookie = cookies.find(cookie => cookie.name === 'azzam_admin_session');
        expect(authCookie.httpOnly).toBe(true);
        expect(authCookie.sameSite).toBe('Strict');
        await expect.poll(async () => fs.stat(path.join(directory, 'initial-credentials.json')).then(() => true, () => false)).toBe(false);

        await other.goto(base + '/admin.html');
        await login(other, 'manager', password1);
        await expect(other.locator('#panel-dashboard')).toBeVisible();

        await page.locator('[data-panel="settings"]').click();
        await page.locator('#security-username').fill('owner');
        await page.locator('#security-current-password').fill('not-the-password');
        await page.locator('#security-new-password').fill(password2);
        await page.locator('#security-confirm-password').fill(password2);
        await page.locator('#save-credentials-btn').click();
        await expect(page.locator('#security-status')).toContainText('غير صحيحة');
        await page.locator('#security-current-password').fill(password1);
        await page.locator('#security-confirm-password').fill('another-different-password');
        await page.locator('#save-credentials-btn').click();
        await expect(page.locator('#security-status')).toContainText('غير متطابقتين');
        await page.locator('#security-confirm-password').fill(password2);
        await page.locator('#save-credentials-btn').click();
        await expect(page.locator('#security-status')).toContainText('تم تحديث');
        await expect(page.locator('#user-name-display')).toHaveText('owner');
        await expect(page.locator('#security-current-password')).toBeEmpty();
        await other.reload();
        await expect(other).toHaveURL(/\/login\.html/);
        await login(other, 'manager', password1);
        await expect(other.locator('#login-error')).toContainText('غير صحيحة');
        await login(other, 'owner', password2);
        await expect(other.locator('#panel-dashboard')).toBeVisible();

        // A username-only change keeps the current password but revokes other sessions.
        await page.locator('#security-username').fill('owner2');
        await page.locator('#security-current-password').fill(password2);
        await page.locator('#save-credentials-btn').click();
        await expect(page.locator('#user-name-display')).toHaveText('owner2');
        await other.reload();
        await expect(other).toHaveURL(/\/login\.html/);
        await login(other, 'owner2', password2);
        await expect(other.locator('#panel-dashboard')).toBeVisible();
        other.once('dialog', dialog => dialog.accept());
        await other.locator('#logout-btn').click();
        await expect(other).toHaveURL(/\/login\.html/);
        await other.goto(base + '/admin.html');
        await expect(other).toHaveURL(/\/login\.html/);
    } finally {
        await otherContext.close();
        await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        await fs.rm(directory, { recursive: true, force: true });
    }
});
