import re
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import require_permission
from app.inventory import ShortageError, requirements_for_items
from app.orders import (
    ORDER_TOTALS_CTE,
    STAGES,
    Charge,
    Line,
    change_status,
    insert_order,
    load_order,
    log_event,
    next_invoice_number,
    order_stage,
    shortage_response,
    tracking_stage,
    update_order,
)

router = APIRouter(prefix="/api/admin/orders", tags=["admin-orders"])

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class OrderLine(BaseModel):
    handle: str | None = None
    title: str | None = None
    quantity: int = Field(ge=1)
    unit_price: int | None = Field(default=None, ge=0)


class ChargeLine(BaseModel):
    label: str
    amount: int


class PaymentBody(BaseModel):
    amount: int = Field(gt=0)
    mode: Literal["online", "cash"]
    paid_on: date | None = None
    note: str | None = None


class OrderBody(BaseModel):
    invoice_number: str | None = None
    order_date: date | None = None
    customer_name: str = Field(min_length=1)
    customer_phone: str | None = None
    customer_email: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    items: list[OrderLine] = Field(min_length=1)
    charges: list[ChargeLine] = []
    payment_mode: Literal["online", "cash", "online_cash"] | None = None
    allow_shortage: bool = False


class OrderCreateBody(OrderBody):
    status: Literal["pending", "confirmed"] = "confirmed"
    payment: PaymentBody | None = None


class StatusBody(BaseModel):
    status: Literal["pending", "confirmed", "completed", "cancelled"]
    allow_shortage: bool = False


class DeliveryBody(BaseModel):
    delivered: bool
    delivery_date: date | None = None


class ItemProgressBody(BaseModel):
    prepared: bool | None = None
    work_note: str | None = None


class RequirementsBody(BaseModel):
    items: list[OrderLine]


class BusinessSettingsBody(BaseModel):
    business_name: str = Field(min_length=1)
    contact_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    invoice_footer: str = ""


def _clean(value: str | None) -> str | None:
    value = (value or "").strip()
    return value or None


def _lines(items: list[OrderLine]) -> list[Line]:
    return [Line(i.handle or None, i.title, i.quantity, i.unit_price) for i in items]


def _charges(charges: list[ChargeLine]) -> list[Charge]:
    return [Charge(c.label, c.amount) for c in charges]


