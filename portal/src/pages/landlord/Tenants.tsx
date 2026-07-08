import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Modal, Field, EmptyState, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { money, date, UNIT_TYPE_LABELS } from "../../lib/format";

interface Tenant {
  id: string; active: boolean; startDate: string; endDate: string | null;
  renter: { id: string; name: string; email: string; phone: string };
  unit: { id: string; label: string; type: string; rent: number };
  property: { id: string; name: string };
  billed: number; paid: number; balance: number;
}
interface VacantUnit {
  id: string; label: string; type: string; rent: number;
  property: { name: string };
}

export function Tenants() {
  const toast = useToast();
  const [tab, setTab] = useState<"current" | "past">("current");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [assign, setAssign] = useState(false);
  const [payFor, setPayFor] = useState<Tenant | null>(null);

  const load = () => api.get<Tenant[]>("/landlord/tenants").then(setTenants);
  useEffect(() => { load(); }, []);

  async function endTenancy(t: Tenant) {
    if (!confirm(`Move out ${t.renter.name} from Unit ${t.unit.label}? Their record is kept.`)) return;
    try { await api.post(`/landlord/tenancies/${t.id}/end`); toast("Tenant moved out"); load(); }
    catch (e: any) { toast(e.message, true); }
  }

  if (!tenants) return <Layout title="Tenants"><Spinner /></Layout>;
  const list = tenants.filter((t) => (tab === "current" ? t.active : !t.active));

  return (
    <Layout title="Tenants" subtitle={`${tenants.filter((t) => t.active).length} current · ${tenants.filter((t) => !t.active).length} past`}
      actions={<button className="btn btn-primary btn-sm" onClick={() => setAssign(true)}>+ Add tenant</button>}>
      <div className="tabs" style={{ width: "fit-content", marginBottom: 16 }}>
        <button className={"tab" + (tab === "current" ? " active" : "")} onClick={() => setTab("current")}>Current</button>
        <button className={"tab" + (tab === "past" ? " active" : "")} onClick={() => setTab("past")}>Past</button>
      </div>

      <Card>
        {list.length === 0 ? (
          <EmptyState icon="👥" title={tab === "current" ? "No current tenants" : "No past tenants"} />
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th><th>Unit</th><th>Period</th><th>Balance</th><th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.renter.name}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{t.renter.phone || t.renter.email}</div>
                  </td>
                  <td>
                    {t.property.name} · {t.unit.label}
                    <div className="muted" style={{ fontSize: 12.5 }}>{UNIT_TYPE_LABELS[t.unit.type]} · {money(t.unit.rent)}</div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {date(t.startDate)}<div className="muted" style={{ fontSize: 12.5 }}>{t.endDate ? "to " + date(t.endDate) : "present"}</div>
                  </td>
                  <td>
                    <b style={{ color: t.balance > 0 ? "var(--warn)" : "var(--ok)" }}>{money(t.balance)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>of {money(t.billed)}</div>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {t.active && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPayFor(t)}>Record payment</button>{" "}
                        <button className="btn btn-ghost btn-sm" onClick={() => endTenancy(t)}>Move out</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {assign && <AssignModal onClose={() => setAssign(false)} onSaved={() => { setAssign(false); load(); toast("Tenant added"); }} />}
      {payFor && <PayModal tenant={payFor} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); load(); toast("Payment recorded"); }} />}
    </Layout>
  );
}

function AssignModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [units, setUnits] = useState<VacantUnit[]>([]);
  const [f, setF] = useState({ unitId: "", name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    api.get<VacantUnit[]>("/landlord/units?status=VACANT").then((u) => {
      setUnits(u); if (u[0]) setF((s) => ({ ...s, unitId: u[0].id }));
    });
  }, []);
  async function save() {
    setBusy(true);
    try {
      await api.post(`/landlord/units/${f.unitId}/tenants`, { name: f.name, email: f.email, phone: f.phone, password: f.password || undefined });
      onSaved();
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Add tenant" subtitle="Assign a renter to a vacant unit. They get a portal login." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.unitId || !f.name || !f.email} onClick={save}>Add tenant</button></>}>
      {units.length === 0 ? (
        <div className="muted">No vacant units available. Free up a unit first.</div>
      ) : (
        <>
          <Field label="Vacant unit">
            <select className="select" value={f.unitId} onChange={set("unitId")}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.property.name} · {u.label} ({UNIT_TYPE_LABELS[u.type]}) — {money(u.rent)}</option>)}
            </select>
          </Field>
          <Field label="Full name"><input className="input" value={f.name} onChange={set("name")} /></Field>
          <div className="row">
            <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
            <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} placeholder="+2547…" /></Field>
          </div>
          <Field label="Temp password (optional)"><input className="input" value={f.password} onChange={set("password")} placeholder="Defaults to kodee1234" /></Field>
        </>
      )}
    </Modal>
  );
}

function PayModal({ tenant, onClose, onSaved }: { tenant: Tenant; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ amount: tenant.balance || 0, method: "MPESA", reference: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try {
      await api.post("/landlord/payments", { tenancyId: tenant.id, amount: Number(f.amount), method: f.method, reference: f.reference });
      onSaved();
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Record payment — ${tenant.renter.name}`} subtitle={`Unit ${tenant.unit.label} · balance ${money(tenant.balance)}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Record</button></>}>
      <div className="row">
        <Field label="Amount"><input className="input" type="number" value={f.amount} onChange={set("amount")} /></Field>
        <Field label="Method">
          <select className="select" value={f.method} onChange={set("method")}>
            <option value="MPESA">M-Pesa</option><option value="CASH">Cash</option><option value="BANK">Bank</option>
          </select>
        </Field>
      </div>
      <Field label="Reference (optional)"><input className="input" value={f.reference} onChange={set("reference")} placeholder="M-Pesa code" /></Field>
    </Modal>
  );
}
