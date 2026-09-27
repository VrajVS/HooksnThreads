from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import require_permission

router = APIRouter(prefix="/api/admin/products", tags=["admin-products"])

SELECT_COLUMNS = "handle, title, price, image_url AS image, category_slug AS category, featured"


class AccessoryLine(BaseModel):
    accessory_id: int
    quantity: Decimal = Field(gt=0)


class ProductBody(BaseModel):
    handle: str
    title: str
    price: int
    image: str
    category: str
    featured: bool = False
    accessories: list[AccessoryLine] = []


class ProductUpdateBody(BaseModel):
    title: str
    price: int
    image: str
    category: str
    featured: bool = False
    # None leaves the current mapping untouched.
    accessories: list[AccessoryLine] | None = None


def _replace_accessories(conn: Connection, handle: str, lines: list[AccessoryLine]) -> None:
    ids = [line.accessory_id for line in lines]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Each accessory can only be added once")
    with conn.cursor() as cur:
        cur.execute("DELETE FROM product_accessories WHERE product_handle = %s", (handle,))
        for line in lines:
            cur.execute(
                """
                INSERT INTO product_accessories (product_handle, accessory_id, quantity)
                VALUES (%s, %s, %s)
                """,
                (handle, line.accessory_id, line.quantity),
            )


@router.get("")
def admin_list_products(
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    category: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("products.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    conditions = []
    params: list[str] = []
    if search:
        conditions.append("title ILIKE %s")
        params.append(f"%{search}%")
    if category:
        conditions.append("category_slug = %s")
        params.append(category)
    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    query = f"""
        SELECT {SELECT_COLUMNS},
               (SELECT count(*) FROM product_accessories pa WHERE pa.product_handle = products.handle)
                   AS accessory_count,
               count(*) OVER() AS total
        FROM products
        {where}
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total}


@router.get("/{handle}")
def admin_get_product(
    handle: str,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("products.view")),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"SELECT {SELECT_COLUMNS} FROM products WHERE handle = %s", (handle,))
        product = cur.fetchone()
        if product is None:
            raise HTTPException(status_code=404, detail="Product not found")
        cur.execute(
            """
            SELECT a.id AS accessory_id, a.name, a.unit, a.stock, pa.quantity
            FROM product_accessories pa
            JOIN accessories a ON a.id = pa.accessory_id
            WHERE pa.product_handle = %s
            ORDER BY a.name
            """,
            (handle,),
        )
        product["accessories"] = cur.fetchall()
    return product


@router.post("", status_code=201)
def create_product(
    body: ProductBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("products.create")),
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO products (handle, title, price, image_url, category_slug, featured)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (body.handle, body.title, body.price, body.image, body.category, body.featured),
            )
        _replace_accessories(conn, body.handle, body.accessories)
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A product with this handle already exists")
    except ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Unknown category or accessory")
    except HTTPException:
        conn.rollback()
        raise
    return {"handle": body.handle}


@router.put("/{handle}")
def update_product(
    handle: str,
    body: ProductUpdateBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("products.update")),
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE products
                SET title = %s, price = %s, image_url = %s, category_slug = %s,
                    featured = %s, updated_at = now()
                WHERE handle = %s
                """,
                (body.title, body.price, body.image, body.category, body.featured, handle),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="Product not found")
        if body.accessories is not None:
            _replace_accessories(conn, handle, body.accessories)
        conn.commit()
    except ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Unknown category or accessory")
    except HTTPException:
        conn.rollback()
        raise
    return {"handle": handle}


@router.delete("/{handle}", status_code=204)
def delete_product(
    handle: str,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("products.delete")),
):
    with conn.cursor() as cur:
        cur.execute("DELETE FROM products WHERE handle = %s", (handle,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")
    conn.commit()
