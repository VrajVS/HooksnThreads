from dataclasses import dataclass
from datetime import date

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from psycopg import Connection
from psycopg.rows import dict_row

from app.inventory import (
    DEDUCTED_STATUSES,
    ShortageError,
    deduct_for_order,
    restore_for_order,
)

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    "completed": {"cancelled"},
    "cancelled": set(),
}

# The spreadsheet's colour key, derived from item/delivery/payment progress.
# Also used as a SQL filter, so both definitions must stay in step.
STAGES = ("preparation_pending", "in_progress", "delivery_pending", "payment_pending", "done", "cancelled")

ORDER_TOTALS_CTE = """
    WITH order_totals AS (
        SELECT o.*,
               o.subtotal + o.charges_total AS total,
               (SELECT COALESCE(SUM(p.amount), 0) FROM order_payments p WHERE p.order_id = o.id) AS paid,
               (SELECT count(*) FROM order_items i WHERE i.order_id = o.id) AS line_count,
               (SELECT count(*) FROM order_items i WHERE i.order_id = o.id AND i.prepared) AS prepared_count,
               (SELECT count(*) FROM order_items i
                 WHERE i.order_id = o.id AND COALESCE(btrim(i.work_note), '') <> '') AS noted_count
        FROM orders o
    ), staged AS (
        SELECT t.*,
               CASE
                   WHEN t.status = 'cancelled' THEN 'cancelled'
                   WHEN t.prepared_count = 0 AND t.noted_count = 0 THEN 'preparation_pending'
                   WHEN t.prepared_count < t.line_count THEN 'in_progress'
                   WHEN NOT t.delivered THEN 'delivery_pending'
                   WHEN t.paid < t.total THEN 'payment_pending'
                   ELSE 'done'
               END AS stage
        FROM order_totals t
    )
"""


@dataclass
class Line:
    handle: str | None
    title: str | None
    quantity: int
    unit_price: int | None


@dataclass
class Charge:
    label: str
    amount: int


def shortage_response(err: ShortageError) -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "detail": "Not enough accessory stock for this order",
            "shortages": [
                {
                    "accessory_id": s["accessory_id"],
                    "name": s["name"],
                    "unit": s["unit"],
                    "required": float(s["required"]),
                    "stock": float(s["stock"]),
                    "shortage": float(s["shortage"]),
                }
                for s in err.shortages
            ],
        },
    )


def next_invoice_number(conn: Connection, on: date) -> str:
    prefix = on.strftime("%Y%m")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(MAX(substr(invoice_number, 7)::int), 0)
            FROM orders
            WHERE invoice_number LIKE %s AND invoice_number ~ '^[0-9]{7,}$'
            """,
            (f"{prefix}%",),
        )
        seq = cur.fetchone()[0] + 1
    return f"{prefix}{seq:02d}"


def _lock_invoice_numbers(conn: Connection) -> None:
    # Serialises invoice-number allocation for the rest of the transaction.
    with conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext('orders.invoice_number'))")


def _resolve_lines(conn: Connection, lines: list[Line]) -> list[tuple[str | None, str, int, int]]:
    if not lines:
        raise HTTPException(status_code=400, detail="An order needs at least one item")
    handles = list({line.handle for line in lines if line.handle})
    products: dict[str, tuple[str, int]] = {}
    if handles:
        with conn.cursor() as cur:
            cur.execute("SELECT handle, title, price FROM products WHERE handle = ANY(%s)", (handles,))
            products = {h: (t, p) for h, t, p in cur.fetchall()}
    missing = [h for h in handles if h not in products]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown product: {', '.join(missing)}")

    resolved = []
    for line in lines:
        if line.quantity < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        title = (line.title or "").strip()
        price = line.unit_price
        if line.handle:
            product_title, product_price = products[line.handle]
            title = title or product_title
            price = product_price if price is None else price
        if not title:
            raise HTTPException(status_code=400, detail="Every item needs a description")
        if price is None or price < 0:
            raise HTTPException(status_code=400, detail=f"Enter a price for \"{title}\"")
        resolved.append((line.handle, title, price, line.quantity))
    return resolved


def _write_lines_and_charges(
    conn: Connection, order_id: int, lines: list[Line], charges: list[Charge]
) -> None:
    items = _resolve_lines(conn, lines)
    clean_charges = [(c.label.strip(), c.amount) for c in charges if c.label.strip() and c.amount]
    subtotal = sum(price * qty for _, _, price, qty in items)
    charges_total = sum(amount for _, amount in clean_charges)
    if subtotal + charges_total < 0:
        raise HTTPException(status_code=400, detail="The order total can't be negative")

    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, product_handle, title, prepared, work_note FROM order_items "
            "WHERE order_id = %s ORDER BY id",
            (order_id,),
        )
        previous = cur.fetchall()
        cur.execute("DELETE FROM order_items WHERE order_id = %s", (order_id,))
        cur.execute("DELETE FROM order_charges WHERE order_id = %s", (order_id,))

        # Keep each item's progress when an order is edited: match on
        # (product, description) in order.
        progress: dict[tuple, list[tuple[bool, str | None]]] = {}
        for _, handle, title, prepared, note in previous:
            progress.setdefault((handle, title), []).append((prepared, note))

        for handle, title, price, qty in items:
            kept = progress.get((handle, title))
            prepared, note = kept.pop(0) if kept else (False, None)
            cur.execute(
                """
                INSERT INTO order_items
                    (order_id, product_handle, title, unit_price, quantity, prepared, work_note)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (order_id, handle, title, price, qty, prepared, note),
            )
        for label, amount in clean_charges:
            cur.execute(
                "INSERT INTO order_charges (order_id, label, amount) VALUES (%s, %s, %s)",
                (order_id, label, amount),
            )
        cur.execute(
            "UPDATE orders SET subtotal = %s, charges_total = %s, updated_at = now() WHERE id = %s",
            (subtotal, charges_total, order_id),
        )


