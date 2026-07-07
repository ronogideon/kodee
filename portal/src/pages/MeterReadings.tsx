import { useEffect, useState } from "react";
import { Card, Badge, Modal, Field, EmptyState, Spinner, useToast } from "../components/ui";
import { api } from "../lib/api";
import { money, UNIT_TYPE_LABELS } from "../lib/format";

interface Unit {
  id: string; label: string; type: string; status: string;
  property: { id: string; name: string };
  tenant: string | null;
  ratePerCbm: number;
  lastReading: number;
  currentReading: number | null;
  submittedThisPeriod: boolean;
}

export function MeterReadings() {
  const toast = useToast();
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [active, setActive] = useState<Unit | null>(null);

  const load = () => api.get<Unit[]>("/caretaker/units").then(setUnits);
  useEffect(() => { load(); }, []);

  if (!units) return <Spinner />;

  const pending = units.filter((u) => !u.submittedThisPeriod).length;
  // Group by property for organised, consistent access.
  const byProperty: Record<string, Unit[]> = {};
  units.forEach((u) => { (byProperty[u.property.name] ||= []).push(u); });

  return (
    <div className="stack">
      <Card className="card-pad" style={{ background: pending ? "var(--warn-bg)" : "var(--ok-bg)" }}>
        <div style={{ fontWeight: 700 }}>{pending ? `${pending} reading${pending === 1 ? "" : "s"} still needed` : "All readings submitted 🎉"}</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 3 }}>Enter this month's water meter reading for each unit.</div>
      </Card>

      {Object.keys(byProperty).length === 0 && <EmptyState icon="💧" title="No water-metered units assigned" />}

      {Object.entries(byProperty).map(([name, list]) => (
        <div key={name}>
          <div style={{ fontWeight: 700, margin: "4px 2px 10px" }}>{name}</div>
          <div className="stack" style={{ gap: 10 }}>
            {list.map((u) => (
              <Card key={u.id} className="card-pad">
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  <div>
                    <b>Unit {u.label}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>
                      {UNIT_TYPE_LABELS[u.type]} · {u.tenant || "vacant"}
                    </div>
                  </div>
                  {u.submittedThisPeriod ? <Badge cls="badge-ok" label="Done" /> : <Badge cls="badge-warn" label="Pending" />}
                </div>
                <div className="hstack" style={{ justifyContent: "space-between", marginTop: 12 }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Last: <b style={{ color: "var(--ink)" }}>{u.lastReading}</b>
                    {u.submittedThisPeriod && u.currentReading != null && <> · Now: <b style={{ color: "var(--ink)" }}>{u.currentReading}</b></>}
                    {" · "}{money(u.ratePerCbm)}/m³
                  </span>
                  <button className="btn btn-primary btn-sm" onClick={() => setActive(u)}>
                    {u.submittedThisPeriod ? "Edit" : "Enter reading"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {active && <ReadingModal unit={active} onClose={() => setActive(null)} onSaved={() => { setActive(null); load(); toast("Reading saved"); }} />}
    </div>
  );
}

function ReadingModal({ unit, onClose, onSaved }: { unit: Unit; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState<number>(unit.currentReading ?? unit.lastReading);
  const [busy, setBusy] = useState(false);

  const consumption = Math.max(0, current - unit.lastReading);
  const bill = consumption * unit.ratePerCbm;

  async function save() {
    if (current < unit.lastReading) { toast(`Reading can't be below ${unit.lastReading}`, true); return; }
    setBusy(true);
    try { await api.post(`/caretaker/units/${unit.id}/reading`, { current: Number(current) }); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }

  return (
    <Modal title={`Unit ${unit.label} — water reading`} subtitle={`${unit.property.name} · previous reading ${unit.lastReading} m³`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={save}>Save reading</button></>}>
      <Field label="Current meter reading (m³)">
        <input className="input" type="number" value={current} onChange={(e) => setCurrent(Number(e.target.value))} autoFocus
          style={{ fontSize: 22, fontWeight: 700, textAlign: "center" }} />
      </Field>
      <div className="card" style={{ background: "var(--brand-50)", border: "none", padding: 14, marginTop: 4 }}>
        <div className="line" style={{ borderColor: "rgba(37,99,235,0.15)" }}><span>Consumption</span><b>{consumption} m³</b></div>
        <div className="line" style={{ borderColor: "rgba(37,99,235,0.15)" }}><span>Rate</span><b>{money(unit.ratePerCbm)}/m³</b></div>
        <div className="line total" style={{ borderColor: "rgba(37,99,235,0.25)" }}><span>Water bill</span><span style={{ color: "var(--brand-700)" }}>{money(bill)}</span></div>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>This bill is added to {unit.tenant || "the tenant"}'s invoice and shown in their portal.</div>
    </Modal>
  );
}
