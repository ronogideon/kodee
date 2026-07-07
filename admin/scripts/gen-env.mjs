// Writes dist/env.js from the runtime service variable so the API URL can be
// changed without rebuilding. Runs at container start (see package.json start).
import { writeFileSync, existsSync, mkdirSync } from "node:fs";

let url = (process.env.API_URL || process.env.VITE_API_URL || "").trim();
url = url.replace(/\/+$/, ""); // strip trailing slashes
// Be forgiving: if a bare origin was given, append /api.
if (url && !/\/api$/.test(url)) url += "/api";

if (!existsSync("dist")) mkdirSync("dist");
writeFileSync("dist/env.js", `window.__KODEE_API__=${JSON.stringify(url)};\n`);
console.log(`[gen-env] API base = ${url || "(empty → falls back to /api)"}`);
