import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import landlordRoutes from "./routes/landlord";
import renterRoutes from "./routes/renter";
import caretakerRoutes from "./routes/caretaker";
import { startScheduler } from "./scheduler";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "kodee" }));

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
app.listen(PORT, () => {
  console.log(`Kodee API listening on :${PORT}`);
  startScheduler();
});
