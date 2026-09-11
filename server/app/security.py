from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import JWT_SECRET

TOKEN_TTL = timedelta(days=30)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_token(subject_id: int, kind: str) -> str:
    payload = {
        "sub": str(subject_id),
        "kind": kind,
        "exp": datetime.now(timezone.utc) + TOKEN_TTL,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token: str, expected_kind: str) -> int | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    if payload.get("kind") != expected_kind:
        return None
    try:
        return int(payload["sub"])
    except (KeyError, ValueError):
        return None
