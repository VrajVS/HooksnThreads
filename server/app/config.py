import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ["DATABASE_URL"]
JWT_SECRET = os.environ["JWT_SECRET"]
CUSTOMER_COOKIE_NAME = os.environ.get("CUSTOMER_COOKIE_NAME", "session_token")
ADMIN_COOKIE_NAME = os.environ.get("ADMIN_COOKIE_NAME", "admin_token")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:5180")
ADMIN_SEED_EMAIL = os.environ.get("ADMIN_SEED_EMAIL")
ADMIN_SEED_PASSWORD = os.environ.get("ADMIN_SEED_PASSWORD")
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
# Public address of the storefront, used in links sent to customers.
PUBLIC_URL = os.environ.get("PUBLIC_URL", "http://localhost:5180").rstrip("/")
# Set to true in production (HTTPS) so auth cookies are never sent over plain HTTP.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
