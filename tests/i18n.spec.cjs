const { test, expect } = require('@playwright/test');

const bilingualProducts = [
    {
        id: 'bilingual-monitor', type: 'monitor', name: 'شاشة ديل 24', brand: 'Dell', price: 5000,
        description: 'وصف الشاشة', specs: { الحجم: '24 بوصة', اللون: 'أسود' },
        translations: { en: { name: 'Dell 24-inch Monitor', description: 'A 24-inch display', specs: {
            الحجم: { name: 'Size', value: '24 inches' }, اللون: { name: 'Color' }
        } } }
    },
    { id: 'fallback-laptop', type: 'laptop', name: 'لابتوب بدون ترجمة', price: 12000 },
    { id: 'cpu', type: 'component', componentType: 'cpu', name: 'معالج إنتل', price: 5000, translations: { en: { name: 'Intel CPU' } } },
    { id: 'ram', type: 'component', componentType: 'ram', name: 'ذاكرة 16GB', price: 2000, translations: { en: { name: '16GB Memory' } } },
    { id: 'gpu', type: 'component', componentType: 'gpu', name: 'كرت RTX', price: 10000, translations: { en: { name: 'RTX Graphics' } } }
];

async function seed(page, products = bilingualProducts) {
    await page.addInitScript(items => {
        if (!sessionStorage.getItem('i18n-test-seeded')) {
            localStorage.setItem('store_all_products', JSON.stringify(items));
            sessionStorage.setItem('i18n-test-seeded', 'yes');
        }
    }, products);
}

async function completeLogin(page) {
    await page.locator('#login-username').fill('admin');
    await page.locator('#login-password').fill('browser-test-password-2026');
    await page.locator('#login-submit').click();
    await expect(page.locator('#panel-dashboard')).toBeVisible();
}

async function missingTranslations(page) {
    return page.evaluate(() => {
        const selectors = ['data-i18n', 'data-i18n-message', 'data-i18n-placeholder', 'data-i18n-aria-label', 'data-i18n-title', 'data-i18n-alt', 'data-i18n-data-q', 'data-i18n-content'];
        return [...new Set([...document.querySelectorAll(selectors.map(name => `[${name}]`).join(','))]
            .flatMap(element => [...element.attributes].filter(attribute => selectors.includes(attribute.name)).map(attribute => attribute.value))
            .filter(key => !window.I18n.hasTranslation(key)))];
    });
}

