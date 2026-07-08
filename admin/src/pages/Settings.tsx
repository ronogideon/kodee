import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card, Field, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";

export function Settings() {
  const toast = useToast();
  const [rate, setRate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<{ smsRatePerSms: number }>("/superadmin/settings").then((s) => setRate(s.smsRatePerSms));
  }, []);

  async function save() {
    setBusy(true);
    try {
      await api.patch("/superadmin/settings", { smsRatePerSms: Number(rate) });
      toast("SMS rate updated");
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (rate === null) return <Layout title="Settings"><Spinner /></Layout>;

  return (
    <Layout title="Settings" subtitle="Platform configuration">
      <Card className="card-pad" style={{ maxWidth: 480 }}>
        <h3 style={{ marginBottom: 4 }}>Kodee SMS gateway</h3>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
          What landlords are charged per SMS segment (160 characters). Debited from
          their prepaid wallet on every reminder and custom message.
        </p>
        <Field label="Rate (KES per SMS)">
          <input
            className="input"
            type="number"
            step="0.05"
            min="0"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </Field>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          Save rate
        </button>
      </Card>
    </Layout>
  );
}
