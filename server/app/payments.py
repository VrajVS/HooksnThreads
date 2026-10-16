import hmac
import hashlib
import os
import razorpay
from typing import Optional

client = razorpay.Client(
    auth=(os.getenv("RAZORPAY_KEY_ID"), os.getenv("RAZORPAY_KEY_SECRET"))
)


def create_razorpay_order(amount_paise: int, customer_email: str, customer_phone: str, order_notes: str = "") -> dict:
    """Create a Razorpay order. Amount in paise (1 INR = 100 paise)."""
    data = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"order-{os.urandom(6).hex()}",
        "notes": {
            "notes": order_notes[:255] if order_notes else ""
        }
    }
    order = client.order.create(data=data)
    return order


def verify_payment_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    """Verify Razorpay payment signature."""
    data = f"{razorpay_order_id}|{razorpay_payment_id}"
    computed = hmac.new(
        os.getenv("RAZORPAY_KEY_SECRET").encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()
    return computed == razorpay_signature
