const { test, expect } = require('@playwright/test');

test('long-pressing the store logo opens passcode login and authenticates into the admin dashboard', async ({ page }) => {
    await page.goto('/');

    // No direct admin link should be exposed in the footer.
    await expect(page.locator('footer a[href="/admin.html"]')).toHaveCount(0);

    const trigger = page.locator('#secret-admin-trigger');
    await expect(trigger).toBeVisible();

    // A short press must not navigate away from the storefront.
    await trigger.dispatchEvent('mousedown', { button: 0 });
    await page.waitForTimeout(400);
    await trigger.dispatchEvent('mouseup');
    await expect(page).toHaveURL(/\/$/);

    // Holding for 3 seconds navigates to /admin.html, which redirects unauthenticated users to /admin-login.html.
    await trigger.dispatchEvent('mousedown', { button: 0 });
    await expect(page).toHaveURL(/\/admin-login\.html$/, { timeout: 6000 });
    await expect(page.locator('#passcode-form')).toBeVisible();

    // Incorrect passcode displays an error message.
    await page.locator('#admin-passcode').fill('wrong-passcode');
    await page.locator('#login-submit').click();
    await expect(page.locator('#login-error')).toBeVisible();

    // Correct passcode logs in and opens the admin dashboard.
    await page.locator('#admin-passcode').fill('test-passcode-1234');
    await page.locator('#login-submit').click();
    await expect(page).toHaveURL(/\/admin\.html$/, { timeout: 6000 });
    await expect(page.locator('#panel-dashboard')).toBeVisible();

    // Signing out redirects back to the login page and revokes dashboard access.
    await page.locator('#admin-signout-btn').click();
    await expect(page).toHaveURL(/\/admin-login\.html$/, { timeout: 6000 });
    await page.goto('/admin.html');
    await expect(page).toHaveURL(/\/admin-login\.html$/);
});
