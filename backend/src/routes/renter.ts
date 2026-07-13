import { Router } from "express";
import { prisma } from "../prisma";
import { authRequired, requireRole, AuthedRequest } from "../auth";
import { currentPeriod, periodLabel, refreshInvoiceStatus } from "../billing";
import { stkPush, callbackUrl } from "../daraja";

const router = Router();
router.use(authRequired, requireRole("RENTER"));

// Active tenancy for the signed-in renter.
async function activeTenancy(renterId: string) {
  return prisma.tenancy.findFirst({
    where: { renterId, active: true },
    include: { unit: { include: { property: true } } },
    orderBy: { startDate: "desc" },
  });
}

router.get("/dashboard", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy)
    return res.json({ tenancy: null, message: "No active tenancy on file." });

  const period = currentPeriod();
  const invoice = await prisma.invoice.findUnique({
    where: { tenancyId_period: { tenancyId: tenancy.id, period } },
  });
  const reading = await prisma.meterReading.findUnique({
    where: { unitId_period: { unitId: tenancy.unitId, period } },
  });
  const recentInvoices = await prisma.invoice.findMany({
    where: { tenancyId: tenancy.id },
    orderBy: { period: "desc" },
    take: 6,
  });
  const payments = await prisma.payment.findMany({
    where: { tenancyId: tenancy.id },
    orderBy: { paidAt: "desc" },
    take: 6,
  });

  res.json({
    tenancy: {
      id: tenancy.id,
      startDate: tenancy.startDate,
      unit: {
        label: tenancy.unit.label,
        type: tenancy.unit.type,
        rent: tenancy.unit.rent,
        hasWater: tenancy.unit.hasWater,
        hasGarbage: tenancy.unit.hasGarbage,
        hasElectricity: tenancy.unit.hasElectricity,
      },
      property: {
        name: tenancy.unit.property.name,
        address: tenancy.unit.property.address,
      },
    },
    period,
    periodLabel: periodLabel(period),
    invoice,
    reading: reading
      ? {
          previous: reading.previous,
          current: reading.current,
          consumption: reading.consumption,
          ratePerCbm: reading.ratePerCbm,
          amount: reading.amount,
        }
      : null,
    recentInvoices,
    payments,
  });
});

router.get("/invoices", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy) return res.json([]);
  // Include all invoices across this renter's tenancies (history).
  const tenancies = await prisma.tenancy.findMany({
    where: { renterId: req.user!.id },
    select: { id: true },
  });
  const invoices = await prisma.invoice.findMany({
    where: { tenancyId: { in: tenancies.map((t) => t.id) } },
    orderBy: { period: "desc" },
  });
  res.json(invoices);
});

// "Pay now" — STK push to the landlord's settlement method (their DarajaConfig)
// when configured; otherwise the demo path records the payment directly.
router.post("/pay", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy) return res.status(400).json({ error: "No active tenancy." });
  const { amount, period, phone } = req.body || {};
  const per = period || currentPeriod();
  const invoice = await prisma.invoice.findUnique({
    where: { tenancyId_period: { tenancyId: tenancy.id, period: per } },
  });
  if (!invoice)
    return res.status(404).json({ error: "No invoice for that month yet." });
  const payAmount = Number(amount) || invoice.total - invoice.amountPaid;
  if (!(payAmount > 0)) return res.status(400).json({ error: "Nothing left to pay." });

  // Resolve the landlord's settlement method.
  const property = await prisma.property.findUnique({
    where: { id: tenancy.unit.propertyId },
    select: { landlordId: true },
  });
  const config = property
    ? await prisma.darajaConfig.findUnique({ where: { landlordId: property.landlordId } })
    : null;

  if (config?.active && callbackUrl()) {
    const renter = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const msisdnSource = phone || renter?.phone || "";
    try {
      const stk = await stkPush({
        creds: {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          shortcode: config.shortcode,
          passkey: config.passkey,
          type: config.type as any,
          accountRef: config.accountRef,
        },
        phone: msisdnSource,
        amount: payAmount,
        description: "Rent",
      });
      const txn = await prisma.mpesaTransaction.create({
        data: {
          purpose: "RENT",
          landlordId: property!.landlordId,
          invoiceId: invoice.id,
          tenancyId: tenancy.id,
          phone: msisdnSource,
          amount: payAmount,
          checkoutRequestId: stk.checkoutRequestId,
          merchantRequestId: stk.merchantRequestId,
        },
      });
      return res.json({ pending: true, txnId: txn.id });
    } catch (err: any) {
      return res.status(502).json({ error: err.message || "M-Pesa request failed. Try again." });
    }
  }

  // Demo fallback — no settlement method configured.
  const payment = await prisma.payment.create({
    data: {
      tenancyId: tenancy.id,
      invoiceId: invoice.id,
      amount: payAmount,
      method: "MPESA",
      reference: `KODEE-${Date.now()}`,
    },
  });
  await refreshInvoiceStatus(invoice.id);
  res.json({ ok: true, payment });
});

// Poll an STK transaction the renter initiated.
router.get("/pay/status/:id", async (req: AuthedRequest, res) => {
  const tenancies = await prisma.tenancy.findMany({
    where: { renterId: req.user!.id },
    select: { id: true },
  });
  const txn = await prisma.mpesaTransaction.findFirst({
    where: { id: req.params.id, tenancyId: { in: tenancies.map((t) => t.id) } },
  });
  if (!txn) return res.status(404).json({ error: "Transaction not found" });
  res.json({ status: txn.status, resultDesc: txn.resultDesc, receipt: txn.receipt });
});

router.get("/tickets", async (req: AuthedRequest, res) => {
  const tenancies = await prisma.tenancy.findMany({
    where: { renterId: req.user!.id },
    select: { id: true },
  });
  const tickets = await prisma.ticket.findMany({
    where: { tenancyId: { in: tenancies.map((t) => t.id) } },
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});

router.post("/tickets", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy) return res.status(400).json({ error: "No active tenancy." });
  const { title, description, category, priority } = req.body || {};
  if (!title) return res.status(400).json({ error: "A short title is required." });
  const ticket = await prisma.ticket.create({
    data: {
      tenancyId: tenancy.id,
      unitId: tenancy.unitId,
      title,
      description: description || "",
      category: category || "GENERAL",
      priority: priority || "MEDIUM",
    },
  });
  res.json(ticket);
});

router.get("/notices", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy) return res.json([]);
  const notices = await prisma.notice.findMany({
    where: { tenancyId: tenancy.id },
    orderBy: { createdAt: "desc" },
  });
  res.json(notices);
});

router.post("/notices", async (req: AuthedRequest, res) => {
  const tenancy = await activeTenancy(req.user!.id);
  if (!tenancy) return res.status(400).json({ error: "No active tenancy." });
  const { moveOutDate, reason } = req.body || {};
  if (!moveOutDate)
    return res.status(400).json({ error: "Please pick a move-out date." });
  const notice = await prisma.notice.create({
    data: {
      tenancyId: tenancy.id,
      moveOutDate: new Date(moveOutDate),
      reason: reason || null,
    },
  });
  res.json(notice);
});

export default router;
