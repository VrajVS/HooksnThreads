from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel

from app.db import get_conn
from app.deps import require_permission

router = APIRouter(prefix="/api/admin/categories", tags=["admin-categories"])

SELECT_COLUMNS = "slug, name, tagline, image_url AS image"


class CategoryBody(BaseModel):
    slug: str
    name: str
    tagline: str
    image: str


class CategoryUpdateBody(BaseModel):
    name: str
    tagline: str
    image: str


@router.get("")
def admin_list_categories(
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("categories.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    where = "WHERE name ILIKE %s" if search else ""
    params = [f"%{search}%"] if search else []

    query = f"""
        SELECT {SELECT_COLUMNS}, count(*) OVER() AS total
        FROM categories
        {where}
        ORDER BY name
        LIMIT %s OFFSET %s
    """

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total}


@router.post("", status_code=201)
def create_category(
    body: CategoryBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("categories.create")),
):
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO categories (slug, name, tagline, image_url) VALUES (%s, %s, %s, %s)",
                (body.slug, body.name, body.tagline, body.image),
            )
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A category with this slug already exists")
    return {"slug": body.slug}


@router.put("/{slug}")
def update_category(
    slug: str,
    body: CategoryUpdateBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("categories.update")),
):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE categories SET name = %s, tagline = %s, image_url = %s WHERE slug = %s",
            (body.name, body.tagline, body.image, slug),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Category not found")
    conn.commit()
    return {"slug": slug}


@router.delete("/{slug}", status_code=204)
def delete_category(
    slug: str,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("categories.delete")),
):
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM products WHERE category_slug = %s", (slug,))
        if cur.fetchone()[0] > 0:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete a category that still has products assigned to it",
            )
        cur.execute("DELETE FROM categories WHERE slug = %s", (slug,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Category not found")
    conn.commit()
