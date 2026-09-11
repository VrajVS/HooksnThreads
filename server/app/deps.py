from fastapi import Depends, HTTPException, Request
from psycopg import Connection

from app.config import ADMIN_COOKIE_NAME, CUSTOMER_COOKIE_NAME
from app.db import get_conn
from app.security import decode_token


def require_customer(request: Request, conn: Connection = Depends(get_conn)) -> dict:
    token = request.cookies.get(CUSTOMER_COOKIE_NAME)
    user_id = decode_token(token, "customer") if token else None
    if user_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, email, full_name, phone FROM customer_users WHERE id = %s", (user_id,)
        )
        row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"id": row[0], "email": row[1], "full_name": row[2], "phone": row[3]}


def _load_admin(conn: Connection, admin_id: int) -> dict | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT a.id, a.email, a.full_name, a.role_id,
                   r.name, r.is_system,
                   COALESCE(array_agg(rp.permission_key) FILTER (WHERE rp.permission_key IS NOT NULL), '{}')
            FROM store_users a
            LEFT JOIN roles r ON r.id = a.role_id
            LEFT JOIN role_permissions rp ON rp.role_id = a.role_id
            WHERE a.id = %s
            GROUP BY a.id, r.id
            """,
            (admin_id,),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "email": row[1],
        "full_name": row[2],
        "role_id": row[3],
        "role_name": row[4],
        "is_system_role": bool(row[5]) if row[5] is not None else False,
        "permissions": list(row[6]) if row[6] else [],
    }


def require_admin(request: Request, conn: Connection = Depends(get_conn)) -> dict:
    token = request.cookies.get(ADMIN_COOKIE_NAME)
    admin_id = decode_token(token, "admin") if token else None
    if admin_id is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    admin = _load_admin(conn, admin_id)
    if admin is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return admin


def require_permission(key: str):
    """Factory returning a FastAPI dependency that requires the given permission
    key. Super Admin (is_system_role=True) is always granted every permission."""

    def dep(admin: dict = Depends(require_admin)) -> dict:
        if admin.get("is_system_role"):
            return admin
        if key not in admin.get("permissions", []):
            raise HTTPException(status_code=403, detail=f"Missing permission: {key}")
        return admin

    return dep
