import pathlib
import sys

import psycopg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, DATABASE_URL
from app.permissions import all_permission_keys
from app.security import hash_password

CATEGORIES = [
    (
        "forever-flowers",
        "Forever Flowers",
        "Crochet blooms that never wilt, in colours you choose.",
        "/images/marquee-a4.jpg",
    ),
    (
        "keychains",
        "Keychains",
        "Small companions for your keys, bags, and pockets.",
        "/images/product-bow-keychain.jpg",
    ),
    (
        "hair-accessories",
        "Hair Accessories",
        "Handmade pieces to dress up any hairstyle.",
        "/images/product-gajra.jpg",
    ),
    (
        "home-decor",
        "Home Decor",
        "Soft, stitched touches for shelves and tabletops.",
        "/images/product-sunflower-mirror.jpg",
    ),
    (
        "earrings",
        "Earrings",
        "Lightweight, handcrafted earrings for everyday wear.",
        "/images/carousel-earrings.jpg",
    ),
]

# handle, title, price, image_url, category_slug, featured
PRODUCTS = [
    ("rose-flower", "Rose", 240, "/images/product-rose.jpg", "forever-flowers", True),
    ("sunflower-bouquet", "Sunflower Bouquet", 1680, "/images/product-sunflower-bouquet.jpg", "forever-flowers", True),
    ("lily", "Lily", 420, "/images/marquee-a1.jpg", "forever-flowers", False),
    ("tulip", "Tulip", 180, "/images/marquee-a2.jpg", "forever-flowers", False),
    ("calla-lily", "Calla Lily", 180, "/images/marquee-a3.jpg", "forever-flowers", False),
    ("rose-bouquet", "Rose Bouquet", 1200, "/images/marquee-a4.jpg", "forever-flowers", False),
    ("bow-keychain", "Bow Keychain", 180, "/images/product-bow-keychain.jpg", "keychains", True),
    ("evil-eye-keychain", "Evil Eye Keychain", 180, "/images/product-evil-eye-pouch.jpg", "keychains", True),
    ("twin-daisies-keychain", "Twin Daisies", 180, "/images/marquee-b2.jpg", "keychains", False),
    ("heart-keychain", "Heart Keychain", 180, "/images/hero-custom-thumb.jpg", "keychains", False),
    ("donut-keychain", "Donut", 180, "/images/product-donut-keychain.jpg", "keychains", False),
    ("octopus-keychain", "Octopus", 180, "/images/product-octopus-keychain.jpg", "keychains", False),
    ("gajra", "Gajra", 360, "/images/product-gajra.jpg", "hair-accessories", True),
    ("sunflower-gajra", "Sunflower Gajra", 360, "/images/product-sunflower-gajra.jpg", "hair-accessories", False),
    ("scrunchie", "Scrunchie", 160, "/images/guide-hair.jpg", "hair-accessories", False),
    ("rose-hairtie", "Rose Hairtie", 160, "/images/product-rose-hairtie.jpg", "hair-accessories", False),
    ("bow-hairtie", "Bow Hairtie", 120, "/images/product-bow-hairtie.jpg", "hair-accessories", False),
    ("flower-hairtie", "Flower Hairtie", 75, "/images/product-flower-hairtie.jpg", "hair-accessories", False),
    ("sunflower-mirror", "Sunflower Mirror", 2400, "/images/product-sunflower-mirror.jpg", "home-decor", True),
    ("cushion", "Cushion", 1200, "/images/marquee-b3.jpg", "home-decor", False),
    ("coaster", "Coaster", 80, "/images/marquee-b4.jpg", "home-decor", False),
    ("table-runner", "Table Runner", 950, "/images/carousel-homedecor.jpg", "home-decor", False),
    ("jar-cover", "Jar Cover", 1200, "/images/guide-homedecor.jpg", "home-decor", False),
    ("waffle-coaster", "Waffle Coaster", 140, "/images/product-waffle-coaster.jpg", "home-decor", False),
    ("flower-earring", "Flower Earring", 120, "/images/carousel-earrings.jpg", "earrings", False),
    ("sakura-earring", "Sakura Earring", 120, "/images/product-sakura-earring.jpg", "earrings", False),
    ("rose-earring", "Rose Earring", 120, "/images/product-rose-earring.jpg", "earrings", False),
]


def main():
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    with conn.cursor() as cur:
        for slug, name, tagline, image_url in CATEGORIES:
            cur.execute(
                """
                INSERT INTO categories (slug, name, tagline, image_url)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE
                SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, image_url = EXCLUDED.image_url
                """,
                (slug, name, tagline, image_url),
            )
        print(f"Seeded {len(CATEGORIES)} categories.")

        for handle, title, price, image_url, category_slug, featured in PRODUCTS:
            cur.execute(
                """
                INSERT INTO products (handle, title, price, image_url, category_slug, featured)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (handle) DO UPDATE
                SET title = EXCLUDED.title, price = EXCLUDED.price, image_url = EXCLUDED.image_url,
                    category_slug = EXCLUDED.category_slug, featured = EXCLUDED.featured,
                    updated_at = now()
                """,
                (handle, title, price, image_url, category_slug, featured),
            )
        print(f"Seeded {len(PRODUCTS)} products.")

        # Seed Super Admin role with every permission.
        cur.execute(
            """
            INSERT INTO roles (name, description, is_system)
            VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE
            SET description = EXCLUDED.description, is_system = EXCLUDED.is_system
            RETURNING id
            """,
            ("Super Admin", "Full access to every module. Cannot be edited or deleted.", True),
        )
        super_admin_role_id = cur.fetchone()[0]

        for key in all_permission_keys():
            cur.execute(
                """
                INSERT INTO role_permissions (role_id, permission_key)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (super_admin_role_id, key),
            )
        print(f"Seeded Super Admin role with {len(all_permission_keys())} permissions.")

        if ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD:
            cur.execute(
                """
                INSERT INTO store_users (email, password_hash, full_name, role_id)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (email) DO UPDATE
                SET role_id = EXCLUDED.role_id
                """,
                (
                    ADMIN_SEED_EMAIL,
                    hash_password(ADMIN_SEED_PASSWORD),
                    "Store Admin",
                    super_admin_role_id,
                ),
            )
            print(f"Seeded admin account: {ADMIN_SEED_EMAIL}")

        # Also link any pre-existing store users without a role to Super Admin,
        # so nobody gets locked out by the new role_id column.
        cur.execute(
            "UPDATE store_users SET role_id = %s WHERE role_id IS NULL",
            (super_admin_role_id,),
        )

    conn.close()
    print("Seed complete.")


if __name__ == "__main__":
    main()