test('language, direction, labels and preference stay in sync across pages and reloads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.locator('#product-search').fill('غير موجود');
    await page.locator('.topbar [data-language-switch]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#hero-title')).toContainText('The right tech');
    await expect(page.locator('#product-search')).toHaveValue('غير موجود');
    await expect(page.locator('#search-status')).toContainText('Showing 0 results');
    await expect(page.locator('#product-search')).toHaveAttribute('placeholder', 'For example: monitor or Dell...');
    await expect(page.locator('#cart-nav-btn')).toHaveAttribute('aria-label', 'Cart');
    expect(await page.evaluate(() => localStorage.getItem('azzam_language'))).toBe('en');
    expect(await missingTranslations(page)).toEqual([]);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('#hero-title')).toContainText('The right tech');
    await page.goto('/chat-bot.html');
    await expect(page.locator('.quick-chip').first()).toContainText('Laptops');
    await expect(page.locator('#chatInput')).toHaveAttribute('placeholder', 'Type your question here...');
    expect(await missingTranslations(page)).toEqual([]);
    await page.locator('#chatInput').fill('unfinished question');
    await page.locator('.chat-header [data-language-switch]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#chatInput')).toHaveValue('unfinished question');
    await expect(page.locator('.quick-chip').first()).toContainText('اللابتوبات');

    await page.goto('/admin.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await page.locator('.auth-header [data-language-switch]').click();
    await expect(page.locator('#login-submit')).toContainText('Sign in');
    expect(await missingTranslations(page)).toEqual([]);
    await completeLogin(page);
    expect(await missingTranslations(page)).toEqual([]);
    await expect(page.locator('#panel-dashboard h2')).toContainText('Dashboard');
    await expect(page.locator('.stat-label').first()).toHaveText('Product');
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('localized products, search, cart and open dialogs update across tabs without mutating data', async ({ page, context }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await page.goto('/');
    await page.locator('.topbar [data-language-switch]').click();
    const card = page.locator('[data-product-id="bilingual-monitor"]');
    await expect(card.locator('h3')).toHaveText('Dell 24-inch Monitor');
    await expect(card.locator('.specs-pills')).toContainText('Size: 24 inches');
    await expect(card.locator('.specs-pills')).toContainText('Color: أسود');
    await expect(card.locator('.product-price')).toHaveText('5,000 EGP');
    await expect(page.locator('#laptops-grid h3')).toHaveText('لابتوب بدون ترجمة');
    await page.locator('#product-search').fill('24 inches');
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(1);
    await page.locator('#product-search').fill('monitors');
    await expect(page.locator('#monitors-grid .product-card')).toHaveCount(1);
    await page.locator('#clear-search').click();
    await card.locator('.add-to-cart-btn').click();
    await expect(page.locator('#cart-badge')).toHaveText('1');
    await card.locator('.product-title-button').click();
    await expect(page.locator('#modal-product-title')).toHaveText('Dell 24-inch Monitor');
    await expect(page.locator('#modal-product-details')).toContainText('A 24-inch display');

    const secondTab = await context.newPage();
    await secondTab.goto('/chat-bot.html');
    await secondTab.locator('.chat-header [data-language-switch]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('#product-modal-overlay')).toHaveClass(/open/);
    await expect(page.locator('#modal-product-title')).toHaveText('شاشة ديل 24');
    await expect(page.locator('#modal-product-details')).toContainText('وصف الشاشة');
    await page.keyboard.press('Escape');
    await expect(card.locator('.product-title-button')).toBeFocused();
    await page.locator('#cart-nav-btn').click();
    await expect(page.locator('#drawer-title')).toHaveText('سلة التسوق');
    await secondTab.locator('.chat-header [data-language-switch]').click();
    await expect(page.locator('#drawer-title')).toHaveText('Shopping cart');
    await expect(page.locator('.drawer-item h3')).toHaveText('Dell 24-inch Monitor');
    await expect(page.locator('#drawer-close')).toBeFocused();
    await page.evaluate(() => { window.openedUrls = []; window.open = url => window.openedUrls.push(url); });
    await page.locator('#checkout-whatsapp').click();
    expect(decodeURIComponent(await page.evaluate(() => window.openedUrls[0]))).toContain('Hello, I would like to order');
    expect(decodeURIComponent(await page.evaluate(() => window.openedUrls[0]))).toContain('Dell 24-inch Monitor');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('store_all_products')))).toEqual(bilingualProducts);
    expect(errors).toEqual([]);
    await secondTab.close();
});

test('PC builder keeps selections and localizes a saved build in either language', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.locator('.topbar [data-language-switch]').click();
    for (const [key, name] of [['cpu', 'Intel CPU'], ['ram', '16GB Memory'], ['gpu', 'RTX Graphics']]) {
        await page.locator(`#select-${key}`).click();
        await page.locator(`#opts-${key} .pc-option`).getByText(name).click();
    }
    await expect(page.locator('#pc-summary-list')).toContainText('Processor: Intel CPU');
    await expect(page.locator('#pc-total-price')).toContainText('17,000 EGP');
    await page.locator('.topbar [data-language-switch]').click();
    await expect(page.locator('#pc-summary-list')).toContainText('المعالج: معالج إنتل');
    await expect(page.locator('#add-pc-to-cart')).toBeEnabled();
    await page.locator('#add-pc-to-cart').click();
    await page.locator('.topbar [data-language-switch]').click();
    await page.locator('#cart-nav-btn').click();
    await expect(page.locator('.drawer-item h3')).toHaveText('Custom PC build');
    await page.evaluate(() => { window.openedUrls = []; window.open = url => window.openedUrls.push(url); });
    await page.locator('#checkout-whatsapp').click();
    const message = decodeURIComponent(await page.evaluate(() => window.openedUrls[0]));
    expect(message).toContain('Processor: Intel CPU');
    expect(message).toContain('Memory: 16GB Memory');
    const [build] = await page.evaluate(() => JSON.parse(localStorage.getItem('azzam_cart_v3')));
    expect(build.name).toBe('تجميعة PC مخصصة');
    expect(build.specs['المعالج']).toBe('معالج إنتل');
});

