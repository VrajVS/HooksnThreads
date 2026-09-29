-- Manual order tracking (mirrors the studio's order spreadsheet) and invoices.

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS invoice_number TEXT,
    ADD COLUMN IF NOT EXISTS order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS delivery_date DATE,
    ADD COLUMN IF NOT EXISTS charges_total INTEGER NOT NULL DEFAULT 0;

UPDATE orders SET order_date = created_at::date WHERE order_date <> created_at::date;

-- Invoice numbers are YYYYMM followed by a per-month sequence (e.g. 20251267).
WITH numbered AS (
    SELECT id,
           to_char(order_date, 'YYYYMM')
               || lpad(row_number() OVER (PARTITION BY date_trunc('month', order_date) ORDER BY created_at, id)::text, 2, '0')
               AS n
    FROM orders
    WHERE invoice_number IS NULL
)
UPDATE orders o SET invoice_number = numbered.n FROM numbered WHERE numbered.id = o.id;

ALTER TABLE orders ALTER COLUMN invoice_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders (invoice_number);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders (order_date);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS prepared BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS work_note TEXT;

-- Orders completed before progress tracking existed were made and delivered.
UPDATE order_items SET prepared = true
WHERE order_id IN (SELECT id FROM orders WHERE status = 'completed');
UPDATE orders SET delivered = true WHERE status = 'completed';

-- Wrapping, courier, discounts, cashback... Negative amounts are deductions.
CREATE TABLE IF NOT EXISTS order_charges (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    amount INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_charges_order_id ON order_charges (order_id);

CREATE TABLE IF NOT EXISTS order_payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('online', 'cash')),
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    admin_id INTEGER REFERENCES store_users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments (order_id);

-- Single-row table: the seller details printed on invoices.
CREATE TABLE IF NOT EXISTS business_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    business_name TEXT NOT NULL DEFAULT 'Hooks & Threads',
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    invoice_footer TEXT NOT NULL DEFAULT 'This is computer generated invoice',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO business_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
