import { Router } from "express";
import { prisma } from "../prisma";
import {
  hashPassword,
  comparePassword,
  signToken,
  authRequired,
  AuthedRequest,
} from "../auth";

const router = Router();

// Register a new landlord (self-serve). Renters & caretakers are created by
// their landlord, not here.
router.post("/register", async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "That email is already in use." });

  const user = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phone: phone || "",
      passwordHash: await hashPassword(password),
      role: "LANDLORD",
    },
  });
  const token = signToken({ id: user.id, role: "LANDLORD", name: user.name });
  res.json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  const user = await prisma.user.findUnique({
    where: { email: (email || "").toLowerCase() },
  });
  if (!user || !(await comparePassword(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  const token = signToken({
    id: user.id,
    role: user.role as any,
    name: user.name,
    landlordId: user.landlordId,
  });
  res.json({ token, user: publicUser(user) });
});

router.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

function publicUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    landlordId: u.landlordId,
  };
}

export default router;
