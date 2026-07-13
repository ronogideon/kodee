const BASE =
  (typeof window !== "undefined" && (window as any).__KODEE_API__) ||
  (import.meta as any).env?.VITE_API_URL ||
  "/api";

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
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Can't reach the Kodee API at ${BASE}. Check it's running and VITE_API_URL is set.`);
  }

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  // A non-JSON body almost always means the request hit the static site host
  // (SPA fallback returns index.html) instead of the API — i.e. VITE_API_URL
  // is missing or wrong. Fail loudly rather than returning an empty object.
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`Request failed (${res.status} ${res.statusText}).`);
    throw new Error(
      `Expected JSON from ${BASE}${path} but got "${contentType || "no content-type"}". ` +
        `Set VITE_API_URL to your Kodee API URL (…/api) and rebuild.`
    );
  }

  const data = raw ? JSON.parse(raw) : {};
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status}).`);
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, b?: any) => request<T>("POST", p, b),
  put: <T>(p: string, b?: any) => request<T>("PUT", p, b),
  patch: <T>(p: string, b?: any) => request<T>("PATCH", p, b),
  del: <T>(p: string) => request<T>("DELETE", p),
};
