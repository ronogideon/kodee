import { Router } from "express";
import { prisma } from "../prisma";
import { authRequired, requireRole, AuthedRequest, hashPassword } from "../auth";
import {
  currentPeriod,
  periodLabel,
  generateInvoicesForPeriod,
  sendRemindersForPeriod,
  refreshInvoiceStatus,
} from "../billing";

const router = Router();
router.use(authRequired, requireRole("LANDLORD"));

// ---- helpers ---------------------------------------------------------------

async function ownsProperty(landlordId: string, propertyId: string) {
  const p = await prisma.property.findFirst({ where: { id: propertyId, landlordId } });
  return !!p;
}
async function ownsUnit(landlordId: string, unitId: string) {
  const u = await prisma.unit.findFirst({
    where: { id: unitId, property: { landlordId } },
  });
  return u;
}

function lastNPeriods(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// ---- dashboard -------------------------------------------------------------

router.get("/dashboard", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.id;
  const period = currentPeriod();

  const properties = await prisma.property.findMany({
    where: { landlordId },
    include: {
      units: {
        include: {
          tenancies: {
            where: { active: true },
            include: { renter: true },
          },
        },
      },
    },
  });

  let totalUnits = 0;
  let occupiedUnits = 0;
  let potentialRent = 0;
  const propertyStats = properties.map((p) => {
    const units = p.units;
    const occ = units.filter((u) => u.status === "OCCUPIED").length;
    const rentRoll = units
      .filter((u) => u.status === "OCCUPIED")
      .reduce((s, u) => s + u.rent, 0);
    totalUnits += units.length;
    occupiedUnits += occ;
    potentialRent += rentRoll;
    return {
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      totalUnits: units.length,
      occupied: occ,
      vacant: units.length - occ,
      occupancy: units.length ? Math.round((occ / units.length) * 100) : 0,
      rentRoll,
    };
  });

  // Current period invoices & collection.
  const invoices = await prisma.invoice.findMany({
    where: { period, tenancy: { unit: { property: { landlordId } } } },
  });
  const billed = invoices.reduce((s, i) => s + i.total, 0);
  const collected = invoices.reduce((s, i) => s + i.amountPaid, 0);
  const outstanding = billed - collected;

  const statusBreakdown = { PAID: 0, PARTIAL: 0, PENDING: 0, OVERDUE: 0 } as Record<
    string,
    number
  >;
  invoices.forEach((i) => (statusBreakdown[i.status] = (statusBreakdown[i.status] || 0) + 1));

  // Expenses this period.
  const [y, m] = period.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);
  const expenses = await prisma.expense.aggregate({
    where: {
      property: { landlordId },
      spentAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amount: true },
  });
  const expensesThisMonth = expenses._sum.amount || 0;

  // Revenue trend — collected per month for last 6 months.
  const periods = lastNPeriods(6);
  const payments = await prisma.payment.findMany({
    where: {
      tenancy: { unit: { property: { landlordId } } },
      paidAt: { gte: new Date(y, m - 6, 1) },
    },
    select: { amount: true, paidAt: true },
  });
  const trend = periods.map((per) => {
    const [py, pm] = per.split("-").map(Number);
    const sum = payments
      .filter((p) => p.paidAt.getFullYear() === py && p.paidAt.getMonth() + 1 === pm)
      .reduce((s, p) => s + p.amount, 0);
    return { period: per, label: periodLabel(per).split(" ")[0], collected: sum };
  });

  // Recent activity.
  const recentPayments = await prisma.payment.findMany({
    where: { tenancy: { unit: { property: { landlordId } } } },
    orderBy: { paidAt: "desc" },
    take: 6,
    include: { tenancy: { include: { renter: true, unit: true } } },
  });
  const openTickets = await prisma.ticket.count({
    where: { unit: { property: { landlordId } }, status: { in: ["OPEN", "IN_PROGRESS"] } },
  });
  const pendingNotices = await prisma.notice.count({
    where: {
      tenancy: { unit: { property: { landlordId } } },
      status: { in: ["PENDING", "ACKNOWLEDGED"] },
    },
  });

  res.json({
    period,
    periodLabel: periodLabel(period),
    kpis: {
      properties: properties.length,
      totalUnits,
      occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      occupancy: totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
      potentialRent,
      billed,
      collected,
      outstanding,
      expensesThisMonth,
      netThisMonth: collected - expensesThisMonth,
      openTickets,
      pendingNotices,
    },
    statusBreakdown,
    trend,
    properties: propertyStats,
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidAt: p.paidAt,
      renter: p.tenancy.renter.name,
      unit: p.tenancy.unit.label,
    })),
  });
});

// ---- properties ------------------------------------------------------------

