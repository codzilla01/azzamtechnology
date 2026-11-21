'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
    VALID_ORDER_STATUSES,
    ValidationError,
    normalizeProduct,
    normalizeCoupon,
    computeCouponDiscount,
    normalizeSettings,
    normalizeChatbot,
    normalizeOrderInput
} = require('./validate');

class StorageError extends Error {
    constructor(message = 'Store storage unavailable') {
        super(message);
        this.code = 'STORAGE_UNAVAILABLE';
        this.status = 503;
    }
}

const DEFAULT_SETTINGS = {
    name: 'Azzam Technology',
    phone: '201025555207',
    address: 'مول البستان - القاهرة',
    email: 'info@azzamtechnology.com',
    website: 'azzamtechnology.vercel.app'
};

const DEFAULT_CHATBOT = {
    welcome: '👋 مرحباً! أنا مساعد Azzam Technology. اسألني عن الأسعار، المواصفات، التجميع، أو أي استفسار!',
    qa: []
};

const DEFAULT_COUPONS = [
    { code: 'WELCOME10', type: 'percent', discount: 10, minOrder: 1000, active: true }
];

function buildOrderFromProducts(orderInput, productMap, coupon) {
    const neededQty = new Map();
    const orderItems = [];
    let subtotal = 0;

    for (const item of orderInput.items) {
        if (item.isCustomBuild) {
            let buildUnitPrice = 0;
            const specs = {};
            const enSpecs = {};
            for (const compId of item.componentIds) {
                const comp = productMap.get(compId);
                if (!comp || comp.type !== 'component') {
                    throw new ValidationError('PRODUCT_NOT_FOUND', 404, { id: compId });
                }
                neededQty.set(compId, (neededQty.get(compId) || 0) + item.quantity);
                buildUnitPrice += Number(comp.price) || 0;
                const label = comp.componentType || 'component';
                const specKey = specs[label] ? `${label} (${comp.id})` : label;
                specs[specKey] = comp.name;
                enSpecs[specKey] = {
                    name: label,
                    value: comp.translations?.en?.name || comp.name
                };
            }
            buildUnitPrice = Math.round(buildUnitPrice * 100) / 100;
            const lineTotal = Math.round(buildUnitPrice * item.quantity * 100) / 100;
            subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
            orderItems.push({
                id: `build_${crypto.randomBytes(4).toString('hex')}`,
                isCustomBuild: true,
                componentIds: item.componentIds,
                name: 'تجميعة PC مخصصة',
                translations: { en: { name: 'Custom PC build', specs: enSpecs } },
                specs,
                unitPrice: buildUnitPrice,
                quantity: item.quantity,
                lineTotal
            });
        } else {
            const product = productMap.get(item.id);
            if (!product) throw new ValidationError('PRODUCT_NOT_FOUND', 404, { id: item.id });
            neededQty.set(item.id, (neededQty.get(item.id) || 0) + item.quantity);
            const unitPrice = Number(product.price) || 0;
            const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
            subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
            orderItems.push({
                id: product.id,
                isCustomBuild: false,
                name: product.name,
                translations: product.translations?.en?.name ? { en: { name: product.translations.en.name } } : {},
                unitPrice,
                quantity: item.quantity,
                lineTotal
            });
        }
    }

    for (const [productId, required] of neededQty.entries()) {
        const product = productMap.get(productId);
        const available = Number(product.stock) || 0;
        if (available <= 0) {
            throw new ValidationError('OUT_OF_STOCK', 409, { id: productId, name: product.name, available: 0 });
        }
        if (required > available) {
            throw new ValidationError('INSUFFICIENT_STOCK', 409, { id: productId, name: product.name, available });
        }
    }

    let discountAmount = 0;
    let finalTotal = subtotal;
    let appliedCoupon = null;
    if (orderInput.couponCode) {
        ({ discountAmount, finalTotal } = computeCouponDiscount(coupon, subtotal));
        appliedCoupon = coupon.code;
    }

    const order = {
        id: `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
        customerName: orderInput.customerName,
        customerPhone: orderInput.customerPhone,
        governorate: orderInput.governorate,
        address: orderInput.address,
        notes: orderInput.notes,
        items: orderItems,
        subtotal,
        discountAmount,
        finalTotal,
        couponCode: appliedCoupon,
        status: 'new',
        createdAt: new Date().toISOString()
    };

    return { order, neededQty };
}

class FileStore {
    constructor(directory, env = process.env) {
        this.directory = path.resolve(directory);
        this.env = env;
        this.dataPath = path.join(this.directory, 'store-data.json');
        this.attempts = new Map();
        this.initialization = null;
        this.writeQueue = Promise.resolve();
    }

    async initialize() {
        if (!this.initialization) {
            this.initialization = this.bootstrap().catch(error => {
                this.initialization = null;
                throw error;
            });
        }
        await this.initialization;
    }

    async bootstrap() {
        await fs.mkdir(this.directory, { recursive: true, mode: 0o700 });
        const realDir = await fs.realpath(this.directory);
        const projectRoot = await fs.realpath(path.join(__dirname, '..'));
        if (realDir === projectRoot || realDir.startsWith(projectRoot + path.sep)) {
            throw new StorageError('AZZAM_DATA_DIR must be outside the project directory');
        }
        await fs.chmod(this.directory, 0o700);

        try {
            await fs.access(this.dataPath);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            const initial = {
                products: [],
                coupons: DEFAULT_COUPONS.map(c => ({ ...c })),
                orders: [],
                settings: { ...DEFAULT_SETTINGS },
                chatbot: { ...DEFAULT_CHATBOT, qa: [] }
            };
            await fs.writeFile(this.dataPath, JSON.stringify(initial, null, 2) + '\n', { flag: 'wx', mode: 0o600 }).catch(err => {
                if (err.code !== 'EEXIST') throw err;
            });
        }
    }

    async readData() {
        await this.initialize();
        const raw = await fs.readFile(this.dataPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            products: Array.isArray(parsed.products) ? parsed.products : [],
            coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [],
            orders: Array.isArray(parsed.orders) ? parsed.orders : [],
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            chatbot: { ...DEFAULT_CHATBOT, ...(parsed.chatbot || {}), qa: Array.isArray(parsed.chatbot?.qa) ? parsed.chatbot.qa : [] }
        };
    }

    async writeData(data) {
        const tmp = `${this.dataPath}.${crypto.randomBytes(8).toString('hex')}.tmp`;
        try {
            await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
            await fs.rename(tmp, this.dataPath);
        } finally {
            await fs.unlink(tmp).catch(err => { if (err.code !== 'ENOENT') throw err; });
        }
    }

    serialize(fn) {
        const job = this.writeQueue.then(async () => {
            const data = await this.readData();
            return fn(data);
        });
        this.writeQueue = job.catch(() => {});
        return job;
    }

    async getPublicStore() {
        const data = await this.readData();
        return { products: data.products, settings: data.settings, chatbot: data.chatbot };
    }

    async getAdminData() {
        return this.readData();
    }

    async upsertProduct(input) {
        return this.serialize(async data => {
            const index = input?.id ? data.products.findIndex(p => String(p.id) === String(input.id)) : -1;
            const existing = index >= 0 ? data.products[index] : null;
            const product = normalizeProduct(input, existing);
            if (index >= 0) data.products[index] = product;
            else data.products.push(product);
            await this.writeData(data);
            return product;
        });
    }

    async deleteProduct(id) {
        return this.serialize(async data => {
            const before = data.products.length;
            data.products = data.products.filter(p => String(p.id) !== String(id));
            if (data.products.length === before) throw new ValidationError('PRODUCT_NOT_FOUND', 404);
            await this.writeData(data);
            return true;
        });
    }

    async getCoupon(code) {
        const data = await this.readData();
        const normalized = String(code || '').trim().toUpperCase();
        return data.coupons.find(c => c.code.toUpperCase() === normalized) || null;
    }

    async upsertCoupon(input) {
        return this.serialize(async data => {
            const coupon = normalizeCoupon(input);
            const index = data.coupons.findIndex(c => c.code.toUpperCase() === coupon.code);
            if (index >= 0) data.coupons[index] = coupon;
            else data.coupons.push(coupon);
            await this.writeData(data);
            return coupon;
        });
    }

    async deleteCoupon(code) {
        return this.serialize(async data => {
            const normalized = String(code || '').trim().toUpperCase();
            const before = data.coupons.length;
            data.coupons = data.coupons.filter(c => c.code.toUpperCase() !== normalized);
            if (data.coupons.length === before) throw new ValidationError('COUPON_NOT_FOUND', 404);
            await this.writeData(data);
            return true;
        });
    }

    async saveSettings(input) {
        return this.serialize(async data => {
            data.settings = normalizeSettings(input, data.settings);
            await this.writeData(data);
            return data.settings;
        });
    }

    async saveChatbot(input) {
        return this.serialize(async data => {
            data.chatbot = normalizeChatbot(input);
            await this.writeData(data);
            return data.chatbot;
        });
    }

    async createOrder(rawInput) {
        return this.serialize(async data => {
            const orderInput = normalizeOrderInput(rawInput);
            const productMap = new Map(data.products.map(p => [String(p.id), p]));
            const coupon = orderInput.couponCode
                ? data.coupons.find(c => c.code.toUpperCase() === orderInput.couponCode) || null
                : null;
            const { order, neededQty } = buildOrderFromProducts(orderInput, productMap, coupon);

            for (const [productId, required] of neededQty.entries()) {
                const product = productMap.get(productId);
                product.stock = Math.max(0, (Number(product.stock) || 0) - required);
                product.updatedAt = order.createdAt;
            }

            data.orders.unshift(order);
            await this.writeData(data);
            return { order, whatsappPhone: data.settings.phone || DEFAULT_SETTINGS.phone };
        });
    }

    async updateOrderStatus(id, status) {
        if (!VALID_ORDER_STATUSES.has(status)) throw new ValidationError('INVALID_ORDER_STATUS');
        return this.serialize(async data => {
            const order = data.orders.find(o => o.id === id);
            if (!order) throw new ValidationError('ORDER_NOT_FOUND', 404);
            order.status = status;
            await this.writeData(data);
            return order;
        });
    }

    async clearOrders() {
        return this.serialize(async data => {
            data.orders = [];
            await this.writeData(data);
            return true;
        });
    }

    async importData(payload, merge = false) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ValidationError('INVALID_IMPORT');
        return this.serialize(async data => {
            if (Array.isArray(payload.products)) {
                const imported = payload.products.map(p => normalizeProduct(p));
                if (merge) {
                    const map = new Map(data.products.map(p => [p.id, p]));
                    for (const p of imported) map.set(p.id, p);
                    data.products = [...map.values()];
                } else {
                    data.products = imported;
                }
            }
            if (Array.isArray(payload.coupons)) {
                data.coupons = payload.coupons.map(c => normalizeCoupon(c));
            }
            if (payload.chatbot && typeof payload.chatbot === 'object') {
                data.chatbot = normalizeChatbot(payload.chatbot);
            }
            if (payload.settings && typeof payload.settings === 'object') {
                data.settings = normalizeSettings(payload.settings, data.settings);
            }
            await this.writeData(data);
            return data;
        });
    }

    async resetData() {
        return this.serialize(async data => {
            data.products = [];
            data.coupons = DEFAULT_COUPONS.map(c => ({ ...c }));
            data.orders = [];
            data.chatbot = { ...DEFAULT_CHATBOT, qa: [] };
            await this.writeData(data);
            return data;
        });
    }

    async takeAttempt(key, limit, windowSeconds) {
        const now = Date.now();
        let entry = this.attempts.get(key);
        if (!entry || entry.expires <= now) entry = { count: 0, expires: now + windowSeconds * 1000 };
        entry.count += 1;
        this.attempts.set(key, entry);
        if (this.attempts.size > 1000) {
            for (const [oldKey, value] of this.attempts) if (value.expires <= now) this.attempts.delete(oldKey);
        }
        return { allowed: entry.count <= limit, retryAfter: Math.max(1, Math.ceil((entry.expires - now) / 1000)) };
    }

    async clearAttempts(key) {
        this.attempts.delete(key);
    }
}

function toProductRow(product) {
    return {
        id: product.id,
        type: product.type,
        component_type: product.componentType || null,
        name: product.name,
        brand: product.brand || '',
        price: product.price,
        old_price: product.oldPrice ?? null,
        discount: product.discount ?? null,
        stock: product.stock ?? 0,
        image: product.image || '',
        description: product.description || '',
        specs: product.specs || {},
        translations: product.translations || {},
        created_at: product.createdAt || new Date().toISOString(),
        updated_at: product.updatedAt || new Date().toISOString()
    };
}

function fromProductRow(row) {
    const product = {
        id: row.id,
        type: row.type,
        name: row.name,
        brand: row.brand || '',
        price: Number(row.price),
        oldPrice: row.old_price !== null && row.old_price !== undefined ? Number(row.old_price) : null,
        discount: row.discount !== null && row.discount !== undefined ? Number(row.discount) : null,
        stock: Number(row.stock) || 0,
        image: row.image || '',
        description: row.description || '',
        specs: row.specs || {},
        translations: row.translations || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
    if (row.component_type) product.componentType = row.component_type;
    return product;
}

function toCouponRow(coupon) {
    return {
        code: coupon.code,
        type: coupon.type,
        discount: coupon.discount,
        min_order: coupon.minOrder || 0,
        active: Boolean(coupon.active)
    };
}

function fromCouponRow(row) {
    return {
        code: row.code,
        type: row.type,
        discount: Number(row.discount),
        minOrder: Number(row.min_order) || 0,
        active: Boolean(row.active)
    };
}

function toOrderRow(order) {
    return {
        id: order.id,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        governorate: order.governorate,
        address: order.address,
        notes: order.notes || '',
        items: order.items,
        subtotal: order.subtotal,
        discount_amount: order.discountAmount,
        final_total: order.finalTotal,
        coupon_code: order.couponCode || null,
        status: order.status,
        created_at: order.createdAt
    };
}

function fromOrderRow(row) {
    return {
        id: row.id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        governorate: row.governorate,
        address: row.address,
        notes: row.notes || '',
        items: Array.isArray(row.items) ? row.items : [],
        subtotal: Number(row.subtotal),
        discountAmount: Number(row.discount_amount) || 0,
        finalTotal: Number(row.final_total),
        couponCode: row.coupon_code || null,
        status: row.status,
        createdAt: row.created_at
    };
}

class SupabaseStore {
    constructor(url, serviceKey, env = process.env, fetchImpl = fetch) {
        let parsed;
        try { parsed = new URL(url); } catch { throw new StorageError('Invalid SUPABASE_URL'); }
        const localHttp = parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
        if ((parsed.protocol !== 'https:' && !localHttp) || !serviceKey) {
            throw new StorageError('SUPABASE_URL (HTTPS) and SUPABASE_SERVICE_ROLE_KEY are required');
        }
        this.baseUrl = parsed.origin + '/rest/v1';
        this.serviceKey = serviceKey;
        this.env = env;
        this.fetch = fetchImpl;
    }

    async rest(endpoint, { method = 'GET', body, prefer, headers = {} } = {}) {
        let response;
        try {
            response = await this.fetch(`${this.baseUrl}/${endpoint}`, {
                method,
                headers: {
                    apikey: this.serviceKey,
                    Authorization: `Bearer ${this.serviceKey}`,
                    'Content-Type': 'application/json',
                    ...(prefer ? { Prefer: prefer } : {}),
                    ...headers
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
                signal: AbortSignal.timeout(8000)
            });
        } catch (error) {
            throw new StorageError('Database unavailable');
        }
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new StorageError(`Database request failed (${response.status}): ${text.slice(0, 120)}`);
        }
        if (response.status === 204) return null;
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }

    async getConfigMap() {
        const rows = await this.rest('store_config?select=key,value');
        const map = new Map((rows || []).map(r => [r.key, r.value]));
        return {
            settings: { ...DEFAULT_SETTINGS, ...(map.get('settings') || {}) },
            chatbot: { ...DEFAULT_CHATBOT, ...(map.get('chatbot') || {}), qa: Array.isArray(map.get('chatbot')?.qa) ? map.get('chatbot').qa : [] }
        };
    }

    async getPublicStore() {
        const [productRows, config] = await Promise.all([
            this.rest('products?select=*&order=created_at.asc'),
            this.getConfigMap()
        ]);
        return {
            products: (productRows || []).map(fromProductRow),
            settings: config.settings,
            chatbot: config.chatbot
        };
    }

    async getAdminData() {
        const [productRows, couponRows, orderRows, config] = await Promise.all([
            this.rest('products?select=*&order=created_at.asc'),
            this.rest('coupons?select=*&order=created_at.desc'),
            this.rest('orders?select=*&order=created_at.desc'),
            this.getConfigMap()
        ]);
        return {
            products: (productRows || []).map(fromProductRow),
            coupons: (couponRows || []).map(fromCouponRow),
            orders: (orderRows || []).map(fromOrderRow),
            settings: config.settings,
            chatbot: config.chatbot
        };
    }

    async upsertProduct(input) {
        let existing = null;
        if (input?.id) {
            const rows = await this.rest(`products?id=eq.${encodeURIComponent(String(input.id))}&select=*`);
            if (rows && rows[0]) existing = fromProductRow(rows[0]);
        }
        const product = normalizeProduct(input, existing);
        const rows = await this.rest('products?on_conflict=id', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=representation',
            body: toProductRow(product)
        });
        return fromProductRow(rows[0]);
    }

    async deleteProduct(id) {
        const rows = await this.rest(`products?id=eq.${encodeURIComponent(String(id))}`, {
            method: 'DELETE',
            prefer: 'return=representation'
        });
        if (!rows || rows.length === 0) throw new ValidationError('PRODUCT_NOT_FOUND', 404);
        return true;
    }

    async getCoupon(code) {
        const normalized = String(code || '').trim().toUpperCase();
        if (!normalized) return null;
        const rows = await this.rest(`coupons?code=eq.${encodeURIComponent(normalized)}&select=*`);
        return rows && rows[0] ? fromCouponRow(rows[0]) : null;
    }

    async upsertCoupon(input) {
        const coupon = normalizeCoupon(input);
        const rows = await this.rest('coupons?on_conflict=code', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=representation',
            body: toCouponRow(coupon)
        });
        return fromCouponRow(rows[0]);
    }

    async deleteCoupon(code) {
        const normalized = String(code || '').trim().toUpperCase();
        const rows = await this.rest(`coupons?code=eq.${encodeURIComponent(normalized)}`, {
            method: 'DELETE',
            prefer: 'return=representation'
        });
        if (!rows || rows.length === 0) throw new ValidationError('COUPON_NOT_FOUND', 404);
        return true;
    }

    async saveSettings(input) {
        const { settings: current } = await this.getConfigMap();
        const settings = normalizeSettings(input, current);
        await this.rest('store_config?on_conflict=key', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: { key: 'settings', value: settings, updated_at: new Date().toISOString() }
        });
        return settings;
    }

    async saveChatbot(input) {
        const chatbot = normalizeChatbot(input);
        await this.rest('store_config?on_conflict=key', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: { key: 'chatbot', value: chatbot, updated_at: new Date().toISOString() }
        });
        return chatbot;
    }

    async createOrder(rawInput) {
        const orderInput = normalizeOrderInput(rawInput);
        const ids = [...new Set(orderInput.items.flatMap(item => item.isCustomBuild ? item.componentIds : [item.id]))];
        const idFilter = ids.map(id => `"${id.replace(/"/g, '')}"`).join(',');
        const [productRows, coupon, config] = await Promise.all([
            this.rest(`products?id=in.(${encodeURIComponent(idFilter)})&select=*`),
            orderInput.couponCode ? this.getCoupon(orderInput.couponCode) : Promise.resolve(null),
            this.getConfigMap()
        ]);
        const productMap = new Map((productRows || []).map(row => {
            const p = fromProductRow(row);
            return [p.id, p];
        }));

        const { order, neededQty } = buildOrderFromProducts(orderInput, productMap, coupon);

        const decremented = [];
        try {
            for (const [productId, required] of neededQty.entries()) {
                const product = productMap.get(productId);
                const oldStock = Number(product.stock) || 0;
                const nextStock = oldStock - required;
                const updated = await this.rest(
                    `products?id=eq.${encodeURIComponent(productId)}&stock=eq.${oldStock}`,
                    {
                        method: 'PATCH',
                        prefer: 'return=representation',
                        body: { stock: nextStock, updated_at: order.createdAt }
                    }
                );
                if (!updated || updated.length === 0) {
                    throw new ValidationError('INSUFFICIENT_STOCK', 409, { id: productId, name: product.name });
                }
                decremented.push({ productId, oldStock, nextStock });
            }

            const inserted = await this.rest('orders', {
                method: 'POST',
                prefer: 'return=representation',
                body: toOrderRow(order)
            });
            return {
                order: fromOrderRow(inserted[0]),
                whatsappPhone: config.settings.phone || DEFAULT_SETTINGS.phone
            };
        } catch (error) {
            // Best-effort rollback of already-decremented stock if order creation fails.
            await Promise.allSettled(decremented.map(entry =>
                this.rest(`products?id=eq.${encodeURIComponent(entry.productId)}&stock=eq.${entry.nextStock}`, {
                    method: 'PATCH',
                    body: { stock: entry.oldStock }
                })
            ));
            throw error;
        }
    }

    async updateOrderStatus(id, status) {
        if (!VALID_ORDER_STATUSES.has(status)) throw new ValidationError('INVALID_ORDER_STATUS');
        const rows = await this.rest(`orders?id=eq.${encodeURIComponent(String(id))}`, {
            method: 'PATCH',
            prefer: 'return=representation',
            body: { status }
        });
        if (!rows || rows.length === 0) throw new ValidationError('ORDER_NOT_FOUND', 404);
        return fromOrderRow(rows[0]);
    }

    async clearOrders() {
        await this.rest('orders?id=neq.', { method: 'DELETE' });
        return true;
    }

    async importData(payload, merge = false) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new ValidationError('INVALID_IMPORT');
        if (Array.isArray(payload.products)) {
            const normalized = payload.products.map(p => normalizeProduct(p));
            if (!merge) {
                await this.rest('products?id=neq.', { method: 'DELETE' });
            }
            if (normalized.length) {
                await this.rest('products?on_conflict=id', {
                    method: 'POST',
                    prefer: 'resolution=merge-duplicates',
                    body: normalized.map(toProductRow)
                });
            }
        }
        if (Array.isArray(payload.coupons)) {
            const normalizedCoupons = payload.coupons.map(c => normalizeCoupon(c));
            await this.rest('coupons?code=neq.', { method: 'DELETE' });
            if (normalizedCoupons.length) {
                await this.rest('coupons?on_conflict=code', {
                    method: 'POST',
                    prefer: 'resolution=merge-duplicates',
                    body: normalizedCoupons.map(toCouponRow)
                });
            }
        }
        if (payload.chatbot && typeof payload.chatbot === 'object') {
            await this.saveChatbot(payload.chatbot);
        }
        if (payload.settings && typeof payload.settings === 'object') {
            await this.saveSettings(payload.settings);
        }
        return this.getAdminData();
    }

    async resetData() {
        await Promise.all([
            this.rest('products?id=neq.', { method: 'DELETE' }),
            this.rest('orders?id=neq.', { method: 'DELETE' }),
            this.rest('coupons?code=neq.', { method: 'DELETE' })
        ]);
        await Promise.all([
            this.rest('coupons?on_conflict=code', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates',
                body: DEFAULT_COUPONS.map(toCouponRow)
            }),
            this.saveChatbot({ ...DEFAULT_CHATBOT, qa: [] })
        ]);
        return this.getAdminData();
    }

    async takeAttempt(key, limit, windowSeconds) {
        const now = Date.now();
        const rows = await this.rest(`auth_attempts?key=eq.${encodeURIComponent(key)}&select=key,count,expires_at`);
        const current = rows && rows[0];
        let count = 1;
        let expiresAtMs = now + windowSeconds * 1000;
        if (current && new Date(current.expires_at).getTime() > now) {
            count = Number(current.count) + 1;
            expiresAtMs = new Date(current.expires_at).getTime();
        }
        await this.rest('auth_attempts?on_conflict=key', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates',
            body: { key, count, expires_at: new Date(expiresAtMs).toISOString() }
        });
        return {
            allowed: count <= limit,
            retryAfter: Math.max(1, Math.ceil((expiresAtMs - now) / 1000))
        };
    }

    async clearAttempts(key) {
        await this.rest(`auth_attempts?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
    }
}

function createStoreFromEnv(env = process.env) {
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (url || key || env.VERCEL || env.AZZAM_STORE === 'supabase') {
        return new SupabaseStore(url, key, env);
    }
    return new FileStore(env.AZZAM_DATA_DIR || path.join(os.homedir(), '.azzamtechnology'), env);
}

module.exports = {
    FileStore,
    SupabaseStore,
    StorageError,
    DEFAULT_SETTINGS,
    DEFAULT_CHATBOT,
    DEFAULT_COUPONS,
    createStoreFromEnv
};
