from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel

from app.db import get_conn
from app.deps import require_permission
from app.permissions import PERMISSIONS, PERMISSION_KEYS

router = APIRouter(prefix="/api/admin", tags=["admin-roles"])


class RoleBody(BaseModel):
    name: str
    description: str | None = None
    permissions: list[str] = []


def _validate_permissions(keys: list[str]) -> None:
    invalid = [k for k in keys if k not in PERMISSION_KEYS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown permission keys: {invalid}")


@router.get("/permissions")
def list_permissions(_admin: dict = Depends(require_permission("roles.view"))):
    """Full permission catalogue, grouped by module — used by the role form UI."""
    return PERMISSIONS


@router.get("/roles")
def list_roles(
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("roles.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    where = "WHERE name ILIKE %s" if search else ""
    params: list = [f"%{search}%"] if search else []

    query = f"""
        SELECT r.id, r.name, r.description, r.is_system, r.created_at,
               (SELECT count(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
               (SELECT count(*) FROM store_users a WHERE a.role_id = r.id) AS user_count,
               count(*) OVER() AS total
        FROM roles r
        {where}
        ORDER BY r.is_system DESC, r.name
        LIMIT %s OFFSET %s
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total}


@router.get("/roles/{role_id}")
def get_role(
    role_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("roles.view")),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT r.id, r.name, r.description, r.is_system, r.created_at,
                   COALESCE(array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), '{}')
                       AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.id
            WHERE r.id = %s
            GROUP BY r.id
            """,
            (role_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Role not found")
    row["permissions"] = list(row["permissions"])
    return row


@router.post("/roles", status_code=201)
def create_role(
    body: RoleBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("roles.create")),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    _validate_permissions(body.permissions)

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO roles (name, description, is_system)
                VALUES (%s, %s, false)
                RETURNING id
                """,
                (body.name.strip(), body.description),
            )
            new_id = cur.fetchone()[0]
            for key in body.permissions:
                cur.execute(
                    "INSERT INTO role_permissions (role_id, permission_key) VALUES (%s, %s)",
                    (new_id, key),
                )
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A role with this name already exists")

    return {"id": new_id}


@router.put("/roles/{role_id}")
def update_role(
    role_id: int,
    body: RoleBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("roles.update")),
):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    _validate_permissions(body.permissions)

    with conn.cursor() as cur:
        cur.execute("SELECT is_system FROM roles WHERE id = %s", (role_id,))
        existing = cur.fetchone()
    if existing is None:
        raise HTTPException(status_code=404, detail="Role not found")
    if existing[0]:
        raise HTTPException(status_code=403, detail="System roles cannot be edited")

    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE roles SET name = %s, description = %s WHERE id = %s",
                (body.name.strip(), body.description, role_id),
            )
            cur.execute("DELETE FROM role_permissions WHERE role_id = %s", (role_id,))
            for key in body.permissions:
                cur.execute(
                    "INSERT INTO role_permissions (role_id, permission_key) VALUES (%s, %s)",
                    (role_id, key),
                )
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="A role with this name already exists")

    return {"id": role_id}


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("roles.delete")),
):
    with conn.cursor() as cur:
        cur.execute("SELECT is_system FROM roles WHERE id = %s", (role_id,))
        existing = cur.fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="Role not found")
        if existing[0]:
            raise HTTPException(status_code=403, detail="System roles cannot be deleted")

        cur.execute("SELECT count(*) FROM store_users WHERE role_id = %s", (role_id,))
        user_count = cur.fetchone()[0]
        if user_count > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete a role that still has {user_count} user(s) assigned",
            )

        cur.execute("DELETE FROM roles WHERE id = %s", (role_id,))
    conn.commit()
