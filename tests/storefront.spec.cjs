const { test, expect } = require('@playwright/test');

const svgImage = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>').toString('base64');
const products = [
    { id: 'm1', type: 'monitor', name: 'Dell شاشة 24', brand: 'Dell', price: 5000, image: svgImage, specs: { الحجم: '24 بوصة', الدقة: 'FHD' } },
    { id: 'm2', type: 'monitor', name: 'Samsung View', brand: 'Samsung', price: 6500, image: 'missing-image.jpg' },
    { id: 'm3', type: 'frameless', name: 'LG Frameless', brand: 'LG', price: 6000 },
    { id: 'm4', type: 'curved', name: 'Curve Monitor', brand: 'Acer', price: 7000 },
    { id: 'm5', type: 'gaming', name: 'Gaming Monitor', brand: 'Acer', price: 8000, specs: { التحديث: '144Hz' } },
    { id: 'l1', type: 'laptop', name: 'Dell Laptop', brand: 'Dell', price: 25000, specs: { RAM: '16GB' } },
    { id: 'l2', type: 'laptop', name: '<img src=x onerror=window.pwned=1>', brand: '<b>brand</b>', price: 1 },
    { id: 'p1', type: 'pc', name: 'Gaming PC', brand: 'Azzam', price: 30000 },
    { id: 'c1', type: 'component', componentType: 'cpu', name: 'Intel Core i5', price: 5000 },
    { id: 'c2', type: 'component', componentType: 'ram', name: '16GB RAM', price: 2000 },
    { id: 'c3', type: 'component', componentType: 'gpu', name: 'Nvidia RTX', price: 10000 }
];

async function openSeededStore(page) {
    await page.addInitScript(items => {
        if (!sessionStorage.getItem('test-seeded')) {
            localStorage.setItem('store_all_products', JSON.stringify(items));
            sessionStorage.setItem('test-seeded', 'true');
        }
    }, products);
    await page.goto('/');
}

test('empty storefront and its navigation remain useful', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.empty-state')).toHaveCount(4);
    await page.locator('#cart-nav-btn').click();
    await expect(page.locator('#drawer-title')).toHaveText('سلة التسوق');
    await expect(page.locator('.drawer-empty')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/has-dialog/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#drawer-overlay')).toBeHidden();
    await expect(page.locator('#cart-nav-btn')).toBeFocused();
});

test('search, monitor filters, safe content and keyboard product details', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await openSeededStore(page);
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(5);
    await expect(page.locator('#monitors-grid img[data-product-image]').first()).toHaveAttribute('src', svgImage);
    await expect(page.locator('#monitors-grid img[data-product-image]').nth(1)).toHaveAttribute('src', 'images/product-placeholder.svg');
    await expect(page.locator('#laptops-grid h3').last()).toHaveText('<img src=x onerror=window.pwned=1>');
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
    await page.locator('[data-filter="gaming"]').click();
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(1);
    await expect(page.locator('[data-filter="gaming"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-filter="all"]').click();
    await page.locator('#product-search').fill('شاشات');
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(5);
    await page.locator('#product-search').fill('Dell');
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(1);
    await expect(page.locator('#laptops-grid .product-card')).toHaveCount(1);
    await expect(page.locator('#search-status')).toContainText('2');
    await page.locator('#clear-search').click();
    const title = page.locator('#monitors-grid .product-title-button').first();
    await title.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#modal-product-title')).toHaveText('Dell شاشة 24');
    await page.locator('#modal-wishlist').click();
    await expect(page.locator('#wishlist-badge')).toHaveText('1');
    await expect(page.locator('#monitors-grid .product-title-button').first()).toBeFocused();
    expect(errors).toEqual([]);
});

