import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Category } from "@/data/site-data";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Category[]>("/categories")
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
