from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/products", tags=["products"])

SELECT_COLUMNS = (
    "handle, title, price, image_url AS image, category_slug AS category, featured, created_at"
)


@router.get("")
def list_products(
    category: str | None = None,
    search: str | None = None,
    conn: Connection = Depends(get_conn),
):
    query = f"SELECT {SELECT_COLUMNS} FROM products"
    conditions = []
    params: list[str] = []

    if category:
        conditions.append("category_slug = %s")
        params.append(category)
    if search:
        conditions.append("title ILIKE %s")
        params.append(f"%{search}%")

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at"

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, params)
        return cur.fetchall()


@router.get("/{handle}")
def get_product(handle: str, conn: Connection = Depends(get_conn)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"SELECT {SELECT_COLUMNS} FROM products WHERE handle = %s", (handle,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return row
