import { useEffect, useState } from "react";
import { Card, Badge, Spinner, Modal, Field, EmptyState, useToast } from "../components/ui";
import { api } from "../lib/api";
import { money, date, statusBadge, UNIT_TYPE_LABELS } from "../lib/format";

interface Dash {
  tenancy: {
    id: string; startDate: string;
    unit: { label: string; type: string; rent: number; hasWater: boolean; hasGarbage: boolean; hasElectricity: boolean };
    property: { name: string; address: string };
  } | null;
  period: string;
  periodLabel: string;
  invoice: {
    id: string; total: number; amountPaid: number; status: string; dueDate: string;
    rentAmount: number; waterAmount: number; garbageAmount: number; electricityAmount: number;
  } | null;
  reading: { previous: number; current: number; consumption: number; ratePerCbm: number; amount: number } | null;
  payments: { id: string; amount: number; method: string; paidAt: string }[];
}

export function Home() {
  const toast = useToast();
  const [d, setD] = useState<Dash | null>(null);
  const [pay, setPay] = useState(false);

  const load = () => api.get<Dash>("/renter/dashboard").then(setD);
  useEffect(() => { load(); }, []);

  if (!d) return <Spinner />;
  if (!d.tenancy)
    return <EmptyState icon="🏠" title="No active tenancy" hint="Your landlord hasn't assigned you a unit yet." />;

  const inv = d.invoice;
  const balance = inv ? inv.total - inv.amountPaid : 0;
  const sb = inv ? statusBadge(inv.status) : null;

  return (
    <div className="stack">
      {/* Invoice hero */}
      {inv ? (
        <div className="hero-invoice">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.9, fontSize: 13.5 }}>
            <span>{d.periodLabel} · balance due</span>
            {sb && <span style={{ background: "rgba(255,255,255,0.2)", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{sb.label}</span>}
          </div>
          <div className="amt">{money(balance)}</div>
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {d.tenancy.property.name} · Unit {d.tenancy.unit.label} · due {date(inv.dueDate)}
          </div>
          {balance > 0 && (
            <button className="btn btn-block" style={{ marginTop: 16, background: "#fff", color: "var(--brand-700)" }} onClick={() => setPay(true)}>
              Pay with M-Pesa
            </button>
          )}
          {balance <= 0 && (
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 14 }}>✓ Fully paid — thank you!</div>
          )}
        </div>
      ) : (
        <Card className="card-pad"><EmptyState icon="🧾" title="No invoice yet" hint="Your invoice for this month hasn't been issued." /></Card>
      )}

      {/* Breakdown */}
      {inv && (
        <Card className="card-pad">
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Invoice breakdown</div>
          <div className="line"><span>Rent</span><b>{money(inv.rentAmount)}</b></div>
          {d.tenancy.unit.hasWater && (
            <div className="line">
              <span>
                Water
                {d.reading && (
                  <span className="muted" style={{ fontSize: 12, display: "block" }}>
                    {d.reading.consumption} m³ × {money(d.reading.ratePerCbm)} ({d.reading.previous} → {d.reading.current})
                  </span>
                )}
                {!d.reading && <span className="muted" style={{ fontSize: 12, display: "block" }}>awaiting meter reading</span>}
              </span>
              <b>{money(inv.waterAmount)}</b>
            </div>
          )}
          {inv.garbageAmount > 0 && <div className="line"><span>Garbage collection</span><b>{money(inv.garbageAmount)}</b></div>}
          {inv.electricityAmount > 0 && <div className="line"><span>Electricity</span><b>{money(inv.electricityAmount)}</b></div>}
          <div className="line total"><span>Total</span><span>{money(inv.total)}</span></div>
          {inv.amountPaid > 0 && inv.amountPaid < inv.total && (
            <div className="line" style={{ color: "var(--ok)" }}><span>Paid so far</span><b>−{money(inv.amountPaid)}</b></div>
          )}
        </Card>
      )}

      {/* Meter reading card (always visible to tenant) */}
      {d.tenancy.unit.hasWater && (
        <Card className="card-pad">
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>💧 Water meter — {d.periodLabel}</div>
            {d.reading ? <Badge cls="badge-ok" label="Recorded" /> : <Badge cls="badge-muted" label="Pending" />}
          </div>
          {d.reading ? (
            <div className="hstack" style={{ justifyContent: "space-between", marginTop: 12, textAlign: "center" }}>
              <div><div className="muted" style={{ fontSize: 12 }}>Previous</div><b>{d.reading.previous}</b></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Current</div><b>{d.reading.current}</b></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Used</div><b>{d.reading.consumption} m³</b></div>
              <div><div className="muted" style={{ fontSize: 12 }}>Bill</div><b style={{ color: "var(--brand)" }}>{money(d.reading.amount)}</b></div>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13.5, marginTop: 8 }}>The caretaker hasn't recorded this month's reading yet.</div>
          )}
        </Card>
      )}

      {/* Unit info */}
      <Card className="card-pad">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Your home</div>
        <div className="line"><span className="muted">Property</span><span>{d.tenancy.property.name}</span></div>
        <div className="line"><span className="muted">Unit</span><span>{d.tenancy.unit.label} · {UNIT_TYPE_LABELS[d.tenancy.unit.type]}</span></div>
        <div className="line"><span className="muted">Monthly rent</span><span>{money(d.tenancy.unit.rent)}</span></div>
        <div className="line"><span className="muted">Tenant since</span><span>{date(d.tenancy.startDate)}</span></div>
      </Card>

      {pay && inv && <PayModal balance={balance} onClose={() => setPay(false)} onPaid={() => { setPay(false); load(); toast("Payment received. Thank you!"); }} />}
    </div>
  );
}

function PayModal({ balance, onClose, onPaid }: { balance: number; onClose: () => void; onPaid: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState(balance);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  async function poll(txnId: string) {
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const s = await api.get<{ status: string; resultDesc?: string }>(`/renter/pay/status/${txnId}`);
        if (s.status === "PAID") return onPaid();
        if (s.status === "FAILED") {
          setWaiting(false);
          return toast(s.resultDesc || "Payment was not completed.", true);
        }
      } catch {}
    }
    setWaiting(false);
    toast("Still waiting for M-Pesa — refresh in a moment to check.", true);
  }

  async function pay() {
    setBusy(true);
    try {
      const r = await api.post<{ pending?: boolean; txnId?: string; ok?: boolean }>("/renter/pay", {
        amount: Number(amount),
        ...(phone ? { phone } : {}),
      });
      if (r.pending && r.txnId) {
        setWaiting(true);
        poll(r.txnId);
      } else {
        onPaid();
      }
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  if (waiting) {
    return (
      <Modal title="Check your phone" subtitle="An M-Pesa prompt has been sent. Enter your PIN to complete the payment." onClose={onClose}>
        <div style={{ display: "grid", placeItems: "center", padding: 20 }}>
          <div className="spinner" />
          <div className="muted" style={{ marginTop: 14, fontSize: 13.5 }}>Waiting for confirmation…</div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Pay with M-Pesa" subtitle="You'll get an STK prompt on your phone to confirm." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={pay}>Pay {money(Number(amount))}</button></>}>
      <Field label="Amount"><input className="input" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
      <Field label="M-Pesa phone (blank = your account phone)">
        <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" />
      </Field>
    </Modal>
  );
}
