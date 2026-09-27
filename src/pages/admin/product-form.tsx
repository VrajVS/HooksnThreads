import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { ApiError, api, uploadImage } from "@/lib/api";
import type { Category, Product } from "@/data/site-data";
import { type AccessoryOption, type Qty, formatQty } from "@/lib/inventory";
import { cn } from "@/lib/utils";

interface AccessoryLine {
  key: number;
  accessoryId: string;
  quantity: string;
}

let lineKey = 0;

const HANDLE_PATTERN = /^[a-z0-9-]+$/;

interface FieldErrors {
  handle?: string;
  title?: string;
  price?: string;
  category?: string;
  image?: string;
}

export function AdminProductFormPage() {
  const { handle } = useParams();
  const isEdit = Boolean(handle);
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [handleValue, setHandleValue] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [featured, setFeatured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loaded, setLoaded] = useState(!isEdit);
  const [accessoryOptions, setAccessoryOptions] = useState<AccessoryOption[]>([]);
  const [lines, setLines] = useState<AccessoryLine[]>([]);
  const [lineErrors, setLineErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<AccessoryOption[]>("/admin/accessories/options").then(setAccessoryOptions).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Category[]>("/categories").then((cats) => {
      setCategories(cats);
      if (!isEdit && cats.length > 0) setCategory(cats[0].slug);
    });
  }, [isEdit]);

  useEffect(() => {
    if (!isEdit || !handle) return;
    api
      .get<Product & { accessories: { accessory_id: number; quantity: Qty }[] }>(`/admin/products/${handle}`)
      .then((p) => {
      setHandleValue(p.handle);
      setTitle(p.title);
      setPrice(String(p.price));
      setCategory(p.category);
      setImage(p.image);
      setFeatured(p.featured ?? false);
      setLines(
        p.accessories.map((a) => ({
          key: ++lineKey,
          accessoryId: String(a.accessory_id),
          quantity: formatQty(a.quantity),
        })),
      );
      setLoaded(true);
    });
  }, [isEdit, handle]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage("products", file);
      setImage(url);
      setFieldErrors((prev) => ({ ...prev, image: undefined }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!isEdit) {
      if (!handleValue.trim()) errors.handle = "Handle is required";
      else if (!HANDLE_PATTERN.test(handleValue))
        errors.handle = "Only lowercase letters, numbers, and hyphens";
    }
    if (!title.trim()) errors.title = "Title is required";
    const priceNum = Number(price);
    if (!price || Number.isNaN(priceNum) || priceNum <= 0)
      errors.price = "Enter a price greater than 0";
    if (!category) errors.category = "Select a category";
    if (!image) errors.image = "Upload an image";
    return errors;
  };

  const validateLines = (): Record<number, string> => {
    const errors: Record<number, string> = {};
    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!line.accessoryId) errors[line.key] = "Choose an accessory";
      else if (!line.quantity || Number.isNaN(qty) || qty <= 0) errors[line.key] = "Enter a quantity greater than 0";
    }
    return errors;
  };

  const updateLine = (key: number, patch: Partial<AccessoryLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setLineErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    const accessoryErrors = validateLines();
    setFieldErrors(errors);
    setLineErrors(accessoryErrors);
    if (Object.keys(errors).length > 0 || Object.keys(accessoryErrors).length > 0) return;

    const accessories = lines.map((l) => ({
      accessory_id: Number(l.accessoryId),
      quantity: Number(l.quantity),
    }));

    setSubmitting(true);
    try {
      if (isEdit && handle) {
        await api.put(`/admin/products/${handle}`, {
          title,
          price: Number(price),
          image,
          category,
          featured,
          accessories,
        });
      } else {
        await api.post("/admin/products", {
          handle: handleValue,
          title,
          price: Number(price),
          image,
          category,
          featured,
          accessories,
        });
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      navigate("/admin/products");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return (
      <AdminLayout>
        <p className="text-muted-foreground">Loading...</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-2xl font-semibold">{isEdit ? "Edit Product" : "Add Product"}</h1>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-6 flex max-w-xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm"
      >
        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        {!isEdit && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="handle" className="text-sm font-medium">
              Handle (URL slug)
            </label>
            <input
              id="handle"
              value={handleValue}
              onChange={(e) => setHandleValue(e.target.value)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                fieldErrors.handle
                  ? "border-destructive focus:ring-destructive"
                  : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
              )}
            />
            {fieldErrors.handle && (
              <p className="text-xs text-destructive">{fieldErrors.handle}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.title
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="price" className="text-sm font-medium">
            Price (₹)
          </label>
          <input
            id="price"
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.price
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.price && <p className="text-xs text-destructive">{fieldErrors.price}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.category
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.category && (
            <p className="text-xs text-destructive">{fieldErrors.category}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="image" className="text-sm font-medium">
            Image
          </label>
          {image && (
            <img src={image} alt="" className="h-32 w-32 rounded-xl object-cover" />
          )}
          <input
            id="image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="text-sm"
          />
          {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          {fieldErrors.image && <p className="text-xs text-destructive">{fieldErrors.image}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={featured}
            onChange={(e) => setFeatured(e.target.checked)}
          />
          Featured on home page
        </label>

        <fieldset className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4">
          <legend className="px-1 text-sm font-medium">Accessories used</legend>
          <p className="-mt-1 text-xs text-muted-foreground">
            Materials needed to make one piece. They're deducted from stock when an order for this
            product is confirmed.
          </p>

          {lines.length === 0 && (
            <p className="text-sm text-muted-foreground">No accessories mapped.</p>
          )}

          {lines.map((line) => {
            const chosenElsewhere = new Set(
              lines.filter((l) => l.key !== line.key).map((l) => l.accessoryId),
            );
            const selected = accessoryOptions.find((a) => String(a.id) === line.accessoryId);
            return (
              <div key={line.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Accessory"
                    value={line.accessoryId}
                    onChange={(e) => updateLine(line.key, { accessoryId: e.target.value })}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
                  >
                    <option value="" disabled>
                      Choose accessory
                    </option>
                    {accessoryOptions.map((a) => (
                      <option key={a.id} value={String(a.id)} disabled={chosenElsewhere.has(String(a.id))}>
                        {a.name} ({formatQty(a.stock)} {a.unit} in stock)
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Quantity per piece"
                    type="number"
                    min="0"
                    step="any"
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                    placeholder="Qty"
                    className="w-20 rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--admin-accent))]"
                  />
                  <span className="w-12 truncate text-xs text-muted-foreground">{selected?.unit ?? ""}</span>
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    aria-label="Remove accessory"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {lineErrors[line.key] && (
                  <p className="text-xs text-destructive">{lineErrors[line.key]}</p>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={accessoryOptions.length === 0 || lines.length >= accessoryOptions.length}
              onClick={() =>
                setLines((prev) => [...prev, { key: ++lineKey, accessoryId: "", quantity: "1" }])
              }
            >
              <Plus className="h-4 w-4" />
              Add accessory
            </Button>
            {accessoryOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No accessories yet.{" "}
                <Link to="/admin/accessories/new" className="text-[hsl(var(--admin-accent))] hover:underline">
                  Create one
                </Link>
              </p>
            )}
          </div>
        </fieldset>

        <Button type="submit" variant="accent" size="lg" disabled={submitting || uploading} className="mt-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Save Product"}
        </Button>
      </form>
    </AdminLayout>
  );
}
