const BASE = (import.meta as any).env?.VITE_API_URL || "/api";

let token: string | null = localStorage.getItem("kodee_token");

export function setToken(t: string | null) {
  token = t;
  if (t) localStorage.setItem("kodee_token", t);
  else localStorage.removeItem("kodee_token");
}
export function getToken() {
  return token;
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || "Request failed");
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: any) => request<T>("POST", p, b),
  patch: <T>(p: string, b?: any) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};
