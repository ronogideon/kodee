import { Router } from "express";
import { prisma } from "../prisma";
import { authRequired, requireRole, AuthedRequest } from "../auth";
import { currentPeriod, generateInvoiceForTenancy } from "../billing";

const router = Router();
router.use(authRequired, requireRole("CARETAKER"));

// Units the caretaker can read — all units under their landlord that use water.
router.get("/units", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.landlordId!;
  const period = currentPeriod();
  const units = await prisma.unit.findMany({
    where: { property: { landlordId }, hasWater: true },
    include: {
      property: true,
      tenancies: { where: { active: true }, include: { renter: true } },
      readings: { orderBy: { period: "desc" } },
    },
    orderBy: [{ propertyId: "asc" }, { label: "asc" }],
  });

  res.json(
    units.map((u) => {
      const thisPeriod = u.readings.find((r) => r.period === period);
      const last = u.readings.find((r) => r.period !== period) || u.readings[0];
      const rate = u.waterRatePerCbm ?? u.property.waterRatePerCbm;
      return {
        id: u.id,
        label: u.label,
        type: u.type,
        status: u.status,
        property: { id: u.property.id, name: u.property.name },
        tenant: u.tenancies[0]?.renter.name || null,
        ratePerCbm: rate,
        lastReading: last ? last.current : 0,
        currentReading: thisPeriod ? thisPeriod.current : null,
        submittedThisPeriod: !!thisPeriod,
      };
    })
  );
});

// Submit a meter reading for the current period. Computes consumption + bill,
// records it, and refreshes the tenant's invoice so the charge shows up.
router.post("/units/:id/reading", async (req: AuthedRequest, res) => {
  const landlordId = req.user!.landlordId!;
  const unit = await prisma.unit.findFirst({
    where: { id: req.params.id, property: { landlordId } },
    include: {
      property: true,
      tenancies: { where: { active: true } },
      readings: { orderBy: { period: "desc" } },
    },
  });
  if (!unit) return res.status(404).json({ error: "Unit not found." });

  const period = (req.body?.period as string) || currentPeriod();
  const current = Number(req.body?.current);
  if (isNaN(current)) return res.status(400).json({ error: "Enter a valid reading." });

  const prevReading =
    unit.readings.find((r) => r.period < period) || unit.readings[0];
  const previous = prevReading ? prevReading.current : Number(req.body?.previous) || 0;
  if (current < previous)
    return res
      .status(400)
      .json({ error: `Reading can't be below the last one (${previous}).` });

  const rate = unit.waterRatePerCbm ?? unit.property.waterRatePerCbm;
  const consumption = current - previous;
  const amount = consumption * rate;
  const activeTenancy = unit.tenancies[0];

  const reading = await prisma.meterReading.upsert({
    where: { unitId_period: { unitId: unit.id, period } },
    create: {
      unitId: unit.id,
      tenancyId: activeTenancy?.id,
      caretakerId: req.user!.id,
      period,
      previous,
      current,
      consumption,
      ratePerCbm: rate,
      amount,
    },
    update: {
      current,
      previous,
      consumption,
      ratePerCbm: rate,
      amount,
      caretakerId: req.user!.id,
    },
  });

  // Push the new water charge into the tenant's invoice for the period.
  if (activeTenancy) await generateInvoiceForTenancy(activeTenancy.id, period);

  res.json(reading);
});

export default router;
