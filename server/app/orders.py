from fastapi import HTTPException
from fastapi.responses import JSONResponse
from psycopg import Connection
from psycopg.rows import dict_row

from app.inventory import DEDUCTED_STATUSES, ShortageError, deduct_for_order, restore_for_order

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"confirmed", "cancelled"},
    "confirmed": {"completed", "cancelled"},
    "completed": {"cancelled"},
    "cancelled": set(),
}


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


def insert_order(
    conn: Connection,
    *,
    source: str,
    customer_name: str,
    customer_phone: str | None,
    customer_email: str | None,
    shipping_address: str | None,
    notes: str | None,
    lines: list[tuple[str, int, int | None]],
    customer_id: int | None = None,
    admin_id: int | None = None,
) -> int:
    """Insert a pending order. `lines` is [(handle, quantity, unit_price or None)];
    a None price uses the product's current price. Returns the order id."""
    if not lines:
        raise HTTPException(status_code=400, detail="An order needs at least one item")

    handles = list({h for h, _, _ in lines})
    with conn.cursor() as cur:
        cur.execute(
            "SELECT handle, title, price FROM products WHERE handle = ANY(%s)", (handles,)
        )
        products = {h: (t, p) for h, t, p in cur.fetchall()}
    missing = [h for h in handles if h not in products]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unknown product: {', '.join(missing)}")

    items = []
    for handle, qty, price in lines:
        if qty < 1:
            raise HTTPException(status_code=400, detail="Quantity must be at least 1")
        title, current_price = products[handle]
        unit_price = current_price if price is None else price
        if unit_price < 0:
            raise HTTPException(status_code=400, detail="Price can't be negative")
        items.append((handle, title, unit_price, qty))
    subtotal = sum(price * qty for _, _, price, qty in items)

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO orders (source, status, customer_id, customer_name, customer_phone,
                                customer_email, shipping_address, notes, subtotal,
                                created_by_admin_id)
            VALUES (%s, 'pending', %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                source,
                customer_id,
                customer_name,
                customer_phone,
                customer_email,
                shipping_address,
                notes,
                subtotal,
                admin_id,
            ),
        )
        order_id = cur.fetchone()[0]
        for handle, title, unit_price, qty in items:
            cur.execute(
                """
                INSERT INTO order_items (order_id, product_handle, title, unit_price, quantity)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (order_id, handle, title, unit_price, qty),
            )
    return order_id


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


def load_order(conn: Connection, order_id: int, customer_id: int | None = None) -> dict | None:
    query = """
        SELECT o.id, o.source, o.status, o.customer_id, o.customer_name, o.customer_phone,
               o.customer_email, o.shipping_address, o.notes, o.subtotal, o.stock_deducted,
               o.created_at, o.updated_at, s.full_name AS created_by
        FROM orders o
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
        cur.execute(
            """
            SELECT oi.id, oi.product_handle AS handle, oi.title, oi.unit_price, oi.quantity,
                   p.image_url AS image
            FROM order_items oi
            LEFT JOIN products p ON p.handle = oi.product_handle
            WHERE oi.order_id = %s
            ORDER BY oi.id
            """,
            (order_id,),
        )
        order["items"] = cur.fetchall()
    return order
