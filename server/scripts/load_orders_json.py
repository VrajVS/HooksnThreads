"""Load orders produced by excel_orders_to_json.py into the database.

    python scripts/load_orders_json.py orders.json [--replace] [--dry-run]

Everything is inserted in one transaction. Imported orders are tagged in
their notes ("Imported from Crochet Orders.xlsx"); --replace deletes earlier
imports first, so the load can be repeated. Orders entered by hand are never
touched: an invoice-number clash with one of them aborts the load.

Imported orders are marked stock_deducted without any inventory movements,
so historic sales never take accessory stock, not even when their status is
changed later.
"""

import argparse
import datetime as dt
import json
import pathlib
import re
import sys

import psycopg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import DATABASE_URL

TAG = "Imported from Crochet Orders.xlsx"

# Words a sheet adds after a catalogue title for items of that category.
CATEGORY_SUFFIXES = {
    "keychains": ["keychain", "key chain", "keychian"],
    "bag-charms": ["bagcharm", "bag charm"],
    "earphone-pouches": ["pouch", "earphone pouch"],
    "forever-flowers": ["stick", "stick flower", "flower"],
    "earrings": ["earring"],
}
# When a bare title fits several products ("Rose"), prefer these categories.
CATEGORY_PRIORITY = ["forever-flowers", "hair-accessories", "home-decor", "keychains", "bag-charms"]


# Colours describe a variant, not a different product.
COLOUR_WORDS = {
    "red", "white", "pink", "blue", "light", "dark", "yellow", "black", "green", "purple",
    "lilac", "baby", "navy", "maroon", "brown", "orange", "beige", "peach", "teal", "grey",
}


def squash(text: str) -> str:
    text = re.sub(r"[\(\[].*?[\)\]]", " ", text.lower())
    words = [w for w in re.findall(r"[a-z]+", text) if w not in COLOUR_WORDS]
    words = [w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w for w in words]
    return "".join(words)


def build_aliases(products: list[tuple[str, str, str]]) -> dict[str, str]:
    rank = {c: i for i, c in enumerate(CATEGORY_PRIORITY)}
    aliases: dict[str, tuple[int, str]] = {}
    for handle, title, category in products:
        r = rank.get(category, len(rank))
        candidates = [(squash(title), r)]
        if title.lower().startswith("stuffed "):
            # The sheet writes "Hexagon keychain" for "Stuffed Hexagon".
            candidates += [(squash(f"{title[8:]} {sfx}"), -1) for sfx in CATEGORY_SUFFIXES.get(category, [])]
        candidates += [(squash(f"{title} {sfx}"), -1) for sfx in CATEGORY_SUFFIXES.get(category, [])]
        for alias, prio in candidates:
            if alias and (alias not in aliases or prio < aliases[alias][0]):
                aliases[alias] = (prio, handle)
    return {a: h for a, (_, h) in aliases.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json_path")
    ap.add_argument("--replace", action="store_true", help="delete earlier imports first")
    ap.add_argument("--dry-run", action="store_true", help="roll back at the end")
    args = ap.parse_args()

    orders = json.loads(pathlib.Path(args.json_path).read_text(encoding="utf-8"))
    conn = psycopg.connect(DATABASE_URL)
    with conn.transaction():
        cur = conn.cursor()
        if args.replace:
            cur.execute("DELETE FROM orders WHERE notes LIKE %s", (TAG + "%",))
            print(f"removed {cur.rowcount} previously imported orders")

        cur.execute("SELECT invoice_number FROM orders")
        existing = {r[0] for r in cur.fetchall()}
        clashes = [o["invoice_number"] for o in orders if o["invoice_number"] in existing]
        if clashes:
            sys.exit(f"Invoice numbers already used by existing orders: {', '.join(clashes)}. Nothing loaded.")

        cur.execute("SELECT handle, title, category_slug FROM products")
        aliases = build_aliases(cur.fetchall())

        linked = lines = 0
        for o in orders:
            items = o["items"]
            subtotal = sum(round(i["unit_price"]) * i["quantity"] for i in items)
            charges_total = sum(c["amount"] for c in o["charges"])
            created = dt.datetime.fromisoformat(o["order_date"] + "T12:00:00+05:30")
            cur.execute(
                """
                INSERT INTO orders (source, status, invoice_number, order_date, customer_name,
                                    notes, subtotal, charges_total, delivered, delivery_date,
                                    payment_mode, stock_deducted, created_at, updated_at)
                VALUES ('admin', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, %s, now())
                RETURNING id
                """,
                (o["status"], o["invoice_number"], o["order_date"], o["customer_name"], o["notes"],
                 subtotal, charges_total, o["delivered"], o["delivery_date"], o["payment_mode"], created),
            )
            order_id = cur.fetchone()[0]
            for i in items:
                handle = aliases.get(squash(i["title"]))
                lines += 1
                linked += handle is not None
                cur.execute(
                    """
                    INSERT INTO order_items (order_id, product_handle, title, unit_price, quantity,
                                             prepared, work_note)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (order_id, handle, i["title"], round(i["unit_price"]), i["quantity"],
                     i["prepared"], i.get("work_note")),
                )
            for c in o["charges"]:
                cur.execute(
                    "INSERT INTO order_charges (order_id, label, amount) VALUES (%s, %s, %s)",
                    (order_id, c["label"], round(c["amount"])),
                )
            for p in o["payments"]:
                cur.execute(
                    """
                    INSERT INTO order_payments (order_id, amount, mode, paid_on, note)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (order_id, round(p["amount"]), p["mode"], o["delivery_date"] or o["order_date"],
                     p.get("note")),
                )

        print(f"loaded {len(orders)} orders, {lines} item lines "
              f"({linked} linked to catalogue products, {lines - linked} kept as custom items)")
        if args.dry_run:
            raise _Rollback()


class _Rollback(Exception):
    pass


if __name__ == "__main__":
    try:
        main()
    except _Rollback:
        print("dry run: rolled back, nothing saved")
