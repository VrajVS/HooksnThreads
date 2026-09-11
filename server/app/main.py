import pathlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGIN, UPLOAD_DIR
from app.routers import (
    admin_auth,
    admin_categories,
    admin_products,
    admin_roles,
    admin_users,
    auth,
    categories,
    products,
    uploads,
)

app = FastAPI(title="Hooks & Threads API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

upload_root = pathlib.Path(__file__).resolve().parent.parent / UPLOAD_DIR
upload_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_root)), name="uploads")

app.include_router(auth.router)
app.include_router(admin_auth.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(admin_categories.router)
app.include_router(admin_products.router)
app.include_router(admin_users.router)
app.include_router(admin_roles.router)
app.include_router(uploads.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
