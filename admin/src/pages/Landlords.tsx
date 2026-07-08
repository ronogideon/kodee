import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card, Badge, Modal, Field, EmptyState, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { money, date } from "../lib/format";

interface Landlord {
  id: string;
  name: string;
  email: string;
  phone: string;
  suspended: boolean;
  createdAt: string;
  properties: number;
  units: number;
  occupied: number;
  occupancy: number;
  staff: number;
  smsBalance: number;
  smsSent: number;
}

export function Landlords() {
  const toast = useToast();
  const [landlords, setLandlords] = useState<Landlord[] | null>(null);
  const [creditFor, setCreditFor] = useState<Landlord | null>(null);
  const [q, setQ] = useState("");

  const load = () => api.get<Landlord[]>("/superadmin/landlords").then(setLandlords);
  useEffect(() => { load(); }, []);

  async function toggleSuspend(l: Landlord) {
    const verb = l.suspended ? "Reactivate" : "Suspend";
    if (!confirm(`${verb} ${l.name}? ${l.suspended ? "They and their tenants regain access." : "They and all their tenants/caretakers will be locked out."}`)) return;
    try {
      await api.patch(`/superadmin/landlords/${l.id}`, { suspended: !l.suspended });
      toast(`${l.name} ${l.suspended ? "reactivated" : "suspended"}`);
      load();
    } catch (e: any) { toast(e.message, true); }
  }

  if (!landlords) return <Layout title="Landlords"><Spinner /></Layout>;

  const list = landlords.filter(
    (l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Layout title="Landlords" subtitle={`${landlords.length} serviced · ${landlords.filter((l) => l.suspended).length} suspended`}
      actions={<input className="input" style={{ width: 220 }} placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />}>
      <Card>
        {list.length === 0 ? (
          <EmptyState icon="🏢" title={q ? "No matches" : "No landlords yet"} hint={q ? "Try a different search." : "Landlords appear here when they register."} />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Landlord</th><th>Portfolio</th><th>Occupancy</th><th>SMS</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id} style={l.suspended ? { opacity: 0.6 } : undefined}>
                  <td>
                    <b>{l.name}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{l.email}{l.phone ? ` · ${l.phone}` : ""}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>since {date(l.createdAt)}</div>
                  </td>
                  <td style={{ fontSize: 13.5 }}>
                    {l.properties} propert{l.properties === 1 ? "y" : "ies"} · {l.units} units
                    <div className="muted" style={{ fontSize: 12.5 }}>{l.staff} staff/tenant accounts</div>
                  </td>
                  <td>
                    <b>{l.occupancy}%</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{l.occupied}/{l.units} occupied</div>
                  </td>
                  <td>
                    <b>{money(l.smsBalance)}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{l.smsSent} sent</div>
                  </td>
                  <td>
                    <Badge cls={l.suspended ? "badge-danger" : "badge-ok"} label={l.suspended ? "Suspended" : "Active"} />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setCreditFor(l)}>Credit SMS</button>{" "}
                    <button className={"btn btn-sm " + (l.suspended ? "btn-primary" : "btn-danger")} onClick={() => toggleSuspend(l)}>
                      {l.suspended ? "Reactivate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {creditFor && (
        <CreditModal landlord={creditFor} onClose={() => setCreditFor(null)}
          onDone={() => { setCreditFor(null); load(); toast("Wallet credited"); }} />
      )}
    </Layout>
  );
}

function CreditModal({ landlord, onClose, onDone }: { landlord: Landlord; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(500);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function credit() {
    setBusy(true);
    try {
      await api.post(`/superadmin/landlords/${landlord.id}/credit`, { amount: Number(amount), note: note || undefined });
      onDone();
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Credit SMS wallet — ${landlord.name}`} subtitle={`Current balance ${money(landlord.smsBalance)}. For offline payments or goodwill credit.`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || amount <= 0} onClick={credit}>Credit {money(Number(amount))}</button></>}>
      <Field label="Amount (KES)">
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </Field>
      <Field label="Note (optional)">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bank transfer ref 12345" />
      </Field>
    </Modal>
  );
}