test('admin can add and edit optional English product data without losing in-progress inputs', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/admin.html');
    await page.locator('.auth-header [data-language-switch]').click();
    await completeLogin(page);
    await page.locator('[data-panel="add-product"]').click();
    await page.locator('#prod-name').fill('شاشة جديدة');
    await page.locator('#prod-name-en').fill('New monitor');
    await page.locator('#prod-price').fill('7500');
    await page.locator('#prod-type').selectOption('monitor');
    await page.locator('#prod-desc').fill('وصف عربي');
    await page.locator('#prod-desc-en').fill('English description');
    await page.locator('.spec-key').first().fill('الحجم');
    await page.locator('.spec-value').first().fill('24 بوصة');
    await page.locator('.spec-key-en').first().fill('Size');
    await page.locator('.spec-value-en').first().fill('24 inches');
    await page.locator('.admin-language-bar [data-language-switch]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('#prod-name')).toHaveValue('شاشة جديدة');
    await expect(page.locator('#prod-name-en')).toHaveValue('New monitor');
    await expect(page.locator('.spec-value-en').first()).toHaveValue('24 inches');
    await expect(page.locator('.spec-key-en').first()).toHaveAttribute('placeholder', 'اسم المواصفة بالإنجليزية (اختياري)');
    await page.locator('#product-form button[type="submit"]').click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('store_all_products'))[0]);
    expect(saved.name).toBe('شاشة جديدة');
    expect(saved.description).toBe('وصف عربي');
    expect(saved.translations.en).toEqual({ name: 'New monitor', description: 'English description', specs: { الحجم: { name: 'Size', value: '24 inches' } } });
    await page.locator('#products-table .edit-btn').click();
    await expect(page.locator('#prod-name-en')).toHaveValue('New monitor');
    await expect(page.locator('.spec-key-en').first()).toHaveValue('Size');
    await page.locator('#prod-name-en').fill('Updated monitor');
    await page.locator('.admin-language-bar [data-language-switch]').click();
    await expect(page.locator('#form-title')).toContainText('Edit product');
    await expect(page.locator('#prod-name-en')).toHaveValue('Updated monitor');
    await page.locator('#product-form button[type="submit"]').click();
    await expect(page.locator('#products-table tbody')).toContainText('Updated monitor');
    await page.goto('/');
    await expect(page.locator('#monitors-grid h3')).toHaveText('Updated monitor');
    await page.locator('#monitors-grid .product-title-button').click();
    await expect(page.locator('#modal-product-details')).toContainText('English description');
    await expect(page.locator('#modal-product-details')).toContainText('Size: 24 inches');
    expect(errors).toEqual([]);
});

test('editing a legacy product preserves original fields and can leave translations blank', async ({ page }) => {
    const legacy = [{ id: 'legacy', type: 'monitor', name: 'شاشة قديمة', price: 3000, stock: 8, discount: 12, specs: { الدقة: 'FHD' }, translations: { fr: { name: 'Écran' } } }];
    await seed(page, legacy);
    await page.goto('/admin.html');
    await completeLogin(page);
    await page.locator('[data-panel="products"]').click();
    await page.locator('#products-table .edit-btn').click();
    await expect(page.locator('#prod-name-en')).toHaveValue('');
    await page.locator('#prod-price').fill('3200');
    await page.locator('#product-form button[type="submit"]').click();
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('store_all_products'))[0]);
    expect(result.stock).toBe(8);
    expect(result.discount).toBe(12);
    expect(result.specs).toEqual({ الدقة: 'FHD' });
    expect(result.translations).toEqual({ fr: { name: 'Écran' } });
    await page.goto('/');
    await page.locator('.topbar [data-language-switch]').click();
    await expect(page.locator('#monitors-grid h3')).toHaveText('شاشة قديمة');
});

test('assistant understands common English questions and retains custom answers and user messages', async ({ page }) => {
    await seed(page);
    await page.addInitScript(() => localStorage.setItem('chatbot_data', JSON.stringify({ qa: [{ keywords: ['special'], response: 'رد خاص كما كُتب' }] })));
    await page.goto('/chat-bot.html');
    await page.locator('.chat-header [data-language-switch]').click();
    await page.locator('#chatInput').fill('What monitor prices are available?');
    await page.locator('#sendBtn').click();
    await expect(page.locator('.msg.bot').last()).toContainText('Monitors:');
    await expect(page.locator('.msg.bot').last()).toContainText('Dell 24-inch Monitor: 5,000 EGP');
    await page.locator('#chatInput').fill('warranty');
    await page.locator('#sendBtn').click();
    await expect(page.locator('.msg.bot').last()).toContainText('Monitors and PCs');
    await page.locator('#chatInput').fill('special');
    await page.locator('#sendBtn').click();
    await expect(page.locator('.msg.bot').last()).toHaveText('رد خاص كما كُتب');
    await page.locator('#chatInput').fill('unfinished');
    await page.locator('.chat-header [data-language-switch]').click();
    await expect(page.locator('#chatInput')).toHaveValue('unfinished');
    await expect(page.locator('.msg.user').first()).toHaveText('What monitor prices are available?');
    await expect(page.locator('.msg.bot[data-question]').first()).toContainText('شاشة ديل 24');
    await expect(page.locator('.msg.bot').last()).toHaveText('رد خاص كما كُتب');
});

