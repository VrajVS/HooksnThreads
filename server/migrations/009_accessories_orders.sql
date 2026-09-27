-- Accessories are the raw materials (yarn, keyrings, clips, ...) consumed when a
-- product is made. Quantities are NUMERIC so yarn can be tracked in grams/metres.
CREATE TABLE IF NOT EXISTS accessories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    unit TEXT NOT NULL DEFAULT 'pcs',
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0,
    low_stock_threshold NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_accessories (
    product_handle TEXT NOT NULL REFERENCES products (handle) ON DELETE CASCADE ON UPDATE CASCADE,
    accessory_id INTEGER NOT NULL REFERENCES accessories (id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (product_handle, accessory_id)
);

CREATE INDEX IF NOT EXISTS idx_product_accessories_accessory_id ON product_accessories (accessory_id);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('admin', 'storefront')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    customer_id INTEGER REFERENCES customer_users (id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    shipping_address TEXT,
    notes TEXT,
    subtotal INTEGER NOT NULL,
    -- True while this order's accessories are deducted from stock; the exact
    -- amounts live in inventory_movements so a cancel reverses precisely them.
    stock_deducted BOOLEAN NOT NULL DEFAULT false,
    created_by_admin_id INTEGER REFERENCES store_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_handle TEXT REFERENCES products (handle) ON DELETE SET NULL ON UPDATE CASCADE,
    title TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    accessory_id INTEGER NOT NULL REFERENCES accessories (id) ON DELETE CASCADE,
    change NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('initial', 'adjustment', 'order', 'order_cancelled')),
    order_id INTEGER REFERENCES orders (id) ON DELETE SET NULL,
    note TEXT,
    admin_id INTEGER REFERENCES store_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_accessory_id ON inventory_movements (accessory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id ON inventory_movements (order_id);