def _check_invoice_number(conn: Connection, invoice_number: str, exclude_id: int | None = None) -> str:
    invoice_number = invoice_number.strip()
    if not invoice_number:
        raise HTTPException(status_code=400, detail="Invoice number is required")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM orders WHERE invoice_number = %s AND id IS DISTINCT FROM %s",
            (invoice_number, exclude_id),
        )
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Invoice #{invoice_number} is already used")
    return invoice_number


def insert_order(
    conn: Connection,
    *,
    source: str,
    customer_name: str,
    customer_phone: str | None,
    customer_email: str | None,
    shipping_address: str | None,
    notes: str | None,
    lines: list[Line],
    charges: list[Charge] | None = None,
    order_date: date | None = None,
    invoice_number: str | None = None,
    payment_mode: str | None = None,
    customer_id: int | None = None,
    admin_id: int | None = None,
) -> int:
    """Insert a pending order and return its id. A line with a product handle
    and no price uses the product's current price."""
    order_date = order_date or date.today()
    _lock_invoice_numbers(conn)
    if invoice_number:
        invoice_number = _check_invoice_number(conn, invoice_number)
    else:
        invoice_number = next_invoice_number(conn, order_date)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO orders (source, status, invoice_number, order_date, customer_id,
                                customer_name, customer_phone, customer_email,
                                shipping_address, notes, payment_mode, subtotal, created_by_admin_id)
            VALUES (%s, 'pending', %s, %s, %s, %s, %s, %s, %s, %s, %s, 0, %s)
            RETURNING id
            """,
            (
                source,
                invoice_number,
                order_date,
                customer_id,
                customer_name,
                customer_phone,
                customer_email,
                shipping_address,
                notes,
                payment_mode,
                admin_id,
            ),
        )
        order_id = cur.fetchone()[0]
    _write_lines_and_charges(conn, order_id, lines, charges or [])
    return order_id


def update_order(
    conn: Connection,
    order_id: int,
    *,
    invoice_number: str,
    order_date: date,
    customer_name: str,
    customer_phone: str | None,
    customer_email: str | None,
    shipping_address: str | None,
    notes: str | None,
    lines: list[Line],
    charges: list[Charge],
    payment_mode: str | None,
    admin_id: int | None,
    allow_shortage: bool,
) -> None:
    """Replace an order's details, items and charges. If the order currently
    holds accessory stock, its stock is re-synced to the new items."""
    with conn.cursor() as cur:
        cur.execute("SELECT status, stock_deducted FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    status, deducted = row
    if status == "cancelled":
        raise HTTPException(status_code=400, detail="Cancelled orders can't be edited")

    _lock_invoice_numbers(conn)
    invoice_number = _check_invoice_number(conn, invoice_number, exclude_id=order_id)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT product_handle, quantity FROM order_items WHERE order_id = %s ORDER BY product_handle, quantity",
            (order_id,),
        )
        before = sorted((h or "", q) for h, q in cur.fetchall())
        cur.execute(
            """
            UPDATE orders
            SET invoice_number = %s, order_date = %s, customer_name = %s, customer_phone = %s,
                customer_email = %s, shipping_address = %s, notes = %s, payment_mode = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (invoice_number, order_date, customer_name, customer_phone, customer_email,
             shipping_address, notes, payment_mode, order_id),
        )

    stock_items_changed = before != sorted((l.handle or "", l.quantity) for l in lines)
    if deducted and stock_items_changed:
        restore_for_order(conn, order_id, admin_id)
    _write_lines_and_charges(conn, order_id, lines, charges)
    if deducted and stock_items_changed:
        deduct_for_order(conn, order_id, admin_id, allow_shortage)


