// Daraja STK callback (no auth — Safaricom calls this). Idempotent: only the
// PENDING → PAID transition performs side effects, so duplicate callbacks are
// harmless.

import { Router } from "express";
import { prisma } from "../prisma";
import { parseStkCallback } from "../daraja";
import { creditWallet } from "../wallet";
import { refreshInvoiceStatus } from "../billing";

const router = Router();

router.post("/callback", async (req, res) => {
  // Always 200 — Daraja retries non-200s and we handle our own state.
  res.json({ ResultCode: 0, ResultDesc: "Accepted" });

  try {
    const parsed = parseStkCallback(req.body);
    if (!parsed) return;

    const txn = await prisma.mpesaTransaction.findUnique({
      where: { checkoutRequestId: parsed.checkoutRequestId },
    });
    if (!txn || txn.status !== "PENDING") return; // unknown or already settled

    if (!parsed.success) {
      await prisma.mpesaTransaction.update({
        where: { id: txn.id },
        data: { status: "FAILED", resultDesc: parsed.resultDesc },
      });
      return;
    }

    // Guarded PAID transition (idempotent even under concurrent callbacks).
    const updated = await prisma.mpesaTransaction.updateMany({
      where: { id: txn.id, status: "PENDING" },
      data: {
        status: "PAID",
        receipt: parsed.receipt,
        resultDesc: parsed.resultDesc,
      },
    });
    if (updated.count === 0) return;

    const amount = parsed.amount ?? txn.amount;

    if (txn.purpose === "SMS_TOPUP" && txn.landlordId) {
      await creditWallet(
        txn.landlordId,
        amount,
        `M-Pesa top-up${parsed.receipt ? ` (${parsed.receipt})` : ""}`
      );
    }

    if (txn.purpose === "RENT" && txn.invoiceId && txn.tenancyId) {
      await prisma.payment.create({
        data: {
          invoiceId: txn.invoiceId,
          tenancyId: txn.tenancyId,
          amount,
          method: "MPESA",
          reference: parsed.receipt || parsed.checkoutRequestId,
        },
      });
      await refreshInvoiceStatus(txn.invoiceId);
    }
  } catch (err) {
    console.error("[daraja] callback error", err);
  }
});

export default router;
