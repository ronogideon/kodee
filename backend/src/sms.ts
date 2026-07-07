// SMS delivery. Uses Africa's Talking (the common Kenyan gateway) when
// credentials are present; otherwise logs to the console so the flow is fully
// testable without an account.

const AT_USERNAME = process.env.AT_USERNAME || "";
const AT_API_KEY = process.env.AT_API_KEY || "";
const AT_SENDER_ID = process.env.AT_SENDER_ID || "KODEE";

// Africa's Talking sandbox vs live endpoint is chosen by username.
function atEndpoint() {
  return AT_USERNAME === "sandbox"
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";
}

function normalizePhone(phone: string): string {
  const p = phone.replace(/\s+/g, "");
  if (p.startsWith("+")) return p;
  if (p.startsWith("0")) return "+254" + p.slice(1);
  if (p.startsWith("254")) return "+" + p;
  return p;
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const phone = normalizePhone(to);

  if (!AT_USERNAME || !AT_API_KEY) {
    console.log(`\n[SMS → ${phone}]\n${message}\n`);
    return true;
  }

  try {
    const body = new URLSearchParams({
      username: AT_USERNAME,
      to: phone,
      message,
      from: AT_SENDER_ID,
    });
    const res = await fetch(atEndpoint(), {
      method: "POST",
      headers: {
        apiKey: AT_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    if (!res.ok) {
      console.error(`[SMS] delivery failed (${res.status})`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SMS] error", err);
    return false;
  }
}
