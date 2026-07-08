// Superadmin — manages the landlords being serviced by Kodee (the Dartbit
// superadmin-console pattern): platform stats, suspend/activate landlords,
// credit SMS wallets manually, and set the platform SMS rate.

import { Router } from "express";
import { prisma } from "../prisma";
import { authRequired, requireRole, AuthedRequest } from "../auth";
import { getOrCreateWallet, creditWallet, getSmsRate, setSmsRate } from "../wallet";

const router = Router();
router.use(authRequired, requireRole("SUPERADMIN"));

// Platform dashboard.
router.get("/dashboard", async (_req, res) => {
  const [landlords, properties, units, occupied, tenants, smsAgg, wallets, rate] =
    await Promise.all([
      prisma.user.count({ where: { role: "LANDLORD" } }),
      prisma.property.count(),
      prisma.unit.count(),
      prisma.unit.count({ where: { status: "OCCUPIED" } }),
      prisma.user.count({ where: { role: "RENTER" } }),
      prisma.message.aggregate({
        where: { status: "SENT" },
        _count: true,
        _sum: { cost: true },
      }),
      prisma.smsWallet.aggregate({ _sum: { balance: true, toppedUp: true, spent: true } }),
      getSmsRate(),
    ]);
  res.json({
    landlords,
    properties,
    units,
    occupied,
    occupancy: units ? Math.round((occupied / units) * 100) : 0,
    tenants,
    smsSent: smsAgg._count,
    smsRevenue: smsAgg._sum.cost || 0,
    walletBalanceTotal: wallets._sum.balance || 0,
    walletToppedUpTotal: wallets._sum.toppedUp || 0,
    walletSpentTotal: wallets._sum.spent || 0,
    smsRatePerSms: rate,
  });
});

// Landlords with per-landlord stats.
router.get("/landlords", async (_req, res) => {
  const landlords = await prisma.user.findMany({
    where: { role: "LANDLORD" },
    orderBy: { createdAt: "desc" },
    include: {
      wallet: true,
      properties: { include: { units: { select: { status: true } } } },
      _count: { select: { staff: true } },
    },
  });
  const messageCounts = await prisma.message.groupBy({
    by: ["landlordId"],
    where: { status: "SENT" },
    _count: true,
  });
  const msgMap = new Map(messageCounts.map((m) => [m.landlordId, m._count]));

  res.json(
    landlords.map((l) => {
      const units = l.properties.reduce((s, p) => s + p.units.length, 0);
      const occupied = l.properties.reduce(
        (s, p) => s + p.units.filter((u) => u.status === "OCCUPIED").length,
        0
      );
      return {
        id: l.id,
        name: l.name,
        email: l.email,
        phone: l.phone,
        suspended: l.suspended,
        createdAt: l.createdAt,
        properties: l.properties.length,
        units,
        occupied,
        occupancy: units ? Math.round((occupied / units) * 100) : 0,
        staff: l._count.staff,
        smsBalance: l.wallet?.balance || 0,
        smsSent: msgMap.get(l.id) || 0,
      };
    })
  );
});

// Suspend / reactivate a landlord (blocks them and all their users at login).
router.patch("/landlords/:id", async (req: AuthedRequest, res) => {
  const landlord = await prisma.user.findFirst({
    where: { id: req.params.id, role: "LANDLORD" },
  });
  if (!landlord) return res.status(404).json({ error: "Landlord not found" });
  const { suspended } = req.body || {};
  const updated = await prisma.user.update({
    where: { id: landlord.id },
    data: { ...(typeof suspended === "boolean" && { suspended }) },
  });
  res.json({ id: updated.id, suspended: updated.suspended });
});

// Manually credit a landlord's SMS wallet (e.g. offline payment, goodwill).
router.post("/landlords/:id/credit", async (req: AuthedRequest, res) => {
  const landlord = await prisma.user.findFirst({
    where: { id: req.params.id, role: "LANDLORD" },
  });
  if (!landlord) return res.status(404).json({ error: "Landlord not found" });
  const amount = Number(req.body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Enter a valid amount." });
  }
  const wallet = await creditWallet(
    landlord.id,
    amount,
    req.body?.note || `Credited by superadmin`
  );
  res.json({ ok: true, balance: wallet.balance });
});

// Wallet detail + ledger for one landlord.
router.get("/landlords/:id/wallet", async (req, res) => {
  const wallet = await getOrCreateWallet(req.params.id);
  const txns = await prisma.smsWalletTxn.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ balance: wallet.balance, toppedUp: wallet.toppedUp, spent: wallet.spent, txns });
});

// Platform settings — SMS rate.
router.get("/settings", async (_req, res) => {
  res.json({ smsRatePerSms: await getSmsRate() });
});
router.patch("/settings", async (req, res) => {
  const rate = Number(req.body?.smsRatePerSms);
  if (!Number.isFinite(rate) || rate < 0) {
    return res.status(400).json({ error: "Enter a valid rate." });
  }
  await setSmsRate(rate);
  res.json({ smsRatePerSms: rate });
});

export default router;