def change_status(
    conn: Connection, order_id: int, new_status: str, admin_id: int | None, allow_shortage: bool
) -> None:
    """Move an order to new_status, deducting/restoring stock as needed.
    Raises ShortageError without changing anything if stock is short."""
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    current = row[0]
    if new_status == current:
        return
    if new_status not in ALLOWED_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=400, detail=f"Can't change a {current} order to {new_status}"
        )

    if new_status in DEDUCTED_STATUSES:
        deduct_for_order(conn, order_id, admin_id, allow_shortage)
    else:
        restore_for_order(conn, order_id, admin_id)

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE orders SET status = %s, updated_at = now() WHERE id = %s",
            (new_status, order_id),
        )
        if new_status == "completed":
            cur.execute("UPDATE order_items SET prepared = true WHERE order_id = %s", (order_id,))
            cur.execute(
                "UPDATE orders SET delivered = true, delivery_date = COALESCE(delivery_date, CURRENT_DATE) "
                "WHERE id = %s",
                (order_id,),
            )


def load_order(conn: Connection, order_id: int, customer_id: int | None = None) -> dict | None:
    query = f"""
        {ORDER_TOTALS_CTE}
        SELECT o.id, o.invoice_number, o.order_date, o.source, o.status, o.stage,
               o.customer_id, o.customer_name, o.customer_phone, o.customer_email,
               o.shipping_address, o.notes, o.subtotal, o.charges_total, o.total, o.paid,
               o.delivered, o.delivery_date, o.payment_mode, o.stock_deducted, o.created_at, o.updated_at,
               s.full_name AS created_by
        FROM staged o
        LEFT JOIN store_users s ON s.id = o.created_by_admin_id
        WHERE o.id = %s
    """
    params: list = [order_id]
    if customer_id is not None:
        query += " AND o.customer_id = %s"
        params.append(customer_id)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, params)
        order = cur.fetchone()
        if order is None:
            return None
        order["balance"] = order["total"] - order["paid"]
        cur.execute(
            """
            SELECT oi.id, oi.product_handle AS handle, oi.title, oi.unit_price, oi.quantity,
                   oi.prepared, oi.work_note, p.image_url AS image
            FROM order_items oi
            LEFT JOIN products p ON p.handle = oi.product_handle
            WHERE oi.order_id = %s
            ORDER BY oi.id
            """,
            (order_id,),
        )
        order["items"] = cur.fetchall()
        cur.execute(
            "SELECT id, label, amount FROM order_charges WHERE order_id = %s ORDER BY id",
            (order_id,),
        )
        order["charges"] = cur.fetchall()
        cur.execute(
            """
            SELECT p.id, p.amount, p.mode, p.paid_on, p.note, p.created_at, s.full_name AS admin_name
            FROM order_payments p
            LEFT JOIN store_users s ON s.id = p.admin_id
            WHERE p.order_id = %s
            ORDER BY p.paid_on, p.id
            """,
            (order_id,),
        )
        order["payments"] = cur.fetchall()
    return order
