import os

from fastapi import APIRouter, Depends, HTTPException
from psycopg import Connection
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from app.db import get_conn
from app.deps import require_customer
from app.orders import Line, insert_order, load_order, log_event, order_stage
from app.payments import create_razorpay_order, verify_payment_signature

router = APIRouter(prefix="/api/orders", tags=["orders"])


class CartLine(BaseModel):
    handle: str
    quantity: int = Field(ge=1, le=99)


class PlaceOrderBody(BaseModel):
    address_id: int
    notes: str | None = Field(default=None, max_length=1000)
    items: list[CartLine] = Field(min_length=1, max_length=50)


class CreateRazorpayOrderBody(BaseModel):
    address_id: int
    notes: str | None = Field(default=None, max_length=1000)
    items: list[CartLine] = Field(min_length=1, max_length=50)


class VerifyPaymentBody(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    address_id: int
    notes: str | None = Field(default=None, max_length=1000)
    items: list[CartLine] = Field(min_length=1, max_length=50)


def _format_address(row: dict) -> str:
    parts = [row["line1"], row["line2"], row["landmark"], row["city"], f"{row['state']} {row['pincode']}"]
    return ", ".join(p for p in parts if p)


@router.post("", status_code=201)
def place_order(
    body: PlaceOrderBody,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM customer_addresses WHERE id = %s AND customer_id = %s",
            (body.address_id, user["id"]),
        )
        address = cur.fetchone()
    if address is None:
        raise HTTPException(status_code=400, detail="Choose a delivery address")

    try:
        # Storefront orders start pending: stock is only deducted once the
        # studio confirms the order in the admin panel.
        order_id = insert_order(
            conn,
            source="storefront",
            customer_id=user["id"],
            customer_name=address["recipient_name"],
            customer_phone=address["phone"],
            customer_email=user["email"],
            shipping_address=_format_address(address),
            notes=(body.notes or "").strip() or None,
            # Prices always come from the DB, never from the client's cart.
            lines=[Line(line.handle, None, line.quantity, None) for line in body.items],
        )
        log_event(conn, order_id, "created", to_value="pending", detail="Placed on the website",
                  actor="customer")
        log_event(conn, order_id, "stage", to_value=order_stage(conn, order_id), actor="customer")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id}


@router.post("/razorpay-order")
def create_razorpay_order_endpoint(
    body: CreateRazorpayOrderBody,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM customer_addresses WHERE id = %s AND customer_id = %s",
            (body.address_id, user["id"]),
        )
        address = cur.fetchone()
    if address is None:
        raise HTTPException(status_code=400, detail="Choose a delivery address")

    # Calculate total from DB prices
    with conn.cursor(row_factory=dict_row) as cur:
        placeholders = ",".join(["%s"] * len(body.items))
        cur.execute(
            f"SELECT handle, price FROM products WHERE handle IN ({placeholders})",
            [item.handle for item in body.items],
        )
        products = {row["handle"]: row["price"] for row in cur.fetchall()}

    total_paise = 0
    for item in body.items:
        if item.handle not in products:
            raise HTTPException(status_code=400, detail=f"Product {item.handle} not found")
        total_paise += int(products[item.handle] * 100 * item.quantity)

    try:
        razorpay_order = create_razorpay_order(
            total_paise,
            user["email"],
            address["phone"],
            body.notes or ""
        )
        return {
            "razorpay_order_id": razorpay_order["id"],
            "amount": razorpay_order["amount"],
            "currency": razorpay_order["currency"],
            # Public key id, so the checkout always matches the server's (test or live) keys.
            "key_id": os.getenv("RAZORPAY_KEY_ID"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create Razorpay order: {str(e)}")


@router.post("/verify-payment")
def verify_payment_endpoint(
    body: VerifyPaymentBody,
    user: dict = Depends(require_customer),
    conn: Connection = Depends(get_conn),
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "SELECT * FROM customer_addresses WHERE id = %s AND customer_id = %s",
            (body.address_id, user["id"]),
        )
        address = cur.fetchone()
    if address is None:
        raise HTTPException(status_code=400, detail="Choose a delivery address")

    if not verify_payment_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    try:
        order_id = insert_order(
            conn,
            source="storefront",
            customer_id=user["id"],
            customer_name=address["recipient_name"],
            customer_phone=address["phone"],
            customer_email=user["email"],
            shipping_address=_format_address(address),
            notes=(body.notes or "").strip() or None,
            lines=[Line(line.handle, None, line.quantity, None) for line in body.items],
        )
        # Record payment
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO order_payments (order_id, amount, mode, paid_on, note) VALUES (%s, %s, %s, NOW(), %s)",
                (order_id, None, "online", f"Razorpay payment ID: {body.razorpay_payment_id}"),
            )
        log_event(conn, order_id, "created", to_value="pending", detail="Placed on the website with online payment",
                  actor="customer")
        log_event(conn, order_id, "stage", to_value=order_stage(conn, order_id), actor="customer")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"id": order_id, "razorpay_payment_id": body.razorpay_payment_id}


@router.get("")
def my_orders(user: dict = Depends(require_customer), conn: Connection = Depends(get_conn)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM orders WHERE customer_id = %s ORDER BY created_at DESC", (user["id"],))
        ids = [row["id"] for row in cur.fetchall()]
    return [_public(load_order(conn, order_id, user["id"])) for order_id in ids]


@router.get("/{order_id}")
def my_order(order_id: int, user: dict = Depends(require_customer), conn: Connection = Depends(get_conn)):
    order = load_order(conn, order_id, user["id"])
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return _public(order)


def _public(order: dict) -> dict:
    keys = ("id", "invoice_number", "status", "customer_name", "customer_phone",
            "shipping_address", "notes", "subtotal", "total", "created_at", "charges")
    public = {k: order[k] for k in keys}
    # Production progress and work notes are internal to the studio.
    item_keys = ("id", "handle", "title", "unit_price", "quantity", "image")
    public["items"] = [{k: item[k] for k in item_keys} for item in order["items"]]
    return public
