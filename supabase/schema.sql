-- Azzam Technology Storefront Schema for Supabase (PostgreSQL)
-- Run this once in your Supabase SQL Editor before deploying.

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('laptop', 'monitor', 'frameless', 'curved', 'gaming', 'pc', 'component')),
    component_type TEXT,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    old_price NUMERIC(12, 2) CHECK (old_price IS NULL OR old_price >= 0),
    discount NUMERIC(5, 2) CHECK (discount IS NULL OR (discount >= 0 AND discount <= 100)),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    specs JSONB NOT NULL DEFAULT '{}'::jsonb,
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_type_idx ON public.products (type);

CREATE TABLE IF NOT EXISTS public.coupons (
    code TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
    discount NUMERIC(12, 2) NOT NULL CHECK (discount > 0),
    min_order NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    governorate TEXT NOT NULL,
    address TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    items JSONB NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    final_total NUMERIC(12, 2) NOT NULL CHECK (final_total >= 0),
    coupon_code TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);

CREATE TABLE IF NOT EXISTS public.store_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON public.admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.auth_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Enable Row Level Security with no public policies; server routes use SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

INSERT INTO public.store_config (key, value)
VALUES
    ('settings', '{"name":"Azzam Technology","phone":"201025555207","address":"مول البستان - القاهرة","email":"info@azzamtechnology.com","website":"azzamtechnology.vercel.app"}'::jsonb),
    ('chatbot', '{"welcome":"👋 مرحباً! أنا مساعد Azzam Technology. اسألني عن الأسعار، المواصفات، التجميع، أو أي استفسار!","qa":[]}'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.coupons (code, type, discount, min_order, active)
VALUES ('WELCOME10', 'percent', 10, 1000, TRUE)
ON CONFLICT (code) DO NOTHING;
