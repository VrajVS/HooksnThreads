import re

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator

from app.db import get_conn
from app.deps import require_customer

router = APIRouter(prefix="/api/addresses", tags=["addresses"])

PHONE_RE = re.compile(r"^\+?\d{10,15}$")
PINCODE_RE = re.compile(r"^\d{6}$")


class AddressBody(BaseModel):
    recipient_name: str = Field(min_length=1)
    phone: str
    line1: str = Field(min_length=1)
    line2: str | None = None
    city: str = Field(min_length=1)
    state: str = Field(min_length=1)
    pincode: str
    landmark: str | None = None
    is_default: bool = False

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        stripped = re.sub(r"[\s\-()]", "", v)
        if not PHONE_RE.match(stripped):
            raise ValueError("Enter a valid phone number (10-15 digits)")
        return stripped

    @field_validator("pincode")
    @classmethod
    def _pincode(cls, v: str) -> str:
        stripped = v.strip()
        if not PINCODE_RE.match(stripped):
            raise ValueError("PIN code must be exactly 6 digits")
        return stripped


SELECT_COLS = (
    "id, recipient_name, phone, line1, line2, city, state, pincode, landmark, "
    "is_default, created_at"
)


def _clear_defaults(conn: Connection, customer_id: int, keep_id: int | None = None) -> None:
    with conn.cursor() as cur:
        if keep_id is None:
            cur.execute(
                "UPDATE customer_addresses SET is_default = FALSE WHERE customer_id = %s",
                (customer_id,),
            )
        else:
            cur.execute(
                "UPDATE customer_addresses SET is_default = FALSE "
                "WHERE customer_id = %s AND id <> %s",
                (customer_id, keep_id),
            )


@router.get("")
def list_addresses(user: dict = Depends(require_customer), conn: Connection = Depends(get_conn)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"SELECT {SELECT_COLS} FROM customer_addresses "
            "WHERE customer_id = %s ORDER BY is_default DESC, created_at DESC",
            (user["id"],),
        )
        return cur.fetchall()


@router.post("", status_code=201)
def create_address(
    body: AddressBody,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM customer_addresses WHERE customer_id = %s", (user["id"],))
        (existing,) = cur.fetchone()
    # First address is default automatically; further ones only when asked.
    is_default = body.is_default or existing == 0

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO customer_addresses
                (customer_id, recipient_name, phone, line1, line2, city, state,
                 pincode, landmark, is_default)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                user["id"],
                body.recipient_name,
                body.phone,
                body.line1,
                body.line2,
                body.city,
                body.state,
                body.pincode,
                body.landmark,
                is_default,
            ),
        )
        new_id = cur.fetchone()[0]

    if is_default:
        _clear_defaults(conn, user["id"], keep_id=new_id)
    conn.commit()
    return {"id": new_id}


@router.put("/{address_id}")
def update_address(
    address_id: int,
    body: AddressBody,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE customer_addresses
            SET recipient_name = %s, phone = %s, line1 = %s, line2 = %s,
                city = %s, state = %s, pincode = %s, landmark = %s, is_default = %s
            WHERE id = %s AND customer_id = %s
            """,
            (
                body.recipient_name,
                body.phone,
                body.line1,
                body.line2,
                body.city,
                body.state,
                body.pincode,
                body.landmark,
                body.is_default,
                address_id,
                user["id"],
            ),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Address not found")

    if body.is_default:
        _clear_defaults(conn, user["id"], keep_id=address_id)
    conn.commit()
    return {"id": address_id}


@router.post("/{address_id}/default")
def set_default(
    address_id: int,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE customer_addresses SET is_default = TRUE "
            "WHERE id = %s AND customer_id = %s",
            (address_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Address not found")
    _clear_defaults(conn, user["id"], keep_id=address_id)
    conn.commit()
    return {"ok": True}


@router.delete("/{address_id}", status_code=204)
def delete_address(
    address_id: int,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor() as cur:
        cur.execute(
            "DELETE FROM customer_addresses WHERE id = %s AND customer_id = %s",
            (address_id, user["id"]),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Address not found")
    conn.commit()
