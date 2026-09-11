from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg import Connection
from pydantic import BaseModel, EmailStr

from app.config import ADMIN_COOKIE_NAME
from app.db import get_conn
from app.deps import require_admin
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/admin/auth", tags=["admin-auth"])

COOKIE_KWARGS = dict(httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")


class AdminLoginBody(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
def admin_login(body: AdminLoginBody, response: Response, conn: Connection = Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, password_hash, full_name FROM store_users WHERE email = %s",
            (body.email.lower(),),
        )
        row = cur.fetchone()

    if row is None or not verify_password(body.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row[0], "admin")
    response.set_cookie(ADMIN_COOKIE_NAME, token, **COOKIE_KWARGS)
    return {"id": row[0], "email": body.email, "full_name": row[2]}


@router.post("/logout")
def admin_logout(response: Response):
    response.delete_cookie(ADMIN_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def admin_me(admin: dict = Depends(require_admin)):
    return admin


@router.post("/change-password")
def admin_change_password(
    body: ChangePasswordBody,
    conn: Connection = Depends(get_conn),
    admin: dict = Depends(require_admin),
):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    with conn.cursor() as cur:
        cur.execute("SELECT password_hash FROM store_users WHERE id = %s", (admin["id"],))
        row = cur.fetchone()

    if row is None or not verify_password(body.current_password, row[0]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE store_users SET password_hash = %s WHERE id = %s",
            (hash_password(body.new_password), admin["id"]),
        )
    conn.commit()
    return {"ok": True}
