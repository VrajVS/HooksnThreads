import pathlib
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.config import UPLOAD_DIR
from app.deps import require_admin

router = APIRouter(prefix="/api/admin/uploads", tags=["admin-uploads"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_BYTES = 5 * 1024 * 1024

UPLOAD_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent / UPLOAD_DIR


@router.post("/{kind}")
async def upload_image(
    kind: str,
    file: UploadFile = File(...),
    _admin: dict = Depends(require_admin),
):
    if kind not in {"products", "categories"}:
        raise HTTPException(status_code=400, detail="kind must be 'products' or 'categories'")

    ext = pathlib.Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only jpg, jpeg, png, and webp images are allowed")

    contents = await file.read()
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5MB or smaller")

    dest_dir = UPLOAD_ROOT / kind
    dest_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    (dest_dir / filename).write_bytes(contents)

    return {"url": f"/uploads/{kind}/{filename}"}
