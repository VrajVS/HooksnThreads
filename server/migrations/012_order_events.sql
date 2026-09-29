-- Activity log per order: stage/status changes, item progress, delivery,
-- payments and edits, with who did it and when.
CREATE TABLE IF NOT EXISTS order_events (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    from_value TEXT,
    to_value TEXT,
    detail TEXT,
    admin_id INTEGER REFERENCES store_users (id) ON DELETE SET NULL,
    -- Who acted when it wasn't an admin: 'customer', 'import', 'system'.
    actor TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events (order_id, created_at);

-- Orders that existed before tracking: when they were created, and the
-- stage they were in when tracking started.
INSERT INTO order_events (order_id, kind, to_value, detail, admin_id, actor, created_at)
SELECT o.id,
       CASE WHEN o.notes LIKE 'Imported from Crochet Orders.xlsx%' THEN 'imported' ELSE 'created' END,
       o.status,
       CASE WHEN o.notes LIKE 'Imported from Crochet Orders.xlsx%' THEN 'Imported from the order spreadsheet'
            WHEN o.source = 'storefront' THEN 'Placed on the website'
            ELSE 'Entered in the admin panel' END,
       o.created_by_admin_id,
       CASE WHEN o.notes LIKE 'Imported from Crochet Orders.xlsx%' THEN 'import'
            WHEN o.source = 'storefront' THEN 'customer' END,
       o.created_at
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = o.id);

INSERT INTO order_events (order_id, kind, to_value, detail, actor, created_at)
SELECT t.id, 'stage',
       CASE
           WHEN t.status = 'cancelled' THEN 'cancelled'
           WHEN t.prepared_count = 0 AND t.noted_count = 0 THEN 'preparation_pending'
           WHEN t.prepared_count < t.line_count THEN 'in_progress'
           WHEN NOT t.delivered THEN 'delivery_pending'
           WHEN t.paid < t.total THEN 'payment_pending'
           ELSE 'done'
       END,
       'Stage when tracking started',
       'system',
       greatest(t.updated_at, t.created_at + interval '1 second')
FROM (
    SELECT o.*,
           o.subtotal + o.charges_total AS total,
           (SELECT COALESCE(SUM(p.amount), 0) FROM order_payments p WHERE p.order_id = o.id) AS paid,
           (SELECT count(*) FROM order_items i WHERE i.order_id = o.id) AS line_count,
           (SELECT count(*) FROM order_items i WHERE i.order_id = o.id AND i.prepared) AS prepared_count,
           (SELECT count(*) FROM order_items i
             WHERE i.order_id = o.id AND COALESCE(btrim(i.work_note), '') <> '') AS noted_count
    FROM orders o
) t
WHERE NOT EXISTS (SELECT 1 FROM order_events e WHERE e.order_id = t.id AND e.kind = 'stage');
