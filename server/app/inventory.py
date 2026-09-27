"""Accessory stock bookkeeping for orders.

An order consumes, per line, `order_items.quantity x product_accessories.quantity`
of each mapped accessory. Stock is deducted when an order is confirmed and
restored when a deducted order is cancelled. Every change is written to
inventory_movements, and a restore reverses exactly what was recorded for the
order, so later edits to a product's accessory mapping can't skew the numbers.

Callers own the transaction: these functions never commit.
"""

from decimal import Decimal

from psycopg import Connection
from psycopg.rows import dict_row

DEDUCTED_STATUSES = frozenset({"confirmed", "completed"})


class ShortageError(Exception):
    def __init__(self, shortages: list[dict]):
        super().__init__("Not enough accessory stock")
        self.shortages = shortages


def requirements_for_items(conn: Connection, items: list[tuple[str, int]]) -> list[dict]:
    """Accessories needed to make `items` [(product_handle, quantity), ...],
    with current stock, sorted by accessory name."""
    if not items:
        return []
    handles = [h for h, _ in items]
    qty_by_handle: dict[str, int] = {}
    for handle, qty in items:
        qty_by_handle[handle] = qty_by_handle.get(handle, 0) + qty

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT pa.product_handle, pa.quantity, a.id, a.name, a.unit, a.stock
            FROM product_accessories pa
            JOIN accessories a ON a.id = pa.accessory_id
            WHERE pa.product_handle = ANY(%s)
            """,
            (handles,),
        )
        rows = cur.fetchall()

    needed: dict[int, dict] = {}
    for row in rows:
        entry = needed.setdefault(
            row["id"],
            {
                "accessory_id": row["id"],
                "name": row["name"],
                "unit": row["unit"],
                "stock": row["stock"],
                "required": Decimal(0),
            },
        )
        entry["required"] += row["quantity"] * qty_by_handle[row["product_handle"]]

    result = sorted(needed.values(), key=lambda e: e["name"].lower())
    for entry in result:
        entry["shortage"] = max(entry["required"] - entry["stock"], Decimal(0))
    return result


def _order_items(conn: Connection, order_id: int) -> list[tuple[str, int]]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT product_handle, quantity FROM order_items "
            "WHERE order_id = %s AND product_handle IS NOT NULL",
            (order_id,),
        )
        return [(h, q) for h, q in cur.fetchall()]


def deduct_for_order(
    conn: Connection, order_id: int, admin_id: int | None, allow_shortage: bool = False
) -> list[dict]:
    """Deduct the order's accessories from stock. No-op if already deducted.
    Raises ShortageError (before changing anything) if stock would go negative
    and allow_shortage is False."""
    with conn.cursor() as cur:
        cur.execute("SELECT stock_deducted FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        row = cur.fetchone()
        if row is None or row[0]:
            return []

        needs = requirements_for_items(conn, _order_items(conn, order_id))
        if not needs:
            cur.execute("UPDATE orders SET stock_deducted = true WHERE id = %s", (order_id,))
            return []

        # Lock in id order so concurrent confirmations can't deadlock, then
        # re-read stock under the lock.
        ids = sorted(n["accessory_id"] for n in needs)
        cur.execute(
            "SELECT id, stock FROM accessories WHERE id = ANY(%s) ORDER BY id FOR UPDATE", (ids,)
        )
        locked_stock = dict(cur.fetchall())
        for n in needs:
            n["stock"] = locked_stock[n["accessory_id"]]
            n["shortage"] = max(n["required"] - n["stock"], Decimal(0))

        shortages = [n for n in needs if n["shortage"] > 0]
        if shortages and not allow_shortage:
            raise ShortageError(shortages)

        for n in needs:
            cur.execute(
                "UPDATE accessories SET stock = stock - %s, updated_at = now() WHERE id = %s",
                (n["required"], n["accessory_id"]),
            )
            cur.execute(
                """
                INSERT INTO inventory_movements (accessory_id, change, reason, order_id, admin_id)
                VALUES (%s, %s, 'order', %s, %s)
                """,
                (n["accessory_id"], -n["required"], order_id, admin_id),
            )
        cur.execute("UPDATE orders SET stock_deducted = true WHERE id = %s", (order_id,))
    return needs


def restore_for_order(conn: Connection, order_id: int, admin_id: int | None) -> None:
    """Put back everything this order took from stock. No-op if not deducted."""
    with conn.cursor() as cur:
        cur.execute("SELECT stock_deducted FROM orders WHERE id = %s FOR UPDATE", (order_id,))
        row = cur.fetchone()
        if row is None or not row[0]:
            return

        cur.execute(
            """
            SELECT accessory_id, -SUM(change)
            FROM inventory_movements
            WHERE order_id = %s AND reason IN ('order', 'order_cancelled')
            GROUP BY accessory_id
            HAVING SUM(change) <> 0
            ORDER BY accessory_id
            """,
            (order_id,),
        )
        for accessory_id, amount in cur.fetchall():
            cur.execute(
                "UPDATE accessories SET stock = stock + %s, updated_at = now() WHERE id = %s",
                (amount, accessory_id),
            )
            cur.execute(
                """
                INSERT INTO inventory_movements (accessory_id, change, reason, order_id, admin_id)
                VALUES (%s, %s, 'order_cancelled', %s, %s)
                """,
                (accessory_id, amount, order_id, admin_id),
            )
        cur.execute("UPDATE orders SET stock_deducted = false WHERE id = %s", (order_id,))