def _add_payment(conn: Connection, order_id: int, body: PaymentBody, admin_id: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO order_payments (order_id, amount, mode, paid_on, note, admin_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (order_id, body.amount, body.mode, body.paid_on or date.today(), _clean(body.note), admin_id),
        )


def _filters(search, status, source, stage, month) -> tuple[str, list]:
    conditions = []
    params: list = []
    if search:
        term = search.strip().lstrip("#")
        conditions.append(
            "(o.invoice_number ILIKE %s OR o.customer_name ILIKE %s OR o.customer_phone ILIKE %s"
            " OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.title ILIKE %s))"
        )
        params.extend([f"%{term}%"] * 4)
    if status:
        conditions.append("o.status = %s")
        params.append(status)
    if source:
        conditions.append("o.source = %s")
        params.append(source)
    if stage:
        if stage not in STAGES:
            raise HTTPException(status_code=400, detail="Unknown stage")
        conditions.append("o.stage = %s")
        params.append(stage)
    if month:
        if not MONTH_RE.match(month):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        conditions.append("to_char(o.order_date, 'YYYY-MM') = %s")
        params.append(month)
    return (f"WHERE {' AND '.join(conditions)}" if conditions else ""), params


@router.get("")
def list_orders(
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
    source: str | None = None,
    stage: str | None = None,
    month: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size
    where, params = _filters(search, status, source, stage, month)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            {ORDER_TOTALS_CTE}
            SELECT o.id, o.invoice_number, o.order_date, o.source, o.status, o.stage,
                   o.customer_name, o.customer_phone, o.total, o.paid, o.delivered,
                   o.delivery_date, o.line_count, o.prepared_count, o.created_at,
                   (SELECT COALESCE(SUM(quantity), 0) FROM order_items oi WHERE oi.order_id = o.id)
                       AS item_count,
                   (SELECT string_agg(oi.title || CASE WHEN oi.quantity > 1 THEN ' ×' || oi.quantity ELSE '' END,
                                      ', ' ORDER BY oi.id)
                    FROM order_items oi WHERE oi.order_id = o.id) AS items_summary,
                   COALESCE(
                       (SELECT string_agg(DISTINCT p.mode, '+') FROM order_payments p WHERE p.order_id = o.id),
                       replace(o.payment_mode, '_', '+')
                   ) AS payment_modes,
                   count(*) OVER() AS total_rows
            FROM staged o
            {where}
            ORDER BY o.order_date DESC, o.invoice_number DESC
            LIMIT %s OFFSET %s
            """,
            [*params, page_size, offset],
        )
        rows = cur.fetchall()

        # Totals row for the current filter (cancelled orders excluded).
        cur.execute(
            f"""
            {ORDER_TOTALS_CTE}
            SELECT count(*) AS orders,
                   COALESCE(SUM(o.total), 0) AS total,
                   COALESCE(SUM(o.paid), 0) AS received
            FROM staged o
            {where} {"AND" if where else "WHERE"} o.status <> 'cancelled'
            """,
            params,
        )
        summary = cur.fetchone()
        cur.execute(
            f"{ORDER_TOTALS_CTE} SELECT o.stage, count(*) AS n FROM staged o GROUP BY o.stage"
        )
        stage_counts = {r["stage"]: r["n"] for r in cur.fetchall()}
        cur.execute(
            "SELECT DISTINCT to_char(order_date, 'YYYY-MM') AS m FROM orders ORDER BY m DESC"
        )
        months = [r["m"] for r in cur.fetchall()]

    total_rows = rows[0]["total_rows"] if rows else 0
    for row in rows:
        del row["total_rows"]
    summary["outstanding"] = summary["total"] - summary["received"]
    return {
        "items": rows,
        "total": total_rows,
        "summary": summary,
        "stage_counts": stage_counts,
        "months": months,
        "pending_count": stage_counts.get("preparation_pending", 0),
    }


@router.get("/next-invoice-number")
def get_next_invoice_number(
    on: date | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.create")),
):
    return {"invoice_number": next_invoice_number(conn, on or date.today())}


@router.get("/pending-items")
def pending_items(
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    """Every item still to be made, across open orders (the 'Pending orders' sheet)."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT i.id, i.order_id, o.invoice_number, o.order_date, o.customer_name,
                   i.title, i.quantity, i.work_note, o.delivery_date, p.image_url AS image
            FROM order_items i
            JOIN orders o ON o.id = i.order_id
            LEFT JOIN products p ON p.handle = i.product_handle
            WHERE NOT i.prepared AND o.status <> 'cancelled'
            ORDER BY o.delivery_date NULLS LAST, o.order_date, o.id, i.id
            """
        )
        return cur.fetchall()


@router.get("/items-sold")
def items_sold(
    year: int | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    """Pieces sold per month and in total (the 'Items sold' sheet)."""
    year = year or date.today().year
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT to_char(o.order_date, 'YYYY-MM') AS month,
                   COALESCE(p.title, i.title) AS item,
                   SUM(i.quantity) AS pieces,
                   SUM(i.quantity * i.unit_price) AS revenue
            FROM order_items i
            JOIN orders o ON o.id = i.order_id
            LEFT JOIN products p ON p.handle = i.product_handle
            WHERE o.status <> 'cancelled' AND extract(year FROM o.order_date) = %s
            GROUP BY 1, 2
            ORDER BY 1 DESC, 3 DESC, 2
            """,
            (year,),
        )
        by_month = cur.fetchall()
        cur.execute(
            "SELECT DISTINCT extract(year FROM order_date)::int AS y FROM orders ORDER BY y DESC"
        )
        years = [r["y"] for r in cur.fetchall()]

    totals: dict[str, dict] = {}
    for row in by_month:
        t = totals.setdefault(row["item"], {"item": row["item"], "pieces": 0, "revenue": 0})
        t["pieces"] += row["pieces"]
        t["revenue"] += row["revenue"]
    return {
        "year": year,
        "years": years or [year],
        "by_month": by_month,
        "totals": sorted(totals.values(), key=lambda t: (-t["pieces"], t["item"].lower())),
    }


@router.get("/settings")
def get_business_settings(
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT business_name, contact_name, phone, email, address, invoice_footer "
            "FROM business_settings WHERE id = 1"
        )
        return cur.fetchone()


@router.put("/settings")
def update_business_settings(
    body: BusinessSettingsBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.update")),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_settings (id, business_name, contact_name, phone, email, address,
                                           invoice_footer, updated_at)
            VALUES (1, %s, %s, %s, %s, %s, %s, now())
            ON CONFLICT (id) DO UPDATE SET
                business_name = EXCLUDED.business_name, contact_name = EXCLUDED.contact_name,
                phone = EXCLUDED.phone, email = EXCLUDED.email, address = EXCLUDED.address,
                invoice_footer = EXCLUDED.invoice_footer, updated_at = now()
            """,
            (
                body.business_name.strip(),
                _clean(body.contact_name),
                _clean(body.phone),
                _clean(body.email),
                _clean(body.address),
                body.invoice_footer.strip(),
            ),
        )
    conn.commit()
    return {"ok": True}


@router.post("/requirements")
def order_requirements(
    body: RequirementsBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("orders.view")),
):
    return requirements_for_items(
        conn, [(line.handle, line.quantity) for line in body.items if line.handle]
    )


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
        cur.execute(
            """
            SELECT e.id, e.kind, e.from_value, e.to_value, e.detail, e.actor, e.created_at,
                   s.full_name AS admin_name
            FROM order_events e
            LEFT JOIN store_users s ON s.id = e.admin_id
            WHERE e.order_id = %s
            ORDER BY e.created_at, e.id
            """,
            (order_id,),
        )
        order["events"] = cur.fetchall()

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
            invoice_number=_clean(body.invoice_number),
            order_date=body.order_date,
            customer_name=body.customer_name.strip(),
            customer_phone=_clean(body.customer_phone),
            customer_email=_clean(body.customer_email),
            shipping_address=_clean(body.shipping_address),
            notes=_clean(body.notes),
            lines=_lines(body.items),
            charges=_charges(body.charges),
            payment_mode=body.payment_mode,
            admin_id=admin["id"],
        )
        log_event(conn, order_id, "created", to_value="pending",
                  detail="Entered in the admin panel", admin_id=admin["id"])
        if body.payment:
            _add_payment(conn, order_id, body.payment, admin["id"])
        if body.status == "confirmed":
            change_status(conn, order_id, "confirmed", admin["id"], body.allow_shortage)
        log_event(conn, order_id, "stage", to_value=order_stage(conn, order_id), admin_id=admin["id"])
        conn.commit()
    except ShortageError as err:
        conn.rollback()
        return shortage_response(err)
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id}


@router.put("/{order_id}")
def edit_order(
    order_id: int,
    body: OrderBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT invoice_number, order_date FROM orders WHERE id = %s", (order_id,))
            current = cur.fetchone()
        if current is None:
            raise HTTPException(status_code=404, detail="Order not found")
        with tracking_stage(conn, order_id, admin["id"]):
            update_order(
                conn,
                order_id,
                invoice_number=_clean(body.invoice_number) or current[0],
                order_date=body.order_date or current[1],
                customer_name=body.customer_name.strip(),
                customer_phone=_clean(body.customer_phone),
                customer_email=_clean(body.customer_email),
                shipping_address=_clean(body.shipping_address),
                notes=_clean(body.notes),
                lines=_lines(body.items),
                charges=_charges(body.charges),
                payment_mode=body.payment_mode,
                admin_id=admin["id"],
                allow_shortage=body.allow_shortage,
            )
            log_event(conn, order_id, "edited", detail="Order details, items or charges edited",
                      admin_id=admin["id"])
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
        with tracking_stage(conn, order_id, admin["id"]):
            change_status(conn, order_id, body.status, admin["id"], body.allow_shortage)
        conn.commit()
    except ShortageError as err:
        conn.rollback()
        return shortage_response(err)
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id, "status": body.status}


@router.patch("/{order_id}/delivery")
def update_delivery(
    order_id: int,
    body: DeliveryBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT delivered, delivery_date FROM orders WHERE id = %s AND status <> 'cancelled'",
            (order_id,),
        )
        before = cur.fetchone()
    if before is None:
        raise HTTPException(status_code=404, detail="Order not found or cancelled")
    with tracking_stage(conn, order_id, admin["id"]):
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE orders SET delivered = %s, delivery_date = %s, updated_at = now() WHERE id = %s",
                (body.delivered, body.delivery_date, order_id),
            )
        was_delivered, old_date = before
        if was_delivered != body.delivered:
            log_event(conn, order_id, "delivery",
                      to_value="delivered" if body.delivered else "not_delivered",
                      detail=body.delivery_date.isoformat() if body.delivery_date else None,
                      admin_id=admin["id"])
        elif old_date != body.delivery_date:
            log_event(conn, order_id, "delivery_date",
                      from_value=old_date.isoformat() if old_date else None,
                      to_value=body.delivery_date.isoformat() if body.delivery_date else None,
                      admin_id=admin["id"])
    conn.commit()
    return {"ok": True}


@router.patch("/{order_id}/items/{item_id}")
def update_item_progress(
    order_id: int,
    item_id: int,
    body: ItemProgressBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT title, prepared, work_note FROM order_items WHERE id = %s AND order_id = %s",
            (item_id, order_id),
        )
        before = cur.fetchone()
    if before is None:
        raise HTTPException(status_code=404, detail="Item not found")
    title, was_prepared, old_note = before
    sets, params = [], []
    if body.prepared is not None:
        sets.append("prepared = %s")
        params.append(body.prepared)
    if body.work_note is not None:
        sets.append("work_note = %s")
        params.append(_clean(body.work_note))
    if not sets:
        return {"ok": True}
    with tracking_stage(conn, order_id, admin["id"]):
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE order_items SET {', '.join(sets)} WHERE id = %s AND order_id = %s",
                [*params, item_id, order_id],
            )
            cur.execute("UPDATE orders SET updated_at = now() WHERE id = %s", (order_id,))
        if body.prepared is not None and body.prepared != was_prepared:
            log_event(conn, order_id, "item_prepared" if body.prepared else "item_unprepared",
                      detail=title, admin_id=admin["id"])
        new_note = _clean(body.work_note) if body.work_note is not None else old_note
        if body.work_note is not None and new_note != old_note:
            log_event(conn, order_id, "work_note", from_value=old_note, to_value=new_note,
                      detail=title, admin_id=admin["id"])
    conn.commit()
    return {"ok": True}


@router.post("/{order_id}/payments", status_code=201)
def add_payment(
    order_id: int,
    body: PaymentBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    with conn.cursor() as cur:
        cur.execute("SELECT status FROM orders WHERE id = %s", (order_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    with tracking_stage(conn, order_id, admin["id"]):
        _add_payment(conn, order_id, body, admin["id"])
        log_event(conn, order_id, "payment_added", to_value=str(body.amount), detail=body.mode,
                  admin_id=admin["id"])
    conn.commit()
    return {"ok": True}


@router.delete("/{order_id}/payments/{payment_id}", status_code=204)
def delete_payment(
    order_id: int,
    payment_id: int,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("orders.update")),
):
    with tracking_stage(conn, order_id, admin["id"]):
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM order_payments WHERE id = %s AND order_id = %s RETURNING amount, mode",
                (payment_id, order_id),
            )
            row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Payment not found")
        log_event(conn, order_id, "payment_removed", to_value=str(row[0]), detail=row[1],
                  admin_id=admin["id"])
    conn.commit()


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
