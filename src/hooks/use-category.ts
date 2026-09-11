import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { Category } from "@/data/site-data";

export function useCategory(slug: string | undefined) {
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    api
      .get<Category>(`/categories/${slug}`)
      .then(setCategory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return { category, loading, notFound };
}
