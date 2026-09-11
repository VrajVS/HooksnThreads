import { useEffect, useState } from "react";

import { ApiError, api } from "@/lib/api";
import type { Product } from "@/data/site-data";

export function useProduct(handle: string | undefined) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    setNotFound(false);
    api
      .get<Product>(`/products/${handle}`)
      .then(setProduct)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [handle]);

  return { product, loading, notFound };
}