test('both directions fit mobile and desktop viewports on public, login and dashboard pages', async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const path of ['/', '/chat-bot.html', '/login.html']) {
            await page.goto(path);
            for (const language of ['en', 'ar']) {
                if (await page.locator('html').getAttribute('lang') !== language) {
                    const control = path === '/' ? '.topbar [data-language-switch]' : path.includes('chat') ? '.chat-header [data-language-switch]' : '.auth-header [data-language-switch]';
                    await page.locator(control).click();
                }
                await expect(page.locator('html')).toHaveAttribute('dir', language === 'en' ? 'ltr' : 'rtl');
                const sizes = await page.evaluate(() => [document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth]);
                expect(sizes[0], `${path} ${language} html overflow at ${width}px`).toBe(width);
                expect(sizes[1], `${path} ${language} body overflow at ${width}px`).toBe(width);
            }
        }
    }
    await page.goto('/admin.html');
    await completeLogin(page);
    for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        for (const language of ['en', 'ar']) {
            if (await page.locator('html').getAttribute('lang') !== language) await page.locator('.admin-language-bar [data-language-switch]').click();
            await expect(page.locator('html')).toHaveAttribute('dir', language === 'en' ? 'ltr' : 'rtl');
            expect(await page.evaluate(() => document.documentElement.scrollWidth), `admin ${language} overflow at ${width}px`).toBe(width);
        }
    }
});

test('wishlist and comparison localize controls while translated product data stays text-only', async ({ page }) => {
    const injected = '<img src=x onerror=window.pwned=1>';
    const product = {
        id: 'safe-translation', type: 'monitor', name: 'شاشة آمنة', price: 1000, specs: { اللون: 'أحمر' },
        translations: { en: { name: injected, specs: { اللون: { name: 'Color', value: 'Red' } } } }
    };
    await seed(page, [product]);
    await page.goto('/');
    await page.locator('.topbar [data-language-switch]').click();
    const card = page.locator('[data-product-id="safe-translation"]');
    await expect(card.locator('h3')).toHaveText(injected);
    await expect(card.locator('[data-action="wishlist"]')).toHaveAttribute('aria-label', `Add to wishlist: ${injected}`);
    await card.locator('[data-action="wishlist"]').click();
    await card.locator('[data-action="compare"]').click();
    await page.locator('#wishlist-btn').click();
    await expect(page.locator('#drawer-title')).toHaveText('Wishlist');
    await expect(page.locator('.drawer-item h3')).toHaveText(injected);
    await expect(page.locator('[data-action="add-cart"]')).toContainText('Add to cart');
    await page.keyboard.press('Escape');
    await page.locator('#compare-btn').click();
    await expect(page.locator('#drawer-title')).toHaveText('Compare products');
    await expect(page.locator('.drawer-specs')).toContainText('Color: Red');
    expect(await page.evaluate(() => window.pwned)).toBeUndefined();
});

test('sign-in errors change language without sending another request', async ({ page }) => {
    let requests = 0;
    page.on('request', request => { if (request.url().endsWith('/api/auth/login')) requests++; });
    await page.goto('/admin.html');
    await page.locator('#login-username').fill('admin');
    await page.locator('#login-password').fill('wrong-password');
    await page.locator('#login-submit').click();
    await expect(page.locator('#login-error')).toContainText('غير صحيحة');
    await page.locator('.auth-header [data-language-switch]').click();
    await expect(page.locator('#login-error')).toContainText('incorrect');
    await expect(page.locator('#login-submit')).toContainText('Sign in');
    expect(requests).toBe(1);
});

test('dashboard mobile navigation mirrors correctly without losing form data', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/admin.html');
    await completeLogin(page);
    await page.locator('#mobile-menu-btn').click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    await expect.poll(async () => Math.round(await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().right))).toBe(320);
    await page.locator('[data-panel="add-product"]').click();
    await page.locator('#prod-name').fill('منتج غير محفوظ');
    await page.locator('.admin-language-bar [data-language-switch]').click();
    await expect(page.locator('#prod-name')).toHaveValue('منتج غير محفوظ');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.locator('#mobile-menu-btn').click();
    await expect.poll(async () => Math.round(await page.locator('#sidebar').evaluate(el => el.getBoundingClientRect().left))).toBe(0);
    await expect(page.locator('[data-panel="inventory"]')).toContainText('Inventory');
});
