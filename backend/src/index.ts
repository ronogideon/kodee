import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import landlordRoutes from "./routes/landlord";
import renterRoutes from "./routes/renter";
import caretakerRoutes from "./routes/caretaker";
import { startScheduler } from "./scheduler";

const app = express();

// Allowed origins come from CORS_ORIGINS (comma-separated). Blank = allow all (dev).
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow non-browser clients (no origin) and anything when the list is empty.
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json());

const VERSION = "1.0.5";
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "kodee", version: VERSION })
);

app.use("/api/auth", authRoutes);
app.use("/api/landlord", landlordRoutes);
app.use("/api/renter", renterRoutes);
app.use("/api/caretaker", caretakerRoutes);

// Fallback error handler.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end." });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kodee API listening on :${PORT}`);
  startScheduler();
});
