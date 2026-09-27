import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";

export interface Address {
  id: number;
  recipient_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  is_default: boolean;
  created_at: string;
}

export type AddressInput = Omit<Address, "id" | "created_at">;

export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.get<Address[]>("/addresses");
      setAddresses(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: AddressInput) => {
      await api.post("/addresses", input);
      await refresh();
    },
    [refresh],
  );

  const update = useCallback(
    async (id: number, input: AddressInput) => {
      await api.put(`/addresses/${id}`, input);
      await refresh();
    },
    [refresh],
  );

  const setDefault = useCallback(
    async (id: number) => {
      await api.post(`/addresses/${id}/default`);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: number) => {
      await api.delete(`/addresses/${id}`);
      await refresh();
    },
    [refresh],
  );

  return { addresses, loading, error, refresh, create, update, setDefault, remove };
}
