// SMS wallet + billed messaging (Dartbit pattern).
//
// Every landlord has a prepaid KES wallet. Sending an SMS:
//   1. computes cost = segments × platform rate,
//   2. verifies the wallet can cover it (else logs a FAILED message, no send),
//   3. sends via the gateway,
//   4. debits the wallet (with a ledger entry) and logs a SENT message.
// Reminders and custom messages both go through sendBilledSms, so the
// message log and the ledger are always the complete truth.

import { prisma } from "./prisma";
import { sendSms } from "./sms";

export const SMS_RATE_KEY = "smsRatePerSms";
export const DEFAULT_SMS_RATE = Number(process.env.SMS_RATE_PER_SMS || 1.0); // KES per SMS segment

export async function getSmsRate(): Promise<number> {
  const s = await prisma.setting.findUnique({ where: { key: SMS_RATE_KEY } });
  const n = s ? Number(s.value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_SMS_RATE;
}

export async function setSmsRate(rate: number) {
  await prisma.setting.upsert({
    where: { key: SMS_RATE_KEY },
    update: { value: String(rate) },
    create: { key: SMS_RATE_KEY, value: String(rate) },
  });
}

export function smsSegments(body: string): number {
  return Math.max(1, Math.ceil(body.length / 160));
}

export async function getOrCreateWallet(landlordId: string) {
  return prisma.smsWallet.upsert({
    where: { landlordId },
    update: {},
    create: { landlordId },
  });
}

export async function creditWallet(landlordId: string, amount: number, note: string) {
  const wallet = await getOrCreateWallet(landlordId);
  const [updated] = await prisma.$transaction([
    prisma.smsWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount }, toppedUp: { increment: amount } },
    }),
    prisma.smsWalletTxn.create({
      data: { walletId: wallet.id, type: "TOPUP", amount, note },
    }),
  ]);
  return updated;
}

export interface BilledSendResult {
  sent: boolean;
  cost: number;
  error?: string;
}

// Send one SMS on a landlord's dime. Never throws — failures are recorded.
export async function sendBilledSms(
  landlordId: string,
  toName: string,
  toPhone: string,
  body: string,
  kind: "REMINDER" | "CUSTOM"
): Promise<BilledSendResult> {
  const segments = smsSegments(body);
  const rate = await getSmsRate();
  const cost = Number((segments * rate).toFixed(2));
  const wallet = await getOrCreateWallet(landlordId);

  const fail = async (error: string): Promise<BilledSendResult> => {
    await prisma.message.create({
      data: { landlordId, toName, toPhone, body, kind, status: "FAILED", segments, cost: 0, error },
    });
    return { sent: false, cost: 0, error };
  };

  if (!toPhone || toPhone.trim().length < 9) {
    return fail("No valid phone number on record");
  }
  if (wallet.balance < cost) {
    return fail(
      `Insufficient SMS balance (need KES ${cost.toFixed(2)}, have KES ${wallet.balance.toFixed(2)})`
    );
  }

  const ok = await sendSms(toPhone, body);
  if (!ok) return fail("Gateway delivery failed");

  await prisma.$transaction([
    prisma.smsWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: cost }, spent: { increment: cost } },
    }),
    prisma.smsWalletTxn.create({
      data: {
        walletId: wallet.id,
        type: "DEBIT",
        amount: cost,
        note: `${kind === "REMINDER" ? "Reminder" : "Message"} to ${toName} (${segments} segment${segments === 1 ? "" : "s"})`,
      },
    }),
    prisma.message.create({
      data: { landlordId, toName, toPhone, body, kind, status: "SENT", segments, cost },
    }),
  ]);

  return { sent: true, cost };
}
