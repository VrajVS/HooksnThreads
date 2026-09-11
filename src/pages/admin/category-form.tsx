import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { ApiError, api, uploadImage } from "@/lib/api";
import type { Category } from "@/data/site-data";
import { cn } from "@/lib/utils";

const SLUG_PATTERN = /^[a-z0-9-]+$/;

interface FieldErrors {
  slug?: string;
  name?: string;
  tagline?: string;
  image?: string;
}

export function AdminCategoryFormPage() {
  const { slug } = useParams();
  const isEdit = Boolean(slug);
  const navigate = useNavigate();

  const [slugValue, setSlugValue] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || !slug) return;
    api.get<Category>(`/categories/${slug}`).then((c) => {
      setSlugValue(c.slug);
      setName(c.name);
      setTagline(c.tagline);
      setImage(c.image);
      setLoaded(true);
    });
  }, [isEdit, slug]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage("categories", file);
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
      if (!slugValue.trim()) errors.slug = "Slug is required";
      else if (!SLUG_PATTERN.test(slugValue))
        errors.slug = "Only lowercase letters, numbers, and hyphens";
    }
    if (!name.trim()) errors.name = "Name is required";
    if (!tagline.trim()) errors.tagline = "Tagline is required";
    if (!image) errors.image = "Upload an image";
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit && slug) {
        await api.put(`/admin/categories/${slug}`, { name, tagline, image });
      } else {
        await api.post("/admin/categories", { slug: slugValue, name, tagline, image });
      }
      toast.success(isEdit ? "Category updated" : "Category created");
      navigate("/admin/categories");
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
      <h1 className="text-2xl font-semibold">{isEdit ? "Edit Category" : "Add Category"}</h1>

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
            <label htmlFor="slug" className="text-sm font-medium">
              Slug (URL)
            </label>
            <input
              id="slug"
              value={slugValue}
              onChange={(e) => setSlugValue(e.target.value)}
              className={cn(
                "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
                fieldErrors.slug
                  ? "border-destructive focus:ring-destructive"
                  : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
              )}
            />
            {fieldErrors.slug && <p className="text-xs text-destructive">{fieldErrors.slug}</p>}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.name
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tagline" className="text-sm font-medium">
            Tagline
          </label>
          <input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-1",
              fieldErrors.tagline
                ? "border-destructive focus:ring-destructive"
                : "border-zinc-200 focus:ring-[hsl(var(--admin-accent))]",
            )}
          />
          {fieldErrors.tagline && (
            <p className="text-xs text-destructive">{fieldErrors.tagline}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="image" className="text-sm font-medium">
            Image
          </label>
          {image && <img src={image} alt="" className="h-32 w-32 rounded-xl object-cover" />}
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

        <Button type="submit" variant="accent" size="lg" disabled={submitting || uploading} className="mt-2">
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Saving..." : "Save Category"}
        </Button>
      </form>
    </AdminLayout>
  );
}