test('wishlist, comparison limit and cart checkout', async ({ page }) => {
    await openSeededStore(page);
    await page.locator('#monitors-grid [data-action="wishlist"]').first().click();
    await page.locator('#wishlist-btn').click();
    await expect(page.locator('.drawer-item')).toHaveCount(1);
    await page.locator('[data-action="add-cart"]').click();
    await expect(page.locator('#cart-badge')).toHaveText('1');
    await page.locator('#drawer-close').click();
    for (let index = 0; index < 5; index++) {
        await page.locator('#monitors-grid [data-action="compare"]').nth(index).click();
    }
    await expect(page.locator('#compare-badge')).toHaveText('4');
    await expect(page.locator('#toast')).toContainText('٤ منتجات');
    await page.locator('#compare-btn').click();
    await expect(page.locator('.drawer-item')).toHaveCount(4);
    await page.locator('.drawer-remove').first().click();
    await expect(page.locator('#compare-badge')).toHaveText('3');
    await page.keyboard.press('Escape');
    await page.locator('#cart-nav-btn').click();
    await page.locator('[data-action="increase"]').click();
    await expect(page.locator('.drawer-total')).toContainText('10,000');
    await page.locator('[data-action="decrease"]').click();
    await expect(page.locator('.drawer-total')).toContainText('5,000');
    await page.evaluate(() => { window.openedUrls = []; window.open = url => { window.openedUrls.push(url); }; });
    await page.locator('#checkout-whatsapp').click();
    const checkoutUrl = await page.evaluate(() => window.openedUrls[0]);
    expect(checkoutUrl).toMatch(/^https:\/\/wa\.me\/201025555207\?text=/);
    expect(decodeURIComponent(checkoutUrl)).toContain('Dell شاشة 24');
    await page.reload();
    await expect(page.locator('#cart-badge')).toHaveText('1');
});

test('PC builder selects components and includes them in the WhatsApp request', async ({ page }) => {
    await openSeededStore(page);
    await expect(page.locator('#add-pc-to-cart')).toBeDisabled();
    for (const [key, name] of [['cpu', 'Intel Core i5'], ['ram', '16GB RAM'], ['gpu', 'Nvidia RTX']]) {
        await page.locator(`#select-${key}`).click();
        await expect(page.locator(`#select-${key}`)).toHaveAttribute('aria-expanded', 'true');
        await page.locator(`#opts-${key} .pc-option`).getByText(name).click();
    }
    await expect(page.locator('#pc-total-price')).toContainText('17,000');
    await expect(page.locator('#add-pc-to-cart')).toBeEnabled();
    await page.locator('#add-pc-to-cart').click();
    await page.locator('#cart-nav-btn').click();
    await expect(page.locator('.drawer-item')).toContainText('تجميعة PC مخصصة');
    await page.evaluate(() => { window.openedUrls = []; window.open = url => { window.openedUrls.push(url); }; });
    await page.locator('#checkout-whatsapp').click();
    expect(decodeURIComponent(await page.evaluate(() => window.openedUrls[0]))).toContain('Intel Core i5');
});

test('mobile navigation, viewport sizes and saved theme', async ({ page }) => {
    await openSeededStore(page);
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const sizes = await page.evaluate(() => [document.body.scrollWidth, window.innerWidth]);
        expect(sizes[0], `horizontal overflow at ${width}px`).toBe(sizes[1]);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#hamburger-btn').click();
    await expect(page.locator('#hamburger-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#main-navigation a[href="#laptops"]').click();
    await expect(page.locator('#hamburger-btn')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('assistant works on mobile and renders product names as text', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSeededStore(page);
    await page.goto('/chat-bot.html');
    await expect(page.locator('.chat-page')).toHaveCSS('border-radius', '0px');
    await page.locator('#chatInput').fill('أسعار اللابتوبات');
    await page.locator('#sendBtn').click();
    await expect(page.locator('.msg.bot').last()).toContainText('Dell Laptop');
    await expect(page.locator('.msg.bot').last()).toContainText('<img src=x onerror=window.pwned=1>');
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});


test('product updates in another tab refresh the builder selections', async ({ page, context }) => {
    await openSeededStore(page);
    await page.locator('#select-cpu').click();
    await page.locator('#opts-cpu .pc-option').click();
    await expect(page.locator('#pc-total-price')).toContainText('5,000');
    const adminTab = await context.newPage();
    await adminTab.goto('/');
    await adminTab.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('store_all_products'));
        items.find(item => item.id === 'c1').price = 7500;
        localStorage.setItem('store_all_products', JSON.stringify(items));
    });
    await expect(page.locator('#pc-total-price')).toContainText('7,500');
    await adminTab.evaluate(() => {
        const items = JSON.parse(localStorage.getItem('store_all_products'));
        localStorage.setItem('store_all_products', JSON.stringify(items.filter(item => item.id !== 'c1')));
    });
    await expect(page.locator('#select-cpu')).toHaveCount(0);
    await expect(page.locator('#pc-total-price')).toContainText('0 ج.م');
    await adminTab.close();
});
