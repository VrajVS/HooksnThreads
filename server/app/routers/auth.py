import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg import Connection
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import COOKIE_SECURE, CUSTOMER_COOKIE_NAME, PUBLIC_URL
from app.db import get_conn
from app.deps import require_customer
from app.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
log = logging.getLogger("hnt.auth")

COOKIE_KWARGS = dict(httponly=True, samesite="lax", secure=COOKIE_SECURE, max_age=60 * 60 * 24 * 30, path="/")

VERIFICATION_TTL = timedelta(days=2)
PHONE_RE = re.compile(r"^\+?\d{10,15}$")


class SignupBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=1)
    phone: str = Field(min_length=10)
    accept_terms: bool
    marketing_opt_in: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        stripped = re.sub(r"[\s\-()]", "", v)
        if not PHONE_RE.match(stripped):
            raise ValueError("Enter a valid phone number (10-15 digits)")
        return stripped

    @field_validator("accept_terms")
    @classmethod
    def _terms(cls, v: bool) -> bool:
        if not v:
            raise ValueError("You must accept the terms to create an account")
        return v


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class VerifyBody(BaseModel):
    token: str


def _issue_verification_token(conn: Connection, customer_id: int, email: str) -> str:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + VERIFICATION_TTL
    with conn.cursor() as cur:
        # One live token at a time per customer — cheaper than juggling many.
        cur.execute("DELETE FROM email_verification_tokens WHERE customer_id = %s", (customer_id,))
        cur.execute(
            "INSERT INTO email_verification_tokens (token, customer_id, expires_at) VALUES (%s, %s, %s)",
            (token, customer_id, expires),
        )
    conn.commit()
    # No SMTP wired up in this project — log the link so it can be copied
    # from the uvicorn console during development. Replace this with a real
    # send when an email provider is configured.
    link = f"{PUBLIC_URL}/verify-email?token={token}"
    log.warning("Email verification link for %s: %s", email, link)
    return token


@router.post("/signup")
def signup(body: SignupBody, response: Response, conn: Connection = Depends(get_conn)):
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO customer_users
                    (email, password_hash, full_name, phone, marketing_opt_in, terms_accepted_at)
                VALUES (%s, %s, %s, %s, %s, now())
                RETURNING id
                """,
                (
                    body.email.lower(),
                    hash_password(body.password),
                    body.full_name,
                    body.phone,
                    body.marketing_opt_in,
                ),
            )
            user_id = cur.fetchone()[0]
        conn.commit()
    except UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    _issue_verification_token(conn, user_id, body.email.lower())

    token = create_token(user_id, "customer")
    response.set_cookie(CUSTOMER_COOKIE_NAME, token, **COOKIE_KWARGS)
    return {
        "id": user_id,
        "email": body.email.lower(),
        "full_name": body.full_name,
        "phone": body.phone,
        "email_verified": False,
        "marketing_opt_in": body.marketing_opt_in,
    }


@router.post("/login")
def login(body: LoginBody, response: Response, conn: Connection = Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, password_hash, full_name, phone, email_verified_at, marketing_opt_in
            FROM customer_users WHERE email = %s
            """,
            (body.email.lower(),),
        )
        row = cur.fetchone()

    if row is None or not verify_password(body.password, row[1]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(row[0], "customer")
    response.set_cookie(CUSTOMER_COOKIE_NAME, token, **COOKIE_KWARGS)
    return {
        "id": row[0],
        "email": body.email.lower(),
        "full_name": row[2],
        "phone": row[3],
        "email_verified": row[4] is not None,
        "marketing_opt_in": row[5],
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(CUSTOMER_COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")
    return {"ok": True}


@router.get("/me")
def me(user: dict = Depends(require_customer)):
    return user


@router.post("/verify-email")
def verify_email(body: VerifyBody, conn: Connection = Depends(get_conn)):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT customer_id, expires_at FROM email_verification_tokens WHERE token = %s",
            (body.token,),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=400, detail="Invalid or already-used verification link")
        customer_id, expires_at = row
        if expires_at < datetime.now(timezone.utc):
            cur.execute("DELETE FROM email_verification_tokens WHERE token = %s", (body.token,))
            conn.commit()
            raise HTTPException(status_code=400, detail="This verification link has expired")
        cur.execute(
            "UPDATE customer_users SET email_verified_at = now() WHERE id = %s",
            (customer_id,),
        )
        cur.execute("DELETE FROM email_verification_tokens WHERE customer_id = %s", (customer_id,))
    conn.commit()
    return {"ok": True}


@router.post("/resend-verification")
def resend_verification(user: dict = Depends(require_customer), conn: Connection = Depends(get_conn)):
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    _issue_verification_token(conn, user["id"], user["email"])
    return {"ok": True}
