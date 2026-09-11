from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row

from app.db import get_conn

router = APIRouter(prefix="/api/categories", tags=["categories"])


@router.get("")
def list_categories(conn: Connection = Depends(get_conn)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT slug, name, tagline, image_url AS image FROM categories ORDER BY name")
        return cur.fetchall()


@router.get("/{slug}")
def get_category(slug: str, conn: Connection = Depends(get_conn)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT slug, name, tagline, image_url AS image FROM categories WHERE slug = %s",
            (slug,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return row
