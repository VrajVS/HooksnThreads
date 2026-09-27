from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import require_permission
from app.inventory import ShortageError, requirements_for_items
from app.orders import change_status, insert_order, load_order, shortage_response

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])


class OrderLine(BaseModel):
    handle: str
    quantity: int = Field(ge=1)
    unit_price: int | None = Field(default=None, ge=0)


class OrderCreateBody(BaseModel):
    customer_name: str = Field(min_length=1)
    customer_phone: str | None = None
    customer_email: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    items: list[OrderLine] = Field(min_length=1)
    status: Literal["pending", "confirmed"] = "confirmed"
    allow_shortage: bool = False


class StatusBody(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled"]
    allow_shortage: bool = False


class RequirementsBody(BaseModel):
    items: list[OrderLine]


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


@router.get("")
def list_orders(
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    status: str | None = None,
    source: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    conditions = []
    params: list = []
    if search:
        term = search.strip().lstrip("#")
        if term.isdigit():
            conditions.append("(o.id = %s OR o.customer_phone ILIKE %s)")
            params.extend([int(term), f"%{term}%"])
        else:
            conditions.append("(o.customer_name ILIKE %s OR o.customer_email ILIKE %s)")
            params.extend([f"%{term}%", f"%{term}%"])
    if status:
        conditions.append("o.status = %s")
        params.append(status)
    if source:
        conditions.append("o.source = %s")
        params.append(source)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT o.id, o.source, o.status, o.customer_name, o.customer_phone, o.subtotal,
               o.created_at,
               (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id)
                   AS item_count,
               count(*) OVER() AS total
        FROM orders o
        {where}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT %s OFFSET %s
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()
        cur.execute("SELECT count(*) AS n FROM orders WHERE status = 'pending'")
        pending_count = cur.fetchone()["n"]

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total, "pending_count": pending_count}


@router.post("/requirements")
def order_requirements(
    body: RequirementsBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    return requirements_for_items(conn, [(line.handle, line.quantity) for line in body.items])


@router.get("/{order_id}")
def get_order(
    order_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    order = load_order(conn, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT m.id, m.change, m.reason, m.created_at, a.id AS accessory_id,
                   a.name, a.unit, s.full_name AS admin_name
            FROM inventory_movements m
            JOIN accessories a ON a.id = m.accessory_id
            LEFT JOIN store_users s ON s.id = m.admin_id
            WHERE m.order_id = %s
            ORDER BY m.created_at, m.id
            """,
            (order_id,),
        )
        order["movements"] = cur.fetchall()

    # What confirming would take right now (only meaningful before deduction).
    order["requirements"] = (
        []
        if order["stock_deducted"]
        else requirements_for_items(
            conn, [(i["handle"], i["quantity"]) for i in order["items"] if i["handle"]]
        )
    )
    return order


@router.post("", status_code=201)
def create_order(
    body: OrderCreateBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.create")),
):
    try:
        order_id = insert_order(
            conn,
            source="admin",
            customer_name=body.customer_name.strip(),
            customer_phone=_clean(body.customer_phone),
            customer_email=_clean(body.customer_email),
            shipping_address=_clean(body.shipping_address),
            notes=_clean(body.notes),
            lines=[(line.handle, line.quantity, line.unit_price) for line in body.items],
            admin_id=admin["id"],
        )
        if body.status == "confirmed":
            change_status(conn, order_id, "confirmed", admin["id"], body.allow_shortage)
        conn.commit()
    except ShortageError as err:
        conn.rollback()
        return shortage_response(err)
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id}


@router.post("/{order_id}/status")
def update_status(
    order_id: int,
    body: StatusBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    try:
        change_status(conn, order_id, body.status, admin["id"], body.allow_shortage)
        conn.commit()
    except ShortageError as err:
        conn.rollback()
        return shortage_response(err)
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id, "status": body.status}


@router.delete("/{order_id}", status_code=204)
def delete_order(
    order_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.delete")),
):
    with conn.cursor() as cur:
        cur.execute("SELECT status, stock_deducted FROM orders WHERE id = %s", (order_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Order not found")
        if row[1]:
            raise HTTPException(
                status_code=400,
                detail="This order has taken accessory stock. Cancel it first to restore stock.",
            )
        cur.execute("DELETE FROM orders WHERE id = %s", (order_id,))
    conn.commit()
