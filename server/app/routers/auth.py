from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg import Connection
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, EmailStr

from app.config import CUSTOMER_COOKIE_NAME
from app.db import get_conn
from app.deps import require_customer
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_KWARGS = dict(httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30, path="/")


class SignupBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None


class LoginBody(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
def signup(body: SignupBody, response: Response, conn: Connection = Depends(get_conn)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO customer_users (email, password_hash, full_name, phone)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (body.email.lower(), hash_password(body.password), body.full_name, body.phone),
            )
            user_id = cur.fetchone()[0]
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    token = create_token(user_id, "customer")
    response.set_cookie(CUSTOMER_COOKIE_NAME, token, **COOKIE_KWARGS)
    return {"id": user_id, "email": body.email, "full_name": body.full_name}


@router.post("/login")
def login(body: LoginBody, response: Response, conn: Connection = Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, password_hash, full_name FROM customer_users WHERE email = %s",
            (body.email.lower(),),
        )
        row = cur.fetchone()

    if row is None or not verify_password(body.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row[0], "customer")
    response.set_cookie(CUSTOMER_COOKIE_NAME, token, **COOKIE_KWARGS)
    return {"id": row[0], "email": body.email, "full_name": row[2]}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(CUSTOMER_COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(require_customer)):
    return user
