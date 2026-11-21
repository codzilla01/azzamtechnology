const { test, expect } = require('@playwright/test');

test('long-pressing the store logo opens the admin dashboard directly without login', async ({ page }) => {
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

    // Holding for 3 seconds navigates directly to /admin.html without any login step.
    await trigger.dispatchEvent('mousedown', { button: 0 });
    await expect(page).toHaveURL(/\/admin\.html$/, { timeout: 6000 });
    await expect(page.locator('#panel-dashboard')).toBeVisible();
    await expect(page.locator('#admin-signout-btn')).toHaveCount(0);
});
