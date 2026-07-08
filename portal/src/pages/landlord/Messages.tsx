import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Badge, Modal, Field, EmptyState, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { money, date } from "../../lib/format";

interface Wallet {
  balance: number;
  toppedUp: number;
  spent: number;
  ratePerSms: number;
  smsRemaining: number;
  txns: { id: string; type: string; amount: number; note: string | null; createdAt: string }[];
}
interface Msg {
  id: string; toName: string; toPhone: string; body: string; kind: string;
  status: string; segments: number; cost: number; error: string | null; createdAt: string;
}
interface Prop { id: string; name: string }
interface Tenant { id: string; renter: { name: string }; unit: { label: string }; active: boolean }

export function Messages() {
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [showTopup, setShowTopup] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  const load = () => {
    api.get<Wallet>("/landlord/wallet").then(setWallet);
    api.get<Msg[]>("/landlord/messages").then(setMessages);
  };
  useEffect(() => { load(); }, []);

  if (!wallet || !messages) return <Layout title="Messages"><Spinner /></Layout>;

  const low = wallet.smsRemaining < 20;

  return (
    <Layout title="Messages" subtitle="SMS to your tenants — reminders and announcements"
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowCompose(true)}>✍️ New message</button>}>
      <div className="stack">
        {/* Wallet */}
        <div className="grid grid-3">
          <Card className="stat" style={low ? { borderColor: "var(--warn)" } : undefined}>
            <div className="label">SMS balance</div>
            <div className="value sm" style={{ color: low ? "var(--warn)" : "var(--ink)" }}>{money(wallet.balance)}</div>
            <div className="foot">≈ {wallet.smsRemaining.toLocaleString()} SMS at {money(wallet.ratePerSms)}/SMS</div>
            <div className="hstack" style={{ marginTop: 12, gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowTopup(true)}>Top up</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLedger(true)}>Ledger</button>
            </div>
          </Card>
          <Card className="stat">
            <div className="label">Lifetime topped up</div>
            <div className="value sm">{money(wallet.toppedUp)}</div>
            <div className="foot">Spent {money(wallet.spent)}</div>
          </Card>
          <Card className="stat" style={{ background: "var(--brand-50)", borderColor: "var(--brand-100)" }}>
            <div className="label" style={{ color: "var(--brand-700)" }}>⏰ Automatic reminders — ON</div>
            <div className="foot" style={{ marginTop: 8, color: "var(--ink-2)" }}>
              On the <b>1st of every month at 8:00 AM</b>, each tenant automatically gets an SMS with their full invoice
              (rent + utilities) and the 5-day payment window. Each reminder is billed from this balance.
            </div>
          </Card>
        </div>

        {low && (
          <Card className="card-pad" style={{ background: "var(--warn-bg)", borderColor: "var(--warn)" }}>
            <b>Low SMS balance.</b> <span style={{ fontSize: 13.5 }}>With ≈{wallet.smsRemaining} SMS left, next month's automatic reminders may not all send. Top up to keep them going.</span>
          </Card>
        )}

        {/* Log */}
        <Card>
          <div className="card-hd"><h3>Sent messages</h3><span className="muted" style={{ fontSize: 12.5 }}>{messages.length} recent</span></div>
          {messages.length === 0 ? (
            <EmptyState icon="💬" title="No messages yet" hint="Reminders and announcements you send will appear here." />
          ) : (
            <table className="table">
              <thead><tr><th>To</th><th>Message</th><th>Type</th><th>Cost</th><th>Status</th><th>When</th></tr></thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td><b>{m.toName}</b><div className="muted" style={{ fontSize: 12 }}>{m.toPhone}</div></td>
                    <td className="muted" style={{ fontSize: 12.5, maxWidth: 340 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{m.body}</div>
                      {m.error && <div style={{ color: "var(--danger)", marginTop: 2 }}>{m.error}</div>}
                    </td>
                    <td><Badge cls={m.kind === "REMINDER" ? "badge-info" : "badge-muted"} label={m.kind === "REMINDER" ? "Reminder" : "Custom"} /></td>
                    <td style={{ fontSize: 13 }}>{m.status === "SENT" ? money(m.cost) : "—"}</td>
                    <td><Badge cls={m.status === "SENT" ? "badge-ok" : "badge-danger"} label={m.status === "SENT" ? "Sent" : "Failed"} /></td>
                    <td className="muted" style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>{date(m.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} onDone={() => { setShowTopup(false); load(); toast("Balance topped up"); }} />}
      {showCompose && <ComposeModal rate={wallet.ratePerSms} onClose={() => setShowCompose(false)} onDone={(r) => { setShowCompose(false); load(); toast(r); }} />}
      {showLedger && (
        <Modal title="Wallet ledger" subtitle="Every top-up and SMS debit" onClose={() => setShowLedger(false)}>
          {wallet.txns.length === 0 ? <div className="muted">No transactions yet.</div> : (
            <div>
              {wallet.txns.map((t) => (
                <div key={t.id} className="line">
                  <span>
                    {t.type === "TOPUP" ? "⬆️ Top-up" : t.type === "DEBIT" ? "✉️ SMS" : "⚙️ Adjustment"}
                    <span className="muted" style={{ display: "block", fontSize: 12 }}>{t.note} · {date(t.createdAt)}</span>
                  </span>
                  <b style={{ color: t.type === "TOPUP" ? "var(--ok)" : "var(--ink)" }}>
                    {t.type === "TOPUP" ? "+" : "−"}{money(t.amount)}
                  </b>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
}

function TopupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(500);
  const [busy, setBusy] = useState(false);
  async function topup() {
    setBusy(true);
    try { await api.post("/landlord/wallet/topup", { amount: Number(amount) }); onDone(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Top up SMS balance" subtitle="Pay via M-Pesa. (Demo credits instantly — STK push wiring is the production step.)" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || amount <= 0} onClick={topup}>Pay {money(Number(amount))}</button></>}>
      <Field label="Amount (KES)">
        <input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} style={{ fontSize: 20, fontWeight: 700, textAlign: "center" }} />
      </Field>
      <div className="hstack" style={{ gap: 8 }}>
        {[200, 500, 1000, 2000].map((v) => (
          <button key={v} type="button" className={"badge " + (amount === v ? "badge-info" : "badge-muted")} style={{ cursor: "pointer", padding: "7px 12px" }} onClick={() => setAmount(v)}>
            {money(v)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function ComposeModal({ rate, onClose, onDone }: { rate: number; onClose: () => void; onDone: (result: string) => void }) {
  const toast = useToast();
  const [props, setProps] = useState<Prop[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [f, setF] = useState({ target: "ALL", propertyId: "", tenancyId: "", body: "" });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.get<any[]>("/landlord/properties").then((p) => setProps(p.map((x) => ({ id: x.id, name: x.name }))));
    api.get<Tenant[]>("/landlord/tenants").then((t) => setTenants(t.filter((x) => x.active)));
  }, []);

  const segments = Math.max(1, Math.ceil(f.body.length / 160));
  const recipients =
    f.target === "ALL" ? tenants.length :
    f.target === "TENANCY" ? 1 : undefined;
  const estimate = recipients != null ? recipients * segments * rate : undefined;

  async function send() {
    setBusy(true);
    try {
      const r = await api.post<{ sent: number; failed: number; total: number; lastError?: string }>("/landlord/messages/send", f);
      if (r.failed > 0) toast(`${r.sent}/${r.total} sent — ${r.lastError || "some failed"}`, true);
      onDone(`Sent to ${r.sent}/${r.total} tenant${r.total === 1 ? "" : "s"}`);
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }

  return (
    <Modal title="New message" subtitle="Sent by SMS and billed per message from your balance." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.body.trim()} onClick={send}>Send{estimate != null ? ` · ~${money(estimate)}` : ""}</button></>}>
      <Field label="Send to">
        <select className="select" value={f.target} onChange={set("target")}>
          <option value="ALL">All current tenants</option>
          <option value="PROPERTY">Everyone in one property</option>
          <option value="TENANCY">One tenant</option>
        </select>
      </Field>
      {f.target === "PROPERTY" && (
        <Field label="Property">
          <select className="select" value={f.propertyId} onChange={set("propertyId")}>
            <option value="">Choose property…</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      )}
      {f.target === "TENANCY" && (
        <Field label="Tenant">
          <select className="select" value={f.tenancyId} onChange={set("tenancyId")}>
            <option value="">Choose tenant…</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.renter.name} — Unit {t.unit.label}</option>)}
          </select>
        </Field>
      )}
      <Field label="Message">
        <textarea className="textarea" value={f.body} onChange={set("body")} placeholder="e.g. Water will be off Saturday morning for tank cleaning…" />
      </Field>
      <div className="muted" style={{ fontSize: 12.5 }}>
        {f.body.length} chars · {segments} segment{segments === 1 ? "" : "s"} per recipient
      </div>
    </Modal>
  );
}
