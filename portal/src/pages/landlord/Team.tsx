import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Modal, Field, EmptyState, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { date } from "../../lib/format";

interface Staff { id: string; name: string; email: string; phone: string; createdAt: string }

export function Team() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [show, setShow] = useState(false);

  const load = () => api.get<Staff[]>("/landlord/staff").then(setStaff);
  useEffect(() => { load(); }, []);

  async function del(s: Staff) {
    if (!confirm(`Remove caretaker ${s.name}?`)) return;
    try { await api.del(`/landlord/staff/${s.id}`); toast("Removed"); load(); }
    catch (e: any) { toast(e.message, true); }
  }

  if (!staff) return <Layout title="Team"><Spinner /></Layout>;

  return (
    <Layout title="Team" subtitle="Caretakers who submit water meter readings"
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShow(true)}>+ Add caretaker</button>}>
      <Card>
        {staff.length === 0 ? (
          <EmptyState icon="🔑" title="No caretakers yet" hint="Add a caretaker so they can record monthly water readings." />
        ) : (
          <table className="table">
            <thead><tr><th>Name</th><th>Contact</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td style={{ fontSize: 13.5 }}>{s.email}<div className="muted" style={{ fontSize: 12.5 }}>{s.phone}</div></td>
                  <td style={{ fontSize: 13 }}>{date(s.createdAt)}</td>
                  <td style={{ textAlign: "right" }}><button className="btn btn-ghost btn-sm" onClick={() => del(s)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {show && <StaffModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); toast("Caretaker added"); }} />}
    </Layout>
  );
}

function StaffModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try { await api.post("/landlord/staff", { ...f, password: f.password || undefined }); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Add caretaker" subtitle="They'll sign in through the tenant portal to enter readings." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.name || !f.email} onClick={save}>Add</button></>}>
      <Field label="Full name"><input className="input" value={f.name} onChange={set("name")} /></Field>
      <div className="row">
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set("phone")} placeholder="+2547…" /></Field>
      </div>
      <Field label="Temp password (optional)"><input className="input" value={f.password} onChange={set("password")} placeholder="Defaults to kodee1234" /></Field>
    </Modal>
  );
}
