import { useEffect, useState } from "react";
import { Card, Badge, Modal, Field, EmptyState, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { date, statusBadge } from "../lib/format";

interface Ticket { id: string; title: string; description: string; category: string; priority: string; status: string; createdAt: string }
interface Notice { id: string; moveOutDate: string; reason: string | null; status: string; createdAt: string }

export function Requests() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [newTicket, setNewTicket] = useState(false);
  const [newNotice, setNewNotice] = useState(false);

  const load = () => {
    api.get<Ticket[]>("/renter/tickets").then(setTickets);
    api.get<Notice[]>("/renter/notices").then(setNotices);
  };
  useEffect(() => { load(); }, []);

  if (!tickets || !notices) return <Spinner />;

  return (
    <div className="stack">
      <div className="hstack" style={{ gap: 10 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setNewTicket(true)}>🛠️ Report issue</button>
        <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setNewNotice(true)}>📤 Give notice</button>
      </div>

      <div>
        <div style={{ fontWeight: 700, margin: "4px 2px 10px" }}>Maintenance requests</div>
        {tickets.length === 0 ? (
          <Card className="card-pad"><EmptyState icon="🛠️" title="No requests yet" hint="Report any issue with your unit." /></Card>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {tickets.map((t) => {
              const sb = statusBadge(t.status);
              return (
                <Card key={t.id} className="card-pad">
                  <div className="hstack" style={{ justifyContent: "space-between" }}>
                    <b>{t.title}</b>
                    <Badge cls={sb.cls} label={sb.label} />
                  </div>
                  {t.description && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t.description}</div>}
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t.category[0] + t.category.slice(1).toLowerCase()} · {date(t.createdAt)}</div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {notices.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, margin: "4px 2px 10px" }}>Notices</div>
          <div className="stack" style={{ gap: 10 }}>
            {notices.map((n) => {
              const sb = statusBadge(n.status);
              return (
                <Card key={n.id} className="card-pad">
                  <div className="hstack" style={{ justifyContent: "space-between" }}>
                    <b>Move out {date(n.moveOutDate)}</b>
                    <Badge cls={sb.cls} label={sb.label} />
                  </div>
                  {n.reason && <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{n.reason}</div>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {newTicket && <TicketModal onClose={() => setNewTicket(false)} onSaved={() => { setNewTicket(false); load(); toast("Request submitted"); }} />}
      {newNotice && <NoticeModal onClose={() => setNewNotice(false)} onSaved={() => { setNewNotice(false); load(); toast("Notice submitted"); }} />}
    </div>
  );
}

function TicketModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: "", description: "", category: "GENERAL", priority: "MEDIUM" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try { await api.post("/renter/tickets", f); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Report an issue" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.title} onClick={save}>Submit</button></>}>
      <Field label="What's the issue?"><input className="input" value={f.title} onChange={set("title")} placeholder="e.g. Kitchen tap leaking" /></Field>
      <Field label="Details"><textarea className="textarea" value={f.description} onChange={set("description")} /></Field>
      <div className="row">
        <Field label="Category">
          <select className="select" value={f.category} onChange={set("category")}>
            {["PLUMBING", "ELECTRICAL", "STRUCTURAL", "APPLIANCE", "GENERAL"].map((c) => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className="select" value={f.priority} onChange={set("priority")}>
            {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

function NoticeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ moveOutDate: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try { await api.post("/renter/notices", f); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Give notice to vacate" subtitle="Let your landlord know your planned move-out date." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.moveOutDate} onClick={save}>Submit notice</button></>}>
      <Field label="Move-out date"><input className="input" type="date" value={f.moveOutDate} onChange={set("moveOutDate")} /></Field>
      <Field label="Reason (optional)"><textarea className="textarea" value={f.reason} onChange={set("reason")} /></Field>
    </Modal>
  );
}
