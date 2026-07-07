// Runtime API config. This default ships in the build; in production it is
// overwritten at container start by scripts/gen-env.mjs using the API_URL
// (or VITE_API_URL) service variable. Empty here so local dev falls back to
// the Vite proxy at /api.
window.__KODEE_API__ = "";
