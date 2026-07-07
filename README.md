# Kodee

Property management for Kenyan landlords — a companion product to **Dartbit**, sharing its design language and attention to detail.

Kodee gives a landlord one organised place to run their buildings: track occupancy and rent roll, bill tenants for rent + flexible per-unit utilities, take M-Pesa payments, handle maintenance requests and move-out notices, log expenses, and let caretakers record monthly water-meter readings that flow straight into each tenant's invoice. Tenants and caretakers get their own mobile-first portal.

```
kodee/
├── backend/   Express + TypeScript + Prisma (SQLite) — REST API, billing engine, SMS scheduler
├── admin/     Landlord console — Vite + React + TS + Recharts (the rich, graphical dashboard)
└── portal/    Tenant + caretaker portal — Vite + React + TS (mobile-first)
```

---

## Roles

| Role | Where they log in | What they do |
|------|-------------------|--------------|
| **Landlord / Admin** | `admin/` | Properties & units, tenants (current + past), billing, payments, expenses, maintenance, caretakers |
| **Renter** | `portal/` | See invoice + utility breakdown, pay via M-Pesa, raise maintenance tickets, give notice, view history |
| **Caretaker** | `portal/` | Enter the monthly water-meter reading per unit; bill is auto-calculated and pushed to the tenant's invoice |

A tenant/caretaker record is tied to the landlord who created it. Ending a tenancy doesn't delete anyone — it marks the tenancy inactive, frees the unit, and keeps all invoices, payments and history for that past renter.

---

## Utility billing

Utilities are configured **per unit**, so each unit can carry a different mix:

- **Water** — metered. The caretaker records the current reading; consumption × the property's per-m³ rate becomes that month's water charge. Visible to the tenant too.
- **Garbage** — flat monthly fee (default set on the property, overridable per unit).
- **Electricity** — optional flat charge per unit.

An invoice total = rent + water + garbage + electricity, only for the utilities that unit is flagged for.

## SMS reminders (Africa's Talking)

On the **1st of each month at 08:00 Africa/Nairobi**, the scheduler generates that month's invoices and sends every tenant an SMS with their full breakdown and the **5-day** payment window, e.g.:

> Hi Jane, your rent for Riverside Court Unit A1 for June 2026 is due. Rent 15,000 + Water 900 + Garbage 200 = KES 16,100. Please pay within 5 days (by 05 Jun). — Kodee

If Africa's Talking credentials aren't set, messages are logged to the console instead, so you can develop without sending real SMS. The payment window is configurable via `PAYMENT_WINDOW_DAYS`. Invoices/reminders can also be triggered manually from the **Payments** page.

---

## Running it

Three terminals. Backend first.

### 1. Backend (`http://localhost:4000`)

```bash
cd backend
cp .env.example .env          # then edit if you want real SMS
npm install
npm run setup                 # prisma generate + db push + seed demo data
npm run dev
```

`npm run setup` needs to download the Prisma query engine the first time (from binaries.prisma.sh), so run it on a machine with normal internet access. To re-seed from scratch: `rm prisma/dev.db && npm run setup`.

### 2. Landlord console (`http://localhost:5173`)

```bash
cd admin
npm install
npm run dev
```

### 3. Tenant / caretaker portal (`http://localhost:5174`)

```bash
cd portal
npm install
npm run dev
```

Both frontends proxy `/api` to the backend on port 4000 (see each `vite.config.ts`).

---

## Demo logins

All seeded accounts use the password **`kodee1234`**.

| Role | Email |
|------|-------|
| Landlord | `landlord@kodee.app` |
| Caretaker | `caretaker@kodee.app` |
| Tenant | `wanjiku@kodee.app` |

The seed builds a landlord (James Kariuki) with two properties, eight units of mixed types and utilities (a few left vacant), five current tenants, one past tenant (history preserved), three months of readings/invoices/payments, plus sample tickets, a notice and expenses — so every dashboard has real data on first load.

---

## Notes for production

- **Database:** SQLite for v1 for zero-setup local dev. Swap to Postgres exactly like Dartbit by changing the `datasource` provider in `backend/prisma/schema.prisma` and `DATABASE_URL` — the schema and code are Postgres-ready.
- **Auth:** JWT (30-day) in the `Authorization: Bearer` header; passwords hashed with bcrypt. Set a strong `JWT_SECRET`.
- **Payments:** the tenant "Pay with M-Pesa" action records a payment directly for the demo. Wire it to Daraja STK Push (as in Dartbit) for live collection — the payment-recording path and invoice status refresh are already in place.
- **Scheduler:** toggle with `ENABLE_SCHEDULER` in `.env`.

Powered by Dartbit.
