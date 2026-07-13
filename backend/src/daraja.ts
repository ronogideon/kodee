// Daraja (Safaricom M-Pesa) — STK push.
//
// Two credential sources (the Dartbit split):
//   • A landlord's own DarajaConfig (settlement method) — receives RENT.
//   • Kodee's central Daraja from env — receives SMS_TOPUP payments.
// When the relevant credentials aren't configured, callers fall back to the
// demo path (instant record/credit) so the app stays fully testable.

const DARAJA_ENV = (process.env.DARAJA_ENV || "sandbox").toLowerCase();
const BASE =
  DARAJA_ENV === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export interface DarajaCreds {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  type: "PAYBILL" | "TILL";
  accountRef: string;
}

// Kodee's central Daraja (SMS top-ups). Null when not configured.
export function centralDarajaCreds(): DarajaCreds | null {
  const consumerKey = process.env.CENTRAL_DARAJA_CONSUMER_KEY || "";
  const consumerSecret = process.env.CENTRAL_DARAJA_CONSUMER_SECRET || "";
  const shortcode = process.env.CENTRAL_DARAJA_SHORTCODE || "";
  const passkey = process.env.CENTRAL_DARAJA_PASSKEY || "";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey) return null;
  return {
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    type: (process.env.CENTRAL_DARAJA_TYPE === "TILL" ? "TILL" : "PAYBILL") as any,
    accountRef: process.env.CENTRAL_DARAJA_ACCOUNT_REF || "KODEE-SMS",
  };
}

export function callbackUrl(): string | null {
  const base = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
  return base ? `${base}/api/daraja/callback` : null;
}

// Normalize to 2547XXXXXXXX (Daraja's required MSISDN form).
export function darajaPhone(phone: string): string {
  let p = (phone || "").replace(/[\s+-]/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  return p;
}

async function oauthToken(creds: DarajaCreds): Promise<string> {
  const auth = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");
  const res = await fetch(`${BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed (${res.status})`);
  const data: any = await res.json();
  if (!data.access_token) throw new Error("Daraja auth returned no token");
  return data.access_token;
}

export interface StkResult {
  checkoutRequestId: string;
  merchantRequestId: string;
}

export async function stkPush(opts: {
  creds: DarajaCreds;
  phone: string;
  amount: number;
  description: string;
}): Promise<StkResult> {
  const cb = callbackUrl();
  if (!cb) throw new Error("BACKEND_URL is not set — Daraja callback URL unavailable.");

  const token = await oauthToken(opts.creds);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const password = Buffer.from(
    `${opts.creds.shortcode}${opts.creds.passkey}${timestamp}`
  ).toString("base64");
  const msisdn = darajaPhone(opts.phone);

  const body = {
    BusinessShortCode: opts.creds.shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType:
      opts.creds.type === "TILL" ? "CustomerBuyGoodsOnline" : "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(opts.amount)),
    PartyA: msisdn,
    PartyB: opts.creds.shortcode,
    PhoneNumber: msisdn,
    CallBackURL: cb,
    AccountReference: opts.creds.accountRef.slice(0, 12),
    TransactionDesc: opts.description.slice(0, 13),
  };

  const res = await fetch(`${BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage || data.ResponseDescription || "STK push failed");
  }
  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
  };
}

// Parse the STK callback body into a normalized shape.
export function parseStkCallback(body: any): {
  checkoutRequestId: string;
  success: boolean;
  resultDesc: string;
  receipt?: string;
  amount?: number;
} | null {
  const cb = body?.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;
  const success = cb.ResultCode === 0;
  let receipt: string | undefined;
  let amount: number | undefined;
  for (const item of cb.CallbackMetadata?.Item || []) {
    if (item.Name === "MpesaReceiptNumber") receipt = String(item.Value);
    if (item.Name === "Amount") amount = Number(item.Value);
  }
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success,
    resultDesc: cb.ResultDesc || (success ? "Success" : "Failed"),
    receipt,
    amount,
  };
}
