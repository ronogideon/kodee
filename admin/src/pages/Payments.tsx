import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card, Badge, EmptyState, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { money, date, statusBadge } from "../lib/format";

interface Invoice {
  id: string; period: string; total: number; amountPaid: number; status: string;
  dueDate: string; rentAmount: number; waterAmount: number; garbageAmount: number;
  electricityAmount: number; renter: string; unit: string;
}

function periodOptions(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const dd = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function periodLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-KE", { month: "long", year: "numeric" });
}

export function Payments() {
  const toast = useToast();
  const [period, setPeriod] = useState(periodOptions()[0]);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => { setInvoices(null); api.get<Invoice[]>(`/landlord/invoices?period=${period}`).then(setInvoices); };
  useEffect(() => { load(); }, [period]);

  async function generate() {
    setBusy(true);
    try { const r = await api.post<{ generated: number }>("/landlord/billing/generate", { period }); toast(`${r.generated} invoices generated`); load(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  async function remind() {
    setBusy(true);
    try { const r = await api.post<{ sent: number; total: number }>("/landlord/billing/remind", { period }); toast(`Reminders: ${r.sent}/${r.total} sent`); load(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }

  const billed = invoices?.reduce((s, i) => s + i.total, 0) || 0;
  const collected = invoices?.reduce((s, i) => s + i.amountPaid, 0) || 0;

  return (
    <Layout title="Payments" subtitle="Invoices, collections and reminders"
      actions={
        <>
          <select className="select" style={{ width: "auto" }} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {periodOptions().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={generate}>Generate</button>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={remind}>📨 Send reminders</button>
        </>
      }>
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <Card className="stat"><div className="label">Billed</div><div className="value sm">{money(billed)}</div></Card>
        <Card className="stat"><div className="label">Collected</div><div className="value sm" style={{ color: "var(--ok)" }}>{money(collected)}</div></Card>
        <Card className="stat"><div className="label">Outstanding</div><div className="value sm" style={{ color: "var(--warn)" }}>{money(billed - collected)}</div></Card>
      </div>

      {!invoices ? <Spinner /> : (
        <Card>
          {invoices.length === 0 ? (
            <EmptyState icon="🧾" title="No invoices for this month yet" hint="Click Generate to issue them for active tenants." />
          ) : (
            <table className="table">
              <thead>
                <tr><th>Tenant</th><th>Breakdown</th><th>Total</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const sb = statusBadge(i.status);
                  const parts = [
                    `Rent ${money(i.rentAmount)}`,
                    i.waterAmount > 0 && `Water ${money(i.waterAmount)}`,
                    i.garbageAmount > 0 && `Garbage ${money(i.garbageAmount)}`,
                    i.electricityAmount > 0 && `Elec ${money(i.electricityAmount)}`,
                  ].filter(Boolean).join(" · ");
                  return (
                    <tr key={i.id}>
                      <td><b>{i.renter}</b><div className="muted" style={{ fontSize: 12.5 }}>Unit {i.unit}</div></td>
                      <td className="muted" style={{ fontSize: 12.5, maxWidth: 320 }}>{parts}</td>
                      <td><b>{money(i.total)}</b>{i.amountPaid > 0 && i.amountPaid < i.total && <div className="muted" style={{ fontSize: 12 }}>paid {money(i.amountPaid)}</div>}</td>
                      <td style={{ fontSize: 13 }}>{date(i.dueDate)}</td>
                      <td><Badge cls={sb.cls} label={sb.label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </Layout>
  );
}
