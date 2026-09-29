from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends
from psycopg import Connection
from psycopg.rows import dict_row

from app.db import get_conn
from app.deps import require_admin
from app.orders import ORDER_TOTALS_CTE

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"])

Period = Literal["month", "30d", "year", "all"]


def _can(admin: dict, key: str) -> bool:
    return admin.get("is_system_role") or key in admin.get("permissions", [])


def _period_bounds(period: Period, today: date) -> tuple[date | None, date | None, date | None]:
    """(start, previous_start, previous_end) — previous_* is the equal-length
    period right before, used for the comparison figure. All-time has none."""
    if period == "month":
        start = today.replace(day=1)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
        # Compare month-to-date with the same number of days last month.
        prev_cutoff = min(prev_start + (today - start), prev_end)
        return start, prev_start, prev_cutoff
    if period == "30d":
        start = today - timedelta(days=29)
        return start, start - timedelta(days=30), start - timedelta(days=1)
    if period == "year":
        start = today.replace(month=1, day=1)
        prev_start = start.replace(year=start.year - 1)
        return start, prev_start, prev_start + (today - start)
    return None, None, None


def _sales(cur, start: date | None, prev_start: date | None, prev_end: date | None, today: date) -> dict:
    def revenue_between(lo: date | None, hi: date | None) -> dict:
        cur.execute(
            f"""
            {ORDER_TOTALS_CTE}
            SELECT count(*) AS orders, COALESCE(SUM(total), 0) AS revenue
            FROM staged
            WHERE status <> 'cancelled'
              AND (%(lo)s::date IS NULL OR order_date >= %(lo)s)
              AND (%(hi)s::date IS NULL OR order_date <= %(hi)s)
            """,
            {"lo": lo, "hi": hi},
        )
        return cur.fetchone()

    current = revenue_between(start, today)
    previous = revenue_between(prev_start, prev_end) if prev_start else None

    cur.execute(
        """
        SELECT COALESCE(SUM(p.amount), 0) AS received
        FROM order_payments p JOIN orders o ON o.id = p.order_id
        WHERE o.status <> 'cancelled' AND (%(lo)s::date IS NULL OR p.paid_on >= %(lo)s)
        """,
        {"lo": start},
    )
    received = cur.fetchone()["received"]

    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT COALESCE(SUM(total - paid), 0) AS outstanding, count(*) AS orders
        FROM staged WHERE status <> 'cancelled' AND paid < total
        """
    )
    outstanding = cur.fetchone()

    # Last 12 calendar months, zero-filled.
    months_back = today.year * 12 + today.month - 1 - 11
    first_month = date(months_back // 12, months_back % 12 + 1, 1)
    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT to_char(m.month, 'YYYY-MM') AS month,
               COALESCE(SUM(s.total), 0) AS revenue,
               count(s.id) AS orders
        FROM generate_series(%(first)s::date, date_trunc('month', %(today)s::date), interval '1 month') AS m(month)
        LEFT JOIN staged s
               ON date_trunc('month', s.order_date) = m.month AND s.status <> 'cancelled'
        GROUP BY m.month
        ORDER BY m.month
        """,
        {"first": first_month, "today": today},
    )
    monthly = cur.fetchall()

    cur.execute(f"{ORDER_TOTALS_CTE} SELECT stage, count(*) AS n FROM staged GROUP BY stage")
    stage_counts = {r["stage"]: r["n"] for r in cur.fetchall()}

    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT id, invoice_number, customer_name, total, order_date, source
        FROM staged WHERE status = 'pending'
        ORDER BY order_date, id LIMIT 5
        """
    )
    to_confirm = cur.fetchall()

    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT id, invoice_number, customer_name, delivery_date, stage,
               line_count - prepared_count AS items_left
        FROM staged
        WHERE status <> 'cancelled' AND NOT delivered AND delivery_date IS NOT NULL
          AND delivery_date <= %(soon)s
        ORDER BY delivery_date, id LIMIT 6
        """,
        {"soon": today + timedelta(days=7)},
    )
    deliveries = cur.fetchall()

    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT id, invoice_number, customer_name, total - paid AS balance, delivered
        FROM staged
        WHERE status <> 'cancelled' AND paid < total AND delivered
        ORDER BY total - paid DESC, id LIMIT 5
        """
    )
    to_collect = cur.fetchall()

    cur.execute(
        """
        SELECT COALESCE(p.title, i.title) AS item, SUM(i.quantity) AS pieces,
               SUM(i.quantity * i.unit_price) AS revenue, MAX(p.image_url) AS image
        FROM order_items i
        JOIN orders o ON o.id = i.order_id
        LEFT JOIN products p ON p.handle = i.product_handle
        WHERE o.status <> 'cancelled' AND (%(lo)s::date IS NULL OR o.order_date >= %(lo)s)
        GROUP BY 1
        ORDER BY 2 DESC, 3 DESC
        LIMIT 5
        """,
        {"lo": start},
    )
    top_items = cur.fetchall()

    cur.execute(
        f"""
        {ORDER_TOTALS_CTE}
        SELECT id, invoice_number, customer_name, total, paid, stage, order_date, source
        FROM staged ORDER BY created_at DESC, id DESC LIMIT 6
        """
    )
    recent = cur.fetchall()

    cur.execute(
        """
        SELECT count(*) AS total,
               count(*) FILTER (WHERE %(lo)s::date IS NULL OR created_at::date >= %(lo)s) AS new
        FROM customer_users
        """,
        {"lo": start},
    )
    customers = cur.fetchone()

    orders = current["orders"]
    return {
        "revenue": current["revenue"],
        "orders": orders,
        "average_order": round(current["revenue"] / orders) if orders else 0,
        "previous": previous,
        "received": received,
        "outstanding": outstanding["outstanding"],
        "outstanding_orders": outstanding["orders"],
        "monthly": monthly,
        "stage_counts": stage_counts,
        "to_confirm": to_confirm,
        "deliveries": deliveries,
        "to_collect": to_collect,
        "top_items": top_items,
        "recent": recent,
        "customers": customers,
    }


@router.get("")
def dashboard(
    period: Period = "month",
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_admin),
):
    today = date.today()
    start, prev_start, prev_end = _period_bounds(period, today)
    result: dict = {"period": period, "start": start, "today": today}

    with conn.cursor(row_factory=dict_row) as cur:
        if _can(admin, "orders.view"):
            result["sales"] = _sales(cur, start, prev_start, prev_end, today)

        if _can(admin, "accessories.view"):
            cur.execute(
                """
                SELECT id, name, unit, stock, low_stock_threshold
                FROM accessories WHERE stock <= low_stock_threshold
                ORDER BY stock - low_stock_threshold, name LIMIT 6
                """
            )
            low = cur.fetchall()
            cur.execute(
                "SELECT count(*) AS total, count(*) FILTER (WHERE stock <= low_stock_threshold) AS low FROM accessories"
            )
            result["inventory"] = {**cur.fetchone(), "items": low}

        if _can(admin, "products.view"):
            cur.execute(
                """
                SELECT count(*) AS products,
                       count(*) FILTER (WHERE featured) AS featured,
                       count(*) FILTER (WHERE NOT EXISTS (
                           SELECT 1 FROM product_accessories pa WHERE pa.product_handle = p.handle
                       )) AS unmapped,
                       (SELECT count(*) FROM categories) AS categories
                FROM products p
                """
            )
            result["catalogue"] = cur.fetchone()

    return result
