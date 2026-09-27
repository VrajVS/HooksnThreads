"""Import the product catalogue from the old static Hooks & Threads site.

Usage (from server/):
    venv\\Scripts\\python.exe scripts\\import_catalog.py D:\\Personal\\HooksnThreads

Parses <source>/index.html (one <section class="collection"> per category,
one <article class="prod"> per product), copies each product image into
public/images/products/, and upserts categories + products. Idempotent:
re-running updates title/price/image/category in place.
"""

import html
import pathlib
import re
import shutil
import sys

import psycopg

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from app.config import DATABASE_URL

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
IMAGE_DIR = REPO_ROOT / "public" / "images" / "products"
IMAGE_URL_PREFIX = "/images/products"

# Old site's data-cat -> (slug, display name). The first five already exist in
# the DB (from seed.py); their name/tagline/image are left untouched.
CATEGORY_MAP = {
    "flowers": ("forever-flowers", "Forever Flowers"),
    "keychains": ("keychains", "Keychains"),
    "hair": ("hair-accessories", "Hair Accessories"),
    "home": ("home-decor", "Home Decor"),
    "earrings": ("earrings", "Earrings"),
    "festivals": ("festive", "Festive Specials"),
    "bagcharms": ("bag-charms", "Bag Charms"),
    "pouches": ("earphone-pouches", "Earphone Pouches"),
    "car": ("car-decor", "Car Decor"),
    "bookmarks": ("bookmarks", "Bookmarks"),
    "outfit": ("elevate-your-outfit", "Elevate Your Outfit"),
    "choker": ("choker", "Choker"),
    "belt": ("belt", "Belt"),
    "tops": ("tops", "Tops"),
    "beach": ("beachwear", "Beachwear"),
    "phone": ("phone-accessories", "Phone Accessories"),
}

# Suffix always appended to handles in these categories, since their titles
# ("Rose", "Donut", ...) repeat across categories.
HANDLE_SUFFIX = {
    "keychains": "keychain",
    "bagcharms": "bag-charm",
    "pouches": "pouch",
}

# Products already seeded by seed.py, keyed by (data-cat, title) -> existing
# handle, so we update them instead of creating duplicates.
EXISTING_HANDLES = {
    ("flowers", "Rose"): "rose-flower",
    ("flowers", "Sunflower Bouquet"): "sunflower-bouquet",
    ("flowers", "Lily"): "lily",
    ("flowers", "Tulip"): "tulip",
    ("flowers", "Calla Lily"): "calla-lily",
    ("flowers", "Rose Bouquet"): "rose-bouquet",
    ("keychains", "Bow"): "bow-keychain",
    ("keychains", "Evil Eye"): "evil-eye-keychain",
    ("keychains", "Twin Daisies"): "twin-daisies-keychain",
    ("keychains", "Heart Keychain"): "heart-keychain",
    ("keychains", "Donut"): "donut-keychain",
    ("keychains", "Octopus"): "octopus-keychain",
    ("hair", "Gajra"): "gajra",
    ("hair", "Sunflower Gajra"): "sunflower-gajra",
    ("hair", "Scrunchie"): "scrunchie",
    ("hair", "Rose Hairtie"): "rose-hairtie",
    ("hair", "Bow Hairtie"): "bow-hairtie",
    ("hair", "Flower Hairtie"): "flower-hairtie",
    ("home", "Sunflower Mirror"): "sunflower-mirror",
    ("home", "Cushion"): "cushion",
    ("home", "Coaster"): "coaster",
    ("home", "Table Runner"): "table-runner",
    ("home", "Jar Cover"): "jar-cover",
    ("home", "Waffle Coaster"): "waffle-coaster",
    ("earrings", "Flower Earring"): "flower-earring",
    ("earrings", "Sakura Earring"): "sakura-earring",
    ("earrings", "Rose Earring"): "rose-earring",
}


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def strip_tags(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def parse_catalog(source_html: str):
    live = re.sub(r"<!--.*?-->", "", source_html, flags=re.S)
    sections = []
    for sec in re.finditer(
        r'<section class="collection" data-cat="([^"]+)".*?</section>', live, re.S
    ):
        cat, body = sec.group(1), sec.group(0)
        sub = re.search(r'<p class="cat-sub">(.*?)</p>', body, re.S)
        products = []
        for art in re.finditer(r'<article class="prod">(.*?)</article>', body, re.S):
            h = art.group(1)
            img = re.search(r'src="assets/([^"]+)"', h).group(1)
            title = strip_tags(re.search(r"<h3>(.*?)</h3>", h, re.S).group(1))
            price_text = strip_tags(re.search(r'<span class="price">(.*?)</span>', h, re.S).group(1))
            price = int(re.search(r"\d[\d,]*", price_text).group(0).replace(",", ""))
            products.append((title, price, img))
        sections.append((cat, strip_tags(sub.group(1)) if sub else "", products))
    return sections


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: import_catalog.py <path to old site folder>")
    source = pathlib.Path(sys.argv[1])
    sections = parse_catalog((source / "index.html").read_text(encoding="utf-8"))

    unknown = [cat for cat, _, _ in sections if cat not in CATEGORY_MAP]
    if unknown:
        sys.exit(f"Unmapped categories in source: {unknown}")

    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    conn = psycopg.connect(DATABASE_URL, autocommit=True)
    with conn.cursor() as cur:
        cur.execute("SELECT slug FROM categories")
        existing_categories = {row[0] for row in cur.fetchall()}
        # Handles are derived from the source alone (not current DB rows) so
        # re-running produces the same handles and updates in place.
        taken = set(EXISTING_HANDLES.values())

        new_categories = 0
        count = 0
        for cat, tagline, products in sections:
            slug, name = CATEGORY_MAP[cat]
            if slug not in existing_categories:
                cover = products[0][2].lower()
                cur.execute(
                    "INSERT INTO categories (slug, name, tagline, image_url) VALUES (%s, %s, %s, %s)",
                    (slug, name, tagline, f"{IMAGE_URL_PREFIX}/{cover}"),
                )
                new_categories += 1

            for title, price, img in products:
                dest_name = img.lower()
                shutil.copy2(source / "assets" / img, IMAGE_DIR / dest_name)

                handle = EXISTING_HANDLES.get((cat, title))
                if handle is None:
                    handle = slugify(title)
                    suffix = HANDLE_SUFFIX.get(cat)
                    if suffix and not handle.endswith(suffix):
                        handle = f"{handle}-{suffix}"
                    if handle in taken:
                        handle = f"{handle}-{HANDLE_SUFFIX.get(cat, slugify(name))}"
                    if handle in taken:
                        sys.exit(f"Handle collision for {cat}/{title}: {handle}")
                taken.add(handle)

                cur.execute(
                    """
                    INSERT INTO products (handle, title, price, image_url, category_slug)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (handle) DO UPDATE
                    SET title = EXCLUDED.title, price = EXCLUDED.price,
                        image_url = EXCLUDED.image_url, category_slug = EXCLUDED.category_slug,
                        updated_at = now()
                    """,
                    (handle, title, price, f"{IMAGE_URL_PREFIX}/{dest_name}", slug),
                )
                count += 1

    print(f"Added {new_categories} categories; upserted {count} products.")


if __name__ == "__main__":
    main()
