from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, EmailStr

from app.db import get_conn
from app.deps import require_admin, require_permission
from app.security import hash_password

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


SELECT_COLUMNS = """
    a.id, a.email, a.full_name, a.role_id, a.created_at,
    r.name AS role_name, r.is_system AS role_is_system
"""


class UserCreateBody(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role_id: int


class UserUpdateBody(BaseModel):
    email: EmailStr
    full_name: str
    password: str | None = None
    role_id: int


@router.get("")
def list_users(
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("users.view")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    offset = (page - 1) * page_size

    where = "WHERE (a.email ILIKE %s OR a.full_name ILIKE %s)" if search else ""
    params: list = []
    if search:
        term = f"%{search}%"
        params.extend([term, term])

    query = f"""
        SELECT {SELECT_COLUMNS}, count(*) OVER() AS total
        FROM store_users a
        LEFT JOIN roles r ON r.id = a.role_id
        {where}
        ORDER BY a.created_at DESC
        LIMIT %s OFFSET %s
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, [*params, page_size, offset])
        rows = cur.fetchall()

    total = rows[0]["total"] if rows else 0
    for row in rows:
        del row["total"]
    return {"items": rows, "total": total}


@router.get("/{user_id}")
def get_user(
    user_id: int,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("users.view")),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"""
            SELECT {SELECT_COLUMNS}
            FROM store_users a LEFT JOIN roles r ON r.id = a.role_id
            WHERE a.id = %s
            """,
            (user_id,),
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    return row


@router.post("", status_code=201)
def create_user(
    body: UserCreateBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("users.create")),
):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO store_users (email, password_hash, full_name, role_id)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (body.email.lower(), hash_password(body.password), body.full_name, body.role_id),
            )
            new_id = cur.fetchone()[0]
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An admin with this email already exists")
    except ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Unknown role")

    return {"id": new_id}


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdateBody,
    conn: Connection = Depends(get_conn),
    _admin: dict = Depends(require_permission("users.update")),
):
    if body.password is not None and body.password != "" and len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        with conn.cursor() as cur:
            if body.password:
                cur.execute(
                    """
                    UPDATE store_users
                    SET email = %s, full_name = %s, password_hash = %s, role_id = %s
                    WHERE id = %s
                    """,
                    (
                        body.email.lower(),
                        body.full_name,
                        hash_password(body.password),
                        body.role_id,
                        user_id,
                    ),
                )
            else:
                cur.execute(
                    """
                    UPDATE store_users
                    SET email = %s, full_name = %s, role_id = %s
                    WHERE id = %s
                    """,
                    (body.email.lower(), body.full_name, body.role_id, user_id),
                )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An admin with this email already exists")
    except ForeignKeyViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Unknown role")

    return {"id": user_id}


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    conn: Connection = Depends(get_conn),
    current_admin: dict = Depends(require_permission("users.delete")),
):
    if user_id == current_admin["id"]:
        raise HTTPException(status_code=403, detail="You cannot delete your own account")

    with conn.cursor() as cur:
        cur.execute("DELETE FROM store_users WHERE id = %s", (user_id,))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    conn.commit()


# Kept for parity with existing patterns — image upload etc use plain require_admin.
_ = require_admin
