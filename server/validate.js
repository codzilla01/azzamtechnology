'use strict';

const VALID_TYPES = new Set(['laptop', 'monitor', 'frameless', 'curved', 'gaming', 'pc', 'component']);
const VALID_COMPONENT_TYPES = new Set([
    'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case',
    'monitor', 'cooling', 'keyboard', 'mouse', 'headset', 'speakers', 'wifi_card'
]);
const VALID_ORDER_STATUSES = new Set(['new', 'confirmed', 'shipped', 'delivered', 'cancelled']);
const MAX_DATA_IMAGE_BYTES = 700 * 1024;

class ValidationError extends Error {
    constructor(code, status = 400, details) {
        super(code);
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

function cleanString(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function sanitizeImage(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
        if (trimmed.length > MAX_DATA_IMAGE_BYTES) throw new ValidationError('IMAGE_TOO_LARGE', 400);
        return trimmed;
    }
    if (trimmed.length <= 2048) {
        try {
            const parsed = new URL(trimmed);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return trimmed;
        } catch {
            if (/^images\/[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed;
        }
    }
    throw new ValidationError('INVALID_IMAGE', 400);
}

function sanitizeSpecs(specs) {
    if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return {};
    const out = {};
    for (const [key, value] of Object.entries(specs).slice(0, 40)) {
        const k = cleanString(key, 80);
        const v = cleanString(String(value ?? ''), 200);
        if (k && v) out[k] = v;
    }
    return out;
}

function sanitizeTranslations(translations) {
    if (!translations || typeof translations !== 'object' || Array.isArray(translations)) return {};
    const out = {};
    for (const [lang, entry] of Object.entries(translations)) {
        if (!/^[a-z]{2,5}$/i.test(lang) || !entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const cleanEntry = {};
        if (typeof entry.name === 'string' && entry.name.trim()) cleanEntry.name = cleanString(entry.name, 160);
        if (typeof entry.description === 'string' && entry.description.trim()) cleanEntry.description = cleanString(entry.description, 2000);
        if (entry.specs && typeof entry.specs === 'object' && !Array.isArray(entry.specs)) {
            const specs = {};
            for (const [specKey, specVal] of Object.entries(entry.specs).slice(0, 40)) {
                if (!specVal || typeof specVal !== 'object') continue;
                const k = cleanString(specKey, 80);
                const name = typeof specVal.name === 'string' ? cleanString(specVal.name, 80) : '';
                const value = typeof specVal.value === 'string' ? cleanString(specVal.value, 200) : '';
                if (k && (name || value)) {
                    specs[k] = { ...(name ? { name } : {}), ...(value ? { value } : {}) };
                }
            }
            if (Object.keys(specs).length) cleanEntry.specs = specs;
        }
        if (Object.keys(cleanEntry).length) out[lang.toLowerCase()] = cleanEntry;
    }
    return out;
}

function normalizeProduct(input, existing = null) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('INVALID_PRODUCT');
    const name = cleanString(input.name, 160);
    const price = Number(input.price);
    const type = cleanString(input.type, 30);
    if (!name || !Number.isFinite(price) || price <= 0 || !VALID_TYPES.has(type)) {
        throw new ValidationError('INVALID_PRODUCT');
    }

    let componentType = null;
    if (type === 'component') {
        const rawComp = cleanString(input.componentType ?? input.component_type, 30);
        componentType = rawComp === 'monitor_component' ? 'monitor' : rawComp;
        if (!VALID_COMPONENT_TYPES.has(componentType)) throw new ValidationError('INVALID_COMPONENT_TYPE');
    }

    const rawStock = input.stock === undefined || input.stock === '' || input.stock === null
        ? (existing?.stock ?? 0)
        : Number(input.stock);
    if (!Number.isFinite(rawStock) || rawStock < 0) throw new ValidationError('INVALID_STOCK');
    const stock = Math.floor(rawStock);

    let oldPrice = null;
    if (input.oldPrice !== undefined && input.oldPrice !== '' && input.oldPrice !== null) {
        const parsedOld = Number(input.oldPrice);
        if (!Number.isFinite(parsedOld) || parsedOld < 0) throw new ValidationError('INVALID_PRICE');
        if (parsedOld > price) oldPrice = Math.round(parsedOld * 100) / 100;
    }

    let discount = null;
    if (input.discount !== undefined && input.discount !== '' && input.discount !== null) {
        const parsedDiscount = Number(input.discount);
        if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) throw new ValidationError('INVALID_DISCOUNT');
        if (parsedDiscount > 0) discount = Math.round(parsedDiscount * 100) / 100;
    } else if (oldPrice && oldPrice > price) {
        discount = Math.round(((oldPrice - price) / oldPrice) * 100);
    }

    const rawId = cleanString(String(input.id ?? existing?.id ?? ''), 80);
    const id = rawId && /^[A-Za-z0-9_-]{1,80}$/.test(rawId) ? rawId : `prod_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const product = {
        id,
        type,
        name,
        brand: cleanString(input.brand, 60),
        price: Math.round(price * 100) / 100,
        oldPrice,
        discount,
        stock,
        image: sanitizeImage(input.image ?? ''),
        description: cleanString(input.description, 2000),
        specs: sanitizeSpecs(input.specs),
        translations: sanitizeTranslations(input.translations),
        createdAt: existing?.createdAt || cleanString(input.createdAt, 40) || now,
        updatedAt: now
    };
    if (componentType) product.componentType = componentType;
    return product;
}

function normalizeCoupon(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('INVALID_COUPON');
    const code = cleanString(input.code, 32).toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) throw new ValidationError('INVALID_COUPON_CODE');
    const type = input.type === 'fixed' ? 'fixed' : input.type === 'percent' ? 'percent' : '';
    if (!type) throw new ValidationError('INVALID_COUPON');
    const discount = Number(input.discount);
    if (!Number.isFinite(discount) || discount <= 0 || (type === 'percent' && discount > 100)) {
        throw new ValidationError('INVALID_COUPON_DISCOUNT');
    }
    const minOrder = input.minOrder === undefined || input.minOrder === '' || input.minOrder === null ? 0 : Number(input.minOrder);
    if (!Number.isFinite(minOrder) || minOrder < 0) throw new ValidationError('INVALID_COUPON');
    return {
        code,
        type,
        discount: Math.round(discount * 100) / 100,
        minOrder: Math.round(minOrder * 100) / 100,
        active: input.active === undefined ? true : Boolean(input.active)
    };
}

function computeCouponDiscount(coupon, subtotal) {
    if (!coupon) throw new ValidationError('COUPON_NOT_FOUND', 404);
    if (!coupon.active) throw new ValidationError('COUPON_INACTIVE', 400);
    if (subtotal < (Number(coupon.minOrder) || 0)) {
        throw new ValidationError('COUPON_MIN_ORDER', 400, { minOrder: Number(coupon.minOrder) || 0 });
    }
    const rawDiscount = coupon.type === 'percent'
        ? subtotal * (Number(coupon.discount) / 100)
        : Number(coupon.discount);
    const discountAmount = Math.min(subtotal, Math.round(Math.max(0, rawDiscount) * 100) / 100);
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    return { discountAmount, finalTotal };
}

function normalizeSettings(input, current = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('INVALID_SETTINGS');
    const phoneDigits = cleanString(input.phone, 30).replace(/[^\d+]/g, '');
    return {
        name: cleanString(input.name, 100) || current.name || 'Azzam Technology',
        phone: phoneDigits || current.phone || '201025555207',
        address: cleanString(input.address, 200),
        email: cleanString(input.email, 120),
        website: cleanString(input.website, 200)
    };
}

function normalizeChatbot(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('INVALID_CHATBOT');
    const welcome = cleanString(input.welcome, 1000);
    const qa = Array.isArray(input.qa)
        ? input.qa.slice(0, 100).map(entry => {
            if (!entry || typeof entry !== 'object') return null;
            const keywords = Array.isArray(entry.keywords)
                ? entry.keywords.map(k => cleanString(k, 60)).filter(Boolean).slice(0, 20)
                : [];
            const response = cleanString(entry.response, 1000);
            return response ? { keywords, response } : null;
        }).filter(Boolean)
        : [];
    return { welcome, qa };
}

function normalizeOrderInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('INVALID_ORDER');
    const cust = input.customer && typeof input.customer === 'object' ? input.customer : {};
    const customerName = cleanString(input.customerName ?? cust.name, 100);
    const customerPhone = cleanString(input.customerPhone ?? cust.phone, 30);
    const phoneDigits = customerPhone.replace(/\D/g, '');
    const governorate = cleanString(input.governorate ?? cust.governorate, 60);
    const address = cleanString(input.address ?? cust.address, 300);
    const notes = cleanString(input.notes ?? cust.notes, 500);
    const couponCode = cleanString(input.couponCode, 32).toUpperCase() || null;

    if (customerName.length < 2) throw new ValidationError('INVALID_CUSTOMER_NAME');
    if (phoneDigits.length < 8 || phoneDigits.length > 20) throw new ValidationError('INVALID_CUSTOMER_PHONE');
    if (governorate.length < 2) throw new ValidationError('INVALID_GOVERNORATE');
    if (address.length < 5) throw new ValidationError('INVALID_ADDRESS');

    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
        throw new ValidationError('EMPTY_CART');
    }

    const items = input.items.map(item => {
        if (!item || typeof item !== 'object') throw new ValidationError('INVALID_ORDER_ITEM');
        const quantity = Math.floor(Number(item.quantity));
        if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) throw new ValidationError('INVALID_QUANTITY');
        const rawId = item.id ?? item.productId ?? '';
        if (item.isCustomBuild || item.type === 'custom_build' || (typeof rawId === 'string' && rawId.startsWith('build_'))) {
            const componentIds = Array.isArray(item.componentIds)
                ? item.componentIds.map(id => cleanString(id, 80)).filter(Boolean)
                : [];
            if (componentIds.length < 3 || componentIds.length > 20) throw new ValidationError('INVALID_CUSTOM_BUILD');
            return { isCustomBuild: true, componentIds, quantity };
        }
        const id = cleanString(String(rawId), 80);
        if (!id) throw new ValidationError('INVALID_ORDER_ITEM');
        return { isCustomBuild: false, id, quantity };
    });

    return { customerName, customerPhone, governorate, address, notes, couponCode, items };
}

module.exports = {
    VALID_TYPES,
    VALID_COMPONENT_TYPES,
    VALID_ORDER_STATUSES,
    ValidationError,
    sanitizeImage,
    normalizeProduct,
    normalizeCoupon,
    computeCouponDiscount,
    normalizeSettings,
    normalizeChatbot,
    normalizeOrderInput
};
