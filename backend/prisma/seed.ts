import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function period(offset: number): string {
  const d = new Date();
  const dd = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`;
}
function due(per: string, days = 5): Date {
  const [y, m] = per.split("-").map(Number);
  return new Date(y, m - 1, 1 + days);
}

async function main() {
  console.log("Seeding Kodee…");
  // Clean slate (dev only).
  await prisma.message.deleteMany();
  await prisma.smsWalletTxn.deleteMany();
  await prisma.smsWallet.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.meterReading.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.notice.deleteMany();
  await prisma.tenancy.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  // Delete staff/renters (which reference a landlord) before landlords.
  await prisma.user.deleteMany({ where: { landlordId: { not: null } } });
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("kodee1234", 10);

  const landlord = await prisma.user.create({
    data: {
      name: "James Kariuki",
      email: "landlord@kodee.app",
      phone: "+254712000001",
      passwordHash: hash,
      role: "LANDLORD",
    },
  });

  const caretaker = await prisma.user.create({
    data: {
      name: "Peter Otieno",
      email: "caretaker@kodee.app",
      phone: "+254712000002",
      passwordHash: hash,
      role: "CARETAKER",
      landlordId: landlord.id,
    },
  });

  // --- Property 1: Riverside Court (apartments) ---
  const riverside = await prisma.property.create({
    data: {
      landlordId: landlord.id,
      name: "Riverside Court",
      address: "Riverside Drive, Westlands",
      city: "Nairobi",
      waterRatePerCbm: 180,
      garbageFee: 300,
    },
  });

  const r1 = await prisma.unit.create({
    data: { propertyId: riverside.id, label: "A1", type: "BR2", rent: 45000, hasWater: true, hasGarbage: true, hasElectricity: true, electricityFlat: 1500 },
  });
  const r2 = await prisma.unit.create({
    data: { propertyId: riverside.id, label: "A2", type: "BR1", rent: 32000, hasWater: true, hasGarbage: true },
  });
  const r3 = await prisma.unit.create({
    data: { propertyId: riverside.id, label: "A3", type: "BR1", rent: 32000, hasWater: true, hasGarbage: true },
  });
  const r4 = await prisma.unit.create({
    data: { propertyId: riverside.id, label: "B1", type: "BR3", rent: 65000, hasWater: true, hasGarbage: true, hasElectricity: true, electricityFlat: 2000 },
  });

  // --- Property 2: Kileleshwa Studios (bedsitters/singles) ---
  const kile = await prisma.property.create({
    data: {
      landlordId: landlord.id,
      name: "Kileleshwa Studios",
      address: "Gatundu Road, Kileleshwa",
      city: "Nairobi",
      waterRatePerCbm: 150,
      garbageFee: 200,
    },
  });
  const k1 = await prisma.unit.create({
    data: { propertyId: kile.id, label: "G1", type: "STUDIO", rent: 18000, hasWater: true, hasGarbage: true },
  });
  const k2 = await prisma.unit.create({
    data: { propertyId: kile.id, label: "G2", type: "SINGLE", rent: 9000, hasWater: true, hasGarbage: false },
  });
  const k3 = await prisma.unit.create({
    data: { propertyId: kile.id, label: "G3", type: "SINGLE", rent: 9000, hasWater: true, hasGarbage: false },
  });
  const k4 = await prisma.unit.create({
    data: { propertyId: kile.id, label: "G4", type: "DOUBLE", rent: 14000, hasWater: true, hasGarbage: true },
  });

  // --- Renters (some units left vacant) ---
  async function renter(name: string, email: string, phone: string) {
    return prisma.user.create({
      data: { name, email, phone, passwordHash: hash, role: "RENTER", landlordId: landlord.id },
    });
  }
  const wanjiku = await renter("Grace Wanjiku", "wanjiku@kodee.app", "+254720111222");
  const brian = await renter("Brian Mwangi", "brian@kodee.app", "+254733444555");
  const aisha = await renter("Aisha Hassan", "aisha@kodee.app", "+254701777888");
  const kevin = await renter("Kevin Ochieng", "kevin@kodee.app", "+254745999000");
  const mercy = await renter("Mercy Njeri", "mercy@kodee.app", "+254799112233");

  async function assign(unitId: string, renterId: string, startOffset: number) {
    const t = await prisma.tenancy.create({
      data: { unitId, renterId, startDate: new Date(new Date().getFullYear(), new Date().getMonth() + startOffset, 1) },
    });
    await prisma.unit.update({ where: { id: unitId }, data: { status: "OCCUPIED" } });
    return t;
  }
  const tA1 = await assign(r1.id, wanjiku.id, -8);
  const tA2 = await assign(r2.id, brian.id, -5);
  const tB1 = await assign(r4.id, aisha.id, -3);
  const tG1 = await assign(k1.id, kevin.id, -6);
  const tG4 = await assign(k4.id, mercy.id, -2);
  // r3, k2, k3 left VACANT on purpose.

  // --- A past tenant (history preserved) ---
  const formerTenant = await renter("Daniel Kiptoo", "daniel@kodee.app", "+254700555444");
  const pastTenancy = await prisma.tenancy.create({
    data: {
      unitId: r3.id,
      renterId: formerTenant.id,
      startDate: new Date(new Date().getFullYear() - 1, 0, 1),
      endDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15),
      active: false,
    },
  });

  // --- Meter readings + invoices + payments for last 3 months ---
  const units = [
    { unit: r1, tenancy: tA1 },
    { unit: r2, tenancy: tA2 },
    { unit: r4, tenancy: tB1 },
    { unit: k1, tenancy: tG1 },
    { unit: k4, tenancy: tG4 },
  ];

  const props: Record<string, { rate: number; garbage: number }> = {
    [riverside.id]: { rate: 180, garbage: 300 },
    [kile.id]: { rate: 150, garbage: 200 },
  };

  let meterBase: Record<string, number> = {};
  for (const { unit } of units) meterBase[unit.id] = 100 + Math.floor(Math.random() * 50);

  for (let off = -2; off <= 0; off++) {
    const per = period(off);
    for (const { unit, tenancy } of units) {
      const pcfg = props[unit.propertyId];
      const rate = unit.waterRatePerCbm ?? pcfg.rate;
      const prev = meterBase[unit.id];
      const consumption = 3 + Math.floor(Math.random() * 6); // cbm
      const current = prev + consumption;
      meterBase[unit.id] = current;
      const waterAmount = consumption * rate;

      await prisma.meterReading.create({
        data: {
          unitId: unit.id,
          tenancyId: tenancy.id,
          caretakerId: caretaker.id,
          period: per,
          previous: prev,
          current,
          consumption,
          ratePerCbm: rate,
          amount: waterAmount,
        },
      });

      const garbage = unit.hasGarbage ? unit.garbageFee ?? pcfg.garbage : 0;
      const electricity = unit.hasElectricity ? unit.electricityFlat ?? 0 : 0;
      const total = unit.rent + waterAmount + garbage + electricity;

      const invoice = await prisma.invoice.create({
        data: {
          tenancyId: tenancy.id,
          period: per,
          rentAmount: unit.rent,
          waterAmount,
          garbageAmount: garbage,
          electricityAmount: electricity,
          total,
          dueDate: due(per),
          status: "PENDING",
        },
      });

      // Past months fully paid; current month varied.
      if (off < 0) {
        await prisma.payment.create({
          data: { tenancyId: tenancy.id, invoiceId: invoice.id, amount: total, method: "MPESA", reference: `MP-${per}-${unit.label}` },
        });
        await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: total, status: "PAID" } });
      } else {
        // Current month: mix of paid / partial / pending.
        const roll = Math.random();
        if (roll < 0.4) {
          await prisma.payment.create({ data: { tenancyId: tenancy.id, invoiceId: invoice.id, amount: total, method: "MPESA", reference: `MP-${per}-${unit.label}` } });
          await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: total, status: "PAID" } });
        } else if (roll < 0.65) {
          const part = Math.round(total * 0.5);
          await prisma.payment.create({ data: { tenancyId: tenancy.id, invoiceId: invoice.id, amount: part, method: "MPESA", reference: `MP-${per}-${unit.label}` } });
          await prisma.invoice.update({ where: { id: invoice.id }, data: { amountPaid: part, status: "PARTIAL" } });
        }
      }
    }
  }

  // --- Tickets ---
  await prisma.ticket.create({
    data: { tenancyId: tA1.id, unitId: r1.id, title: "Kitchen tap leaking", description: "The cold water tap drips continuously.", category: "PLUMBING", priority: "HIGH", status: "OPEN" },
  });
  await prisma.ticket.create({
    data: { tenancyId: tG1.id, unitId: k1.id, title: "Main door lock stiff", description: "Hard to turn the key.", category: "STRUCTURAL", priority: "MEDIUM", status: "IN_PROGRESS" },
  });
  await prisma.ticket.create({
    data: { tenancyId: tA2.id, unitId: r2.id, title: "Bathroom bulb blown", description: "", category: "ELECTRICAL", priority: "LOW", status: "RESOLVED", resolvedAt: new Date() },
  });

  // --- Notice ---
  await prisma.notice.create({
    data: { tenancyId: tG4.id, moveOutDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 30), reason: "Relocating for work", status: "PENDING" },
  });

  // --- Expenses / maintenance ---
  await prisma.expense.create({ data: { propertyId: riverside.id, unitId: r1.id, category: "REPAIR", title: "Replaced kitchen mixer tap", amount: 3500, vendor: "Westlands Hardware", spentAt: new Date() } });
  await prisma.expense.create({ data: { propertyId: riverside.id, category: "SALARY", title: "Caretaker monthly stipend", amount: 15000, vendor: "Peter Otieno", spentAt: new Date() } });
  await prisma.expense.create({ data: { propertyId: kile.id, category: "MAINTENANCE", title: "Compound cleaning + garbage", amount: 4000, vendor: "CleanCo", spentAt: new Date() } });
  await prisma.expense.create({ data: { propertyId: kile.id, category: "UTILITY", title: "Borehole pump servicing", amount: 8500, vendor: "AquaTech", spentAt: new Date(new Date().getFullYear(), new Date().getMonth(), 3) } });

  // ── Superadmin + SMS wallet ────────────────────────────────────────────────
  await prisma.user.create({
    data: {
      name: "Kodee Admin",
      email: "admin@kodee.app",
      phone: "+254700000000",
      passwordHash: hash,
      role: "SUPERADMIN",
    },
  });

  await prisma.setting.upsert({
    where: { key: "smsRatePerSms" },
    update: {},
    create: { key: "smsRatePerSms", value: "1.00" },
  });

  const wallet = await prisma.smsWallet.create({
    data: {
      landlordId: landlord.id,
      balance: 425,
      toppedUp: 500,
      spent: 75,
      txns: {
        create: [
          { type: "TOPUP", amount: 500, note: "M-Pesa top-up" },
          { type: "DEBIT", amount: 75, note: "Monthly reminders (May–Jun)" },
        ],
      },
    },
  });

  // A few example messages so the log has history.
  await prisma.message.createMany({
    data: [
      {
        landlordId: landlord.id,
        toName: "Wanjiku Njeri",
        toPhone: "+254711111111",
        body: "Hi Wanjiku, your rent for Riverside Court Unit A1 is due. Rent 15,000 + Water 900 + Garbage 200 = KES 16,100. Please pay within 5 days. — Kodee",
        kind: "REMINDER",
        status: "SENT",
        segments: 1,
        cost: 1.0,
      },
      {
        landlordId: landlord.id,
        toName: "Brian Ochieng",
        toPhone: "+254722222222",
        body: "Water will be off on Saturday 9am–1pm for tank cleaning at Riverside Court. Sorry for the inconvenience.",
        kind: "CUSTOM",
        status: "SENT",
        segments: 1,
        cost: 1.0,
      },
    ],
  });
  void wallet;

  console.log("\nSeed complete. Sign in with:");
  console.log("  Superadmin → admin@kodee.app / kodee1234");
  console.log("  Landlord   → landlord@kodee.app / kodee1234");
  console.log("  Caretaker  → caretaker@kodee.app / kodee1234");
  console.log("  Renter     → wanjiku@kodee.app / kodee1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
