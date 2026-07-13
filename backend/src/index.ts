import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import landlordRoutes from "./routes/landlord";
import renterRoutes from "./routes/renter";
import caretakerRoutes from "./routes/caretaker";
import superadminRoutes from "./routes/superadmin";
import darajaRoutes from "./routes/daraja";
import { startScheduler } from "./scheduler";

const app = express();

// Allowed origins come from CORS_ORIGINS (comma-separated). Blank = allow all (dev).
// Wildcard subdomains are supported for per-landlord tenant subdomains, e.g.
//   CORS_ORIGINS="https://kodee.app,https://*.kodee.app,https://admin.kodee.app"
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

function originAllowed(origin: string): boolean {
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.some((allowed) => {
    if (allowed === origin) return true;
    if (allowed.includes("*")) {
      // Escape regex chars, then turn * into a one-label wildcard.
      const pattern =
        "^" + allowed.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[a-z0-9-]+") + "$";
      return new RegExp(pattern, "i").test(origin);
    }
    return false;
  });
}

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (no origin) and anything when the list is empty.
      if (!origin || originAllowed(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());

const VERSION = "1.1.3";
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "kodee", version: VERSION })
);

app.use("/api/auth", authRoutes);
app.use("/api/landlord", landlordRoutes);
app.use("/api/renter", renterRoutes);
app.use("/api/caretaker", caretakerRoutes);
app.use("/api/superadmin", superadminRoutes);
app.use("/api/daraja", darajaRoutes);

// Fallback error handler.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`Kodee API listening on :${PORT}`);
  await ensureSuperadmin();
  startScheduler();
});

// Guarantee a superadmin exists on every boot — no reseed needed on a live DB.
// Override the defaults with SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD env vars.
async function ensureSuperadmin() {
  try {
    const { prisma } = await import("./prisma");
    const { hashPassword } = await import("./auth");
    const existing = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } });
    if (existing) return;
    const email = (process.env.SUPERADMIN_EMAIL || "superadmin@kodee.app").toLowerCase();
    const password = process.env.SUPERADMIN_PASSWORD || "kodee1234";
    await prisma.user.create({
      data: {
        name: "Kodee Admin",
        email,
        phone: "",
        passwordHash: await hashPassword(password),
        role: "SUPERADMIN",
      },
    });
    console.log(`[boot] Superadmin created: ${email}`);
  } catch (err) {
    console.error("[boot] ensureSuperadmin failed", err);
  }
}
