-- How the client pays (the spreadsheet's "Mode of payment"), set when the order
-- is taken; recorded payments carry their own mode.
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_mode TEXT
        CHECK (payment_mode IN ('online', 'cash', 'online_cash'));
