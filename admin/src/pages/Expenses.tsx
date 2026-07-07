import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card, Modal, Field, Badge, EmptyState, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { money, date } from "../lib/format";

interface Expense {
  id: string; category: string; title: string; amount: number; vendor: string | null;
  spentAt: string; property: { id: string; name: string }; unit: { label: string } | null;
}
interface Prop { id: string; name: string }

const CATS = ["MAINTENANCE", "REPAIR", "UTILITY", "SALARY", "OTHER"];
const CAT_BADGE: Record<string, string> = {
  MAINTENANCE: "badge-info", REPAIR: "badge-warn", UTILITY: "badge-info", SALARY: "badge-muted", OTHER: "badge-muted",
};

export function Expenses() {
  const toast = useToast();
  const [items, setItems] = useState<Expense[] | null>(null);
  const [props, setProps] = useState<Prop[]>([]);
  const [show, setShow] = useState(false);

  const load = () => api.get<Expense[]>("/landlord/expenses").then(setItems);
  useEffect(() => {
    load();
    api.get<any[]>("/landlord/properties").then((p) => setProps(p.map((x) => ({ id: x.id, name: x.name }))));
  }, []);

  async function del(e: Expense) {
    if (!confirm(`Delete "${e.title}"?`)) return;
    try { await api.del(`/landlord/expenses/${e.id}`); toast("Deleted"); load(); }
    catch (er: any) { toast(er.message, true); }
  }

  if (!items) return <Layout title="Expenses"><Spinner /></Layout>;
  const total = items.reduce((s, e) => s + e.amount, 0);

  return (
    <Layout title="Expenses & maintenance" subtitle={`${items.length} entries · ${money(total)} total`}
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShow(true)}>+ Add expense</button>}>
      <Card>
        {items.length === 0 ? (
          <EmptyState icon="🧾" title="No expenses logged" hint="Track maintenance, repairs, salaries and utilities here." />
        ) : (
          <table className="table">
            <thead><tr><th>Item</th><th>Property</th><th>Category</th><th>Date</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td><b>{e.title}</b>{e.vendor && <div className="muted" style={{ fontSize: 12.5 }}>{e.vendor}</div>}</td>
                  <td style={{ fontSize: 13.5 }}>{e.property.name}{e.unit && ` · ${e.unit.label}`}</td>
                  <td><Badge cls={CAT_BADGE[e.category]} label={e.category[0] + e.category.slice(1).toLowerCase()} /></td>
                  <td style={{ fontSize: 13 }}>{date(e.spentAt)}</td>
                  <td><b>{money(e.amount)}</b></td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm" onClick={() => del(e)}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {show && <ExpenseModal props={props} onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); toast("Expense added"); }} />}
    </Layout>
  );
}

function ExpenseModal({ props, onClose, onSaved }: { props: Prop[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ propertyId: props[0]?.id || "", category: "MAINTENANCE", title: "", amount: 0, vendor: "", spentAt: new Date().toISOString().slice(0, 10) });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try { await api.post("/landlord/expenses", { ...f, amount: Number(f.amount) }); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Add expense" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.title || !f.propertyId} onClick={save}>Save</button></>}>
      <Field label="Property">
        <select className="select" value={f.propertyId} onChange={set("propertyId")}>
          {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Title"><input className="input" value={f.title} onChange={set("title")} placeholder="e.g. Fixed leaking pipe" /></Field>
      <div className="row">
        <Field label="Category">
          <select className="select" value={f.category} onChange={set("category")}>
            {CATS.map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Amount"><input className="input" type="number" value={f.amount} onChange={set("amount")} /></Field>
      </div>
      <div className="row">
        <Field label="Vendor (optional)"><input className="input" value={f.vendor} onChange={set("vendor")} /></Field>
        <Field label="Date"><input className="input" type="date" value={f.spentAt} onChange={set("spentAt")} /></Field>
      </div>
    </Modal>
  );
}