router.get("/properties", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.id;
  const properties = await prisma.property.findMany({
    where: { landlordId },
    include: {
      units: {
        include: {
          tenancies: { where: { active: true }, include: { renter: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(properties);
});

router.post("/properties", async (req: AuthedRequest, res) => {
  const { name, address, city, waterRatePerCbm, garbageFee } = req.body || {};
  if (!name) return res.status(400).json({ error: "Property name is required." });
  const property = await prisma.property.create({
    data: {
      landlordId: req.user!.id,
      name,
      address: address || "",
      city: city || "Nairobi",
      waterRatePerCbm: Number(waterRatePerCbm) || 150,
      garbageFee: Number(garbageFee) || 200,
    },
  });
  res.json(property);
});

router.patch("/properties/:id", async (req: AuthedRequest, res) => {
  if (!(await ownsProperty(req.user!.id, req.params.id)))
    return res.status(404).json({ error: "Property not found." });
  const { name, address, city, waterRatePerCbm, garbageFee } = req.body || {};
  const property = await prisma.property.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(waterRatePerCbm !== undefined && { waterRatePerCbm: Number(waterRatePerCbm) }),
      ...(garbageFee !== undefined && { garbageFee: Number(garbageFee) }),
    },
  });
  res.json(property);
});

router.delete("/properties/:id", async (req: AuthedRequest, res) => {
  if (!(await ownsProperty(req.user!.id, req.params.id)))
    return res.status(404).json({ error: "Property not found." });
  const occupied = await prisma.unit.count({
    where: { propertyId: req.params.id, status: "OCCUPIED" },
  });
  if (occupied > 0)
    return res
      .status(400)
      .json({ error: "Move out all tenants before deleting this property." });
  await prisma.property.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---- units -----------------------------------------------------------------

router.get("/units", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.id;
  const { status } = req.query;
  const units = await prisma.unit.findMany({
    where: {
      property: { landlordId },
      ...(status ? { status: String(status).toUpperCase() } : {}),
    },
    include: {
      property: true,
      tenancies: { where: { active: true }, include: { renter: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(units);
});

router.post("/properties/:id/units", async (req: AuthedRequest, res) => {
  if (!(await ownsProperty(req.user!.id, req.params.id)))
    return res.status(404).json({ error: "Property not found." });
  const b = req.body || {};
  if (!b.label || !b.type)
    return res.status(400).json({ error: "Unit label and type are required." });
  const unit = await prisma.unit.create({
    data: {
      propertyId: req.params.id,
      label: b.label,
      type: b.type,
      rent: Number(b.rent) || 0,
      deposit: Number(b.deposit) || 0,
      hasWater: b.hasWater ?? true,
      hasGarbage: b.hasGarbage ?? true,
      hasElectricity: b.hasElectricity ?? false,
      waterRatePerCbm: b.waterRatePerCbm != null ? Number(b.waterRatePerCbm) : null,
      garbageFee: b.garbageFee != null ? Number(b.garbageFee) : null,
      electricityFlat: b.electricityFlat != null ? Number(b.electricityFlat) : null,
    },
  });
  res.json(unit);
});

router.patch("/units/:id", async (req: AuthedRequest, res) => {
  const unit = await ownsUnit(req.user!.id, req.params.id);
  if (!unit) return res.status(404).json({ error: "Unit not found." });
  const b = req.body || {};
  const updated = await prisma.unit.update({
    where: { id: req.params.id },
    data: {
      ...(b.label !== undefined && { label: b.label }),
      ...(b.type !== undefined && { type: b.type }),
      ...(b.rent !== undefined && { rent: Number(b.rent) }),
      ...(b.deposit !== undefined && { deposit: Number(b.deposit) }),
      ...(b.hasWater !== undefined && { hasWater: b.hasWater }),
      ...(b.hasGarbage !== undefined && { hasGarbage: b.hasGarbage }),
      ...(b.hasElectricity !== undefined && { hasElectricity: b.hasElectricity }),
      ...(b.waterRatePerCbm !== undefined && {
        waterRatePerCbm: b.waterRatePerCbm != null ? Number(b.waterRatePerCbm) : null,
      }),
      ...(b.garbageFee !== undefined && {
        garbageFee: b.garbageFee != null ? Number(b.garbageFee) : null,
      }),
      ...(b.electricityFlat !== undefined && {
        electricityFlat: b.electricityFlat != null ? Number(b.electricityFlat) : null,
      }),
    },
  });
  res.json(updated);
});

router.delete("/units/:id", async (req: AuthedRequest, res) => {
  const unit = await ownsUnit(req.user!.id, req.params.id);
  if (!unit) return res.status(404).json({ error: "Unit not found." });
  if (unit.status === "OCCUPIED")
    return res.status(400).json({ error: "Move out the tenant before deleting." });
  await prisma.unit.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---- tenants (renters) -----------------------------------------------------

// Assign a tenant to a unit: creates a renter account (if needed) + tenancy.
router.post("/units/:id/tenants", async (req: AuthedRequest, res) => {
  const unit = await ownsUnit(req.user!.id, req.params.id);
  if (!unit) return res.status(404).json({ error: "Unit not found." });
  if (unit.status === "OCCUPIED")
    return res.status(400).json({ error: "This unit is already occupied." });

  const { name, email, phone, password, startDate } = req.body || {};
  if (!name || !email)
    return res.status(400).json({ error: "Tenant name and email are required." });

  let renter = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!renter) {
    renter = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || "",
        passwordHash: await hashPassword(password || "kodee1234"),
        role: "RENTER",
        landlordId: req.user!.id,
      },
    });
  }

  const tenancy = await prisma.tenancy.create({
    data: {
      unitId: unit.id,
      renterId: renter.id,
      startDate: startDate ? new Date(startDate) : new Date(),
    },
  });
  await prisma.unit.update({ where: { id: unit.id }, data: { status: "OCCUPIED" } });

  res.json({ tenancy, renter: { id: renter.id, name: renter.name, email: renter.email } });
});

// Current + past tenancies.
router.get("/tenants", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.id;
  const tenancies = await prisma.tenancy.findMany({
    where: { unit: { property: { landlordId } } },
    include: {
      renter: true,
      unit: { include: { property: true } },
      invoices: true,
      payments: true,
    },
    orderBy: [{ active: "desc" }, { startDate: "desc" }],
  });
  res.json(
    tenancies.map((t) => {
      const billed = t.invoices.reduce((s, i) => s + i.total, 0);
      const paid = t.payments.reduce((s, p) => s + p.amount, 0);
      return {
        id: t.id,
        active: t.active,
        startDate: t.startDate,
        endDate: t.endDate,
        renter: {
          id: t.renter.id,
          name: t.renter.name,
          email: t.renter.email,
          phone: t.renter.phone,
        },
        unit: { id: t.unit.id, label: t.unit.label, type: t.unit.type, rent: t.unit.rent },
        property: { id: t.unit.property.id, name: t.unit.property.name },
        billed,
        paid,
        balance: billed - paid,
      };
    })
  );
});

// Move out — preserves the record, frees the unit.
router.post("/tenancies/:id/end", async (req: AuthedRequest, res) => {
  const tenancy = await prisma.tenancy.findFirst({
    where: { id: req.params.id, unit: { property: { landlordId: req.user!.id } } },
  });
  if (!tenancy) return res.status(404).json({ error: "Tenancy not found." });
  await prisma.tenancy.update({
    where: { id: tenancy.id },
    data: { active: false, endDate: new Date() },
  });
  await prisma.unit.update({ where: { id: tenancy.unitId }, data: { status: "VACANT" } });
  res.json({ ok: true });
});

// ---- caretakers (staff) ----------------------------------------------------

router.get("/staff", async (req: AuthedRequest, res) => {
  const staff = await prisma.user.findMany({
    where: { landlordId: req.user!.id, role: "CARETAKER" },
    select: { id: true, name: true, email: true, phone: true, createdAt: true },
  });
  res.json(staff);
});

router.post("/staff", async (req: AuthedRequest, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name || !email)
    return res.status(400).json({ error: "Caretaker name and email are required." });
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(409).json({ error: "That email is already in use." });
  const caretaker = await prisma.user.create({
    data: {
      name,
      email: email.toLowerCase(),
      phone: phone || "",
      passwordHash: await hashPassword(password || "kodee1234"),
      role: "CARETAKER",
      landlordId: req.user!.id,
    },
  });
  res.json({ id: caretaker.id, name: caretaker.name, email: caretaker.email });
});

router.delete("/staff/:id", async (req: AuthedRequest, res) => {
  const staff = await prisma.user.findFirst({
    where: { id: req.params.id, landlordId: req.user!.id, role: "CARETAKER" },
  });
  if (!staff) return res.status(404).json({ error: "Caretaker not found." });
  await prisma.user.delete({ where: { id: staff.id } });
  res.json({ ok: true });
});

// ---- expenses & maintenance ------------------------------------------------

router.get("/expenses", async (req: AuthedRequest, res) => {
  const expenses = await prisma.expense.findMany({
    where: { property: { landlordId: req.user!.id } },
    include: { property: true, unit: true },
    orderBy: { spentAt: "desc" },
  });
  res.json(expenses);
});

router.post("/expenses", async (req: AuthedRequest, res) => {
  const { propertyId, unitId, category, title, amount, vendor, spentAt } = req.body || {};
  if (!propertyId || !title || amount == null)
    return res.status(400).json({ error: "Property, title and amount are required." });
  if (!(await ownsProperty(req.user!.id, propertyId)))
    return res.status(404).json({ error: "Property not found." });
  const expense = await prisma.expense.create({
    data: {
      propertyId,
      unitId: unitId || null,
      category: category || "MAINTENANCE",
      title,
      amount: Number(amount),
      vendor: vendor || null,
      spentAt: spentAt ? new Date(spentAt) : new Date(),
    },
  });
  res.json(expense);
});

router.delete("/expenses/:id", async (req: AuthedRequest, res) => {
  const expense = await prisma.expense.findFirst({
    where: { id: req.params.id, property: { landlordId: req.user!.id } },
  });
  if (!expense) return res.status(404).json({ error: "Expense not found." });
  await prisma.expense.delete({ where: { id: expense.id } });
  res.json({ ok: true });
});

// ---- invoices, payments ----------------------------------------------------

router.get("/invoices", async (req: AuthedRequest, res) => {
  const period = (req.query.period as string) || currentPeriod();
  const invoices = await prisma.invoice.findMany({
    where: { period, tenancy: { unit: { property: { landlordId: req.user!.id } } } },
    include: { tenancy: { include: { renter: true, unit: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    invoices.map((i) => ({
      id: i.id,
      period: i.period,
      total: i.total,
      amountPaid: i.amountPaid,
      status: i.status,
      dueDate: i.dueDate,
      rentAmount: i.rentAmount,
      waterAmount: i.waterAmount,
      garbageAmount: i.garbageAmount,
      electricityAmount: i.electricityAmount,
      renter: i.tenancy.renter.name,
      unit: i.tenancy.unit.label,
    }))
  );
});

// Record a payment (e.g. reconciling M-Pesa / cash manually).
router.post("/payments", async (req: AuthedRequest, res) => {
  const { tenancyId, amount, method, reference, period } = req.body || {};
  if (!tenancyId || amount == null)
    return res.status(400).json({ error: "Tenancy and amount are required." });
  const tenancy = await prisma.tenancy.findFirst({
    where: { id: tenancyId, unit: { property: { landlordId: req.user!.id } } },
  });
  if (!tenancy) return res.status(404).json({ error: "Tenancy not found." });

  const per = period || currentPeriod();
  const invoice = await prisma.invoice.findUnique({
    where: { tenancyId_period: { tenancyId, period: per } },
  });

  const payment = await prisma.payment.create({
    data: {
      tenancyId,
      invoiceId: invoice?.id,
      amount: Number(amount),
      method: method || "MPESA",
      reference: reference || null,
    },
  });
  if (invoice) await refreshInvoiceStatus(invoice.id);
  res.json(payment);
});

// ---- billing triggers (manual, for testing / off-cycle) --------------------

router.post("/billing/generate", async (req: AuthedRequest, res) => {
  const period = (req.body?.period as string) || currentPeriod();
  const invoices = await generateInvoicesForPeriod(period, req.user!.id);
  res.json({ period, generated: invoices.length });
});

router.post("/billing/remind", async (req: AuthedRequest, res) => {
  const period = (req.body?.period as string) || currentPeriod();
  await generateInvoicesForPeriod(period, req.user!.id);
  const result = await sendRemindersForPeriod(period, req.user!.id);
  res.json({ period, ...result });
});

// ---- tickets & notices (landlord view + actions) ---------------------------

router.get("/tickets", async (req: AuthedRequest, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { unit: { property: { landlordId: req.user!.id } } },
    include: { tenancy: { include: { renter: true } }, unit: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});

router.patch("/tickets/:id", async (req: AuthedRequest, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, unit: { property: { landlordId: req.user!.id } } },
  });
  if (!ticket) return res.status(404).json({ error: "Ticket not found." });
  const { status } = req.body || {};
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      ...(status && { status }),
      ...(status === "RESOLVED" || status === "CLOSED" ? { resolvedAt: new Date() } : {}),
    },
  });
  res.json(updated);
});

router.get("/notices", async (req: AuthedRequest, res) => {
  const notices = await prisma.notice.findMany({
    where: { tenancy: { unit: { property: { landlordId: req.user!.id } } } },
    include: { tenancy: { include: { renter: true, unit: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(notices);
});

router.patch("/notices/:id", async (req: AuthedRequest, res) => {
  const notice = await prisma.notice.findFirst({
    where: {
      id: req.params.id,
      tenancy: { unit: { property: { landlordId: req.user!.id } } },
    },
  });
  if (!notice) return res.status(404).json({ error: "Notice not found." });
  const { status } = req.body || {};
  const updated = await prisma.notice.update({
    where: { id: notice.id },
    data: { ...(status && { status }) },
  });
  res.json(updated);
});

export default router;
