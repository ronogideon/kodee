import { prisma } from "./prisma";
import { sendBilledSms } from "./wallet";
import { UNIT_TYPE_LABELS } from "./constants";

const PAYMENT_WINDOW_DAYS = Number(process.env.PAYMENT_WINDOW_DAYS || 5);

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function money(n: number): string {
  return "KES " + Math.round(n).toLocaleString("en-KE");
}

// Resolve the water charge for a unit in a period from the caretaker's reading.
async function waterAmountFor(unitId: string, period: string): Promise<number> {
  const reading = await prisma.meterReading.findUnique({
    where: { unitId_period: { unitId, period } },
  });
  return reading ? reading.amount : 0;
}

interface UnitLike {
  id: string;
  hasWater: boolean;
  hasGarbage: boolean;
  hasElectricity: boolean;
  garbageFee: number | null;
  electricityFlat: number | null;
  property: { garbageFee: number };
}

// Build the utility line items for a unit in a period.
export async function computeUtilities(unit: UnitLike, period: string) {
  const waterAmount = unit.hasWater ? await waterAmountFor(unit.id, period) : 0;
  const garbageAmount = unit.hasGarbage
    ? unit.garbageFee ?? unit.property.garbageFee
    : 0;
  const electricityAmount = unit.hasElectricity ? unit.electricityFlat ?? 0 : 0;
  return { waterAmount, garbageAmount, electricityAmount };
}

// Create (or update, if not yet paid) the invoice for a tenancy in a period.
export async function generateInvoiceForTenancy(tenancyId: string, period: string) {
  const tenancy = await prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: { unit: { include: { property: true } } },
  });
  if (!tenancy || !tenancy.active) return null;

  const { unit } = tenancy;
  const { waterAmount, garbageAmount, electricityAmount } = await computeUtilities(
    unit,
    period
  );
  const rentAmount = unit.rent;
  const total = rentAmount + waterAmount + garbageAmount + electricityAmount;

  const [y, m] = period.split("-").map(Number);
  const dueDate = new Date(y, m - 1, 1 + PAYMENT_WINDOW_DAYS);

  const existing = await prisma.invoice.findUnique({
    where: { tenancyId_period: { tenancyId, period } },
  });

  if (existing) {
    // Don't clobber a settled invoice; refresh figures on unpaid ones.
    if (existing.status === "PAID") return existing;
    return prisma.invoice.update({
      where: { id: existing.id },
      data: {
        rentAmount,
        waterAmount,
        garbageAmount,
        electricityAmount,
        total,
        dueDate,
        status: existing.amountPaid > 0 ? "PARTIAL" : "PENDING",
      },
    });
  }

  return prisma.invoice.create({
    data: {
      tenancyId,
      period,
      rentAmount,
      waterAmount,
      garbageAmount,
      electricityAmount,
      total,
      dueDate,
      status: "PENDING",
    },
  });
}

// Generate invoices for every active tenancy for the given period.
export async function generateInvoicesForPeriod(period: string, landlordId?: string) {
  const tenancies = await prisma.tenancy.findMany({
    where: {
      active: true,
      ...(landlordId
        ? { unit: { property: { landlordId } } }
        : {}),
    },
    select: { id: true },
  });
  const results = [];
  for (const t of tenancies) {
    const inv = await generateInvoiceForTenancy(t.id, period);
    if (inv) results.push(inv);
  }
  return results;
}

// Compose the reminder SMS body with the full utility breakdown.
export function buildReminderMessage(opts: {
  renterName: string;
  unitLabel: string;
  unitType: string;
  period: string;
  rent: number;
  water: number;
  garbage: number;
  electricity: number;
  total: number;
}): string {
  const parts: string[] = [`rent ${money(opts.rent)}`];
  if (opts.water > 0) parts.push(`water ${money(opts.water)}`);
  if (opts.garbage > 0) parts.push(`garbage ${money(opts.garbage)}`);
  if (opts.electricity > 0) parts.push(`electricity ${money(opts.electricity)}`);
  const firstName = opts.renterName.split(" ")[0];
  const typeLabel = UNIT_TYPE_LABELS[opts.unitType] || opts.unitType;

  return (
    `Hi ${firstName}, your ${periodLabel(opts.period)} rent for ${opts.unitLabel} ` +
    `(${typeLabel}) is due. Total ${money(opts.total)} = ${parts.join(" + ")}. ` +
    `You have ${PAYMENT_WINDOW_DAYS} days to pay. Thank you. - Kodee`
  );
}

// Send month-open reminders for every unpaid invoice in a period.
export async function sendRemindersForPeriod(period: string, landlordId?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      period,
      status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      ...(landlordId
        ? { tenancy: { unit: { property: { landlordId } } } }
        : {}),
    },
    include: {
      tenancy: { include: { renter: true, unit: true } },
    },
  });

  let sent = 0;
  for (const inv of invoices) {
    const { renter, unit } = inv.tenancy;
    const message = buildReminderMessage({
      renterName: renter.name,
      unitLabel: unit.label,
      unitType: unit.type,
      period,
      rent: inv.rentAmount,
      water: inv.waterAmount,
      garbage: inv.garbageAmount,
      electricity: inv.electricityAmount,
      total: inv.total - inv.amountPaid,
    });
    const ok = await sendBilledSms(
      await landlordIdForInvoice(inv),
      renter.name,
      renter.phone,
      message,
      "REMINDER"
    );
    if (ok.sent) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    }
  }
  return { total: invoices.length, sent };
}

// Resolve which landlord pays for an invoice's SMS (via unit → property).
async function landlordIdForInvoice(inv: { tenancy: { unit: { propertyId: string } } }) {
  const prop = await prisma.property.findUnique({
    where: { id: inv.tenancy.unit.propertyId },
    select: { landlordId: true },
  });
  return prop?.landlordId || "";
}

// Recompute an invoice's status from its payments.
export async function refreshInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice) return null;
  const amountPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  let status: string;
  if (amountPaid >= invoice.total) status = "PAID";
  else if (amountPaid > 0) status = "PARTIAL";
  else status = new Date() > invoice.dueDate ? "OVERDUE" : "PENDING";
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid, status },
  });
}
