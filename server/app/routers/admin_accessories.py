from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation, RestrictViolation, UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator

from app.db import get_conn
from app.deps import require_admin, require_permission

router = APIRouter(prefix="/api/admin/accessories", tags=["admin-accessories"])

SELECT_COLUMNS = "id, name, unit, stock, low_stock_threshold, updated_at"


class AccessoryBody(BaseModel):
    name: str = Field(min_length=1)
    unit: str = Field(min_length=1)
    low_stock_threshold: Decimal = Field(default=Decimal(0), ge=0)

    @field_validator("name", "unit")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Required")
        return v


class AccessoryCreateBody(AccessoryBody):
    stock: Decimal = Field(default=Decimal(0), ge=0)


class AdjustBody(BaseModel):
    change: Decimal
    note: str | None = None

    @field_validator("change")
    @classmethod
    def _nonzero(cls, v: Decimal) -> Decimal:
        if v == 0:
            raise ValueError("Change must not be zero")
        return v


def require_accessory_options(admin: dict = Depends(require_admin)) -> dict:
    """The product form needs the accessory list, so anyone who can edit
    products (or view accessories) may read it."""
    if admin.get("is_system_role"):
        return admin
    allowed = {"accessories.view", "products.create", "products.update", "orders.create"}
    if not allowed.intersection(admin.get("permissions", [])):
        raise HTTPException(status_code=403, detail="Missing permission: accessories.view")
    return admin


@router.get("")
def list_accessories(
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    low_stock: bool = False,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("accessories.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    conditions = []
    params: list = []
    if search:
        conditions.append("a.name ILIKE %s")
        params.append(f"%{search}%")
    if low_stock:
        conditions.append("a.stock <= a.low_stock_threshold")
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT a.id, a.name, a.unit, a.stock, a.low_stock_threshold, a.updated_at,
               (SELECT count(*) FROM product_accessories pa WHERE pa.accessory_id = a.id) AS product_count,
               count(*) OVER() AS total
        FROM accessories a
        {where}
        ORDER BY a.name
        LIMIT %s OFFSET %s
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()
        cur.execute("SELECT count(*) AS n FROM accessories WHERE stock <= low_stock_threshold")
        low_stock_count = cur.fetchone()["n"]

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total, "low_stock_count": low_stock_count}


@router.get("/options")
def accessory_options(
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_accessory_options),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, name, unit, stock FROM accessories ORDER BY name")
        return cur.fetchall()


@router.get("/{accessory_id}")
def get_accessory(
    accessory_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("accessories.view")),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"SELECT {SELECT_COLUMNS} FROM accessories WHERE id = %s", (accessory_id,))
        accessory = cur.fetchone()
        if accessory is None:
            raise HTTPException(status_code=404, detail="Accessory not found")
        cur.execute(
            """
            SELECT p.handle, p.title, p.image_url AS image, pa.quantity
            FROM product_accessories pa
            JOIN products p ON p.handle = pa.product_handle
            WHERE pa.accessory_id = %s
            ORDER BY p.title
            """,
            (accessory_id,),
        )
        accessory["products"] = cur.fetchall()
        cur.execute(
            """
            SELECT m.id, m.change, m.reason, m.order_id, m.note, m.created_at,
                   s.full_name AS admin_name
            FROM inventory_movements m
            LEFT JOIN store_users s ON s.id = m.admin_id
            WHERE m.accessory_id = %s
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT 50
            """,
            (accessory_id,),
        )
        accessory["movements"] = cur.fetchall()
    return accessory


@router.post("", status_code=201)
def create_accessory(
    body: AccessoryCreateBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("accessories.create")),
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO accessories (name, unit, stock, low_stock_threshold)
                VALUES (%s, %s, %s, %s) RETURNING id
                """,
                (body.name, body.unit, body.stock, body.low_stock_threshold),
            )
            new_id = cur.fetchone()[0]
            if body.stock:
                cur.execute(
                    """
                    INSERT INTO inventory_movements (accessory_id, change, reason, admin_id)
                    VALUES (%s, %s, 'initial', %s)
                    """,
                    (new_id, body.stock, admin["id"]),
                )
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An accessory with this name already exists")
    return {"id": new_id}


@router.put("/{accessory_id}")
def update_accessory(
    accessory_id: int,
    body: AccessoryBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("accessories.update")),
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE accessories
                SET name = %s, unit = %s, low_stock_threshold = %s, updated_at = now()
                WHERE id = %s
                """,
                (body.name, body.unit, body.low_stock_threshold, accessory_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Accessory not found")
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An accessory with this name already exists")
    return {"id": accessory_id}


@router.post("/{accessory_id}/adjust")
def adjust_stock(
    accessory_id: int,
    body: AdjustBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_permission("accessories.update")),
):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE accessories SET stock = stock + %s, updated_at = now() WHERE id = %s RETURNING stock",
            (body.change, accessory_id),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Accessory not found")
        cur.execute(
            """
            INSERT INTO inventory_movements (accessory_id, change, reason, note, admin_id)
            VALUES (%s, %s, 'adjustment', %s, %s)
            """,
            (accessory_id, body.change, (body.note or "").strip() or None, admin["id"]),
        )
    conn.commit()
    return {"id": accessory_id, "stock": row[0]}


@router.delete("/{accessory_id}", status_code=204)
def delete_accessory(
    accessory_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("accessories.delete")),
):
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM accessories WHERE id = %s", (accessory_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Accessory not found")
        conn.commit()
    except (ForeignKeyViolation, RestrictViolation):
        conn.rollback()
        raise HTTPException(
            status_code=409,
            detail="This accessory is mapped to products. Remove it from those products first.",
        )
