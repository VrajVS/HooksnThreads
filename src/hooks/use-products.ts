import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Product } from "@/data/site-data";

export function useProducts(params?: { category?: string; search?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();

    setLoading(true);
    setError(null);
    api
      .get<Product[]>(`/products${qs ? `?${qs}` : ""}`)
      .then(setProducts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params?.category, params?.search]);

  return { products, loading, error };
}
