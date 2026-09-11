CREATE TABLE IF NOT EXISTS products (
    handle TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    image_url TEXT NOT NULL,
    category_slug TEXT NOT NULL REFERENCES categories (slug),
    featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category_slug ON products (category_slug);
