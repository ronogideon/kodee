import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Badge, Field, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";

interface Settlement {
  configured: boolean;
  type?: string;
  shortcode?: string;
  accountRef?: string;
  active?: boolean;
  hasCredentials?: boolean;
}

export function Settings() {
  const toast = useToast();
  const [current, setCurrent] = useState<Settlement | null>(null);
  const [f, setF] = useState({
    type: "PAYBILL",
    shortcode: "",
    accountRef: "RENT",
    passkey: "",
    consumerKey: "",
    consumerSecret: "",
    active: true,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Settlement>("/landlord/settlement").then((s) => {
      setCurrent(s);
      if (s.configured) {
        setF((prev) => ({
          ...prev,
          type: s.type || "PAYBILL",
          shortcode: s.shortcode || "",
          accountRef: s.accountRef || "RENT",
          active: s.active !== false,
        }));
      }
    });
  }, []);

  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      await api.put("/landlord/settlement", f);
      toast("Settlement method saved");
      const s = await api.get<Settlement>("/landlord/settlement");
      setCurrent(s);
      setF((prev) => ({ ...prev, passkey: "", consumerKey: "", consumerSecret: "" }));
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (!current) return <Layout title="Settings"><Spinner /></Layout>;

  return (
    <Layout title="Settings" subtitle="Your account and payment configuration">
      <Card className="card-pad" style={{ maxWidth: 560 }}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 4 }}>
          <h3>M-Pesa settlement method</h3>
          {current.configured ? (
            <Badge cls={current.active ? "badge-ok" : "badge-muted"} label={current.active ? "Active" : "Off"} />
          ) : (
            <Badge cls="badge-warn" label="Not set up" />
          )}
        </div>
        <p className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>
          Rent payments from your tenants are sent straight to <b>your</b> paybill or till via
          M-Pesa STK push. Get these credentials from your Safaricom Daraja portal. Until this is
          set up, tenant payments use the demo path (recorded without a real M-Pesa prompt).
        </p>

        <div className="row" style={{ marginTop: 14 }}>
          <Field label="Type">
            <select className="select" value={f.type} onChange={set("type")}>
              <option value="PAYBILL">Paybill</option>
              <option value="TILL">Till (Buy Goods)</option>
            </select>
          </Field>
          <Field label={f.type === "TILL" ? "Till number" : "Paybill number"}>
            <input className="input" value={f.shortcode} onChange={set("shortcode")} placeholder="e.g. 522533" />
          </Field>
        </div>
        <Field label="Account reference (shows on the tenant's prompt)">
          <input className="input" value={f.accountRef} onChange={set("accountRef")} maxLength={12} />
        </Field>
        <Field label={"Passkey" + (current.hasCredentials ? " (leave blank to keep current)" : "")}>
          <input className="input" type="password" value={f.passkey} onChange={set("passkey")} />
        </Field>
        <div className="row">
          <Field label={"Consumer key" + (current.hasCredentials ? " (blank = keep)" : "")}>
            <input className="input" type="password" value={f.consumerKey} onChange={set("consumerKey")} />
          </Field>
          <Field label={"Consumer secret" + (current.hasCredentials ? " (blank = keep)" : "")}>
            <input className="input" type="password" value={f.consumerSecret} onChange={set("consumerSecret")} />
          </Field>
        </div>
        <div className="hstack" style={{ justifyContent: "space-between", marginTop: 4 }}>
          <button
            type="button"
            className={"badge " + (f.active ? "badge-ok" : "badge-muted")}
            style={{ cursor: "pointer", padding: "8px 14px" }}
            onClick={() => setF({ ...f, active: !f.active })}
          >
            {f.active ? "✓ STK payments enabled" : "STK payments disabled"}
          </button>
          <button className="btn btn-primary" disabled={busy || !f.shortcode} onClick={save}>
            Save settlement method
          </button>
        </div>
      </Card>
    </Layout>
  );
}
