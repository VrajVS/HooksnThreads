export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function isAdminSessionExpiry(path: string, status: number) {
  return status === 401 && path.startsWith("/admin/") && !path.startsWith("/admin/auth");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!res.ok) {
    if (isAdminSessionExpiry(path, res.status) && window.location.pathname !== "/admin/login") {
      window.location.assign("/admin/login");
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export async function uploadImage(kind: "products" | "categories", file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`/api/admin/uploads/${kind}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401 && window.location.pathname !== "/admin/login") {
      window.location.assign("/admin/login");
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? `Upload failed (${res.status})`);
  }
  return res.json() as Promise<{ url: string }>;
}
