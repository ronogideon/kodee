import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Modal, Field, Badge, EmptyState, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { money, UNIT_TYPES, UNIT_TYPE_LABELS, statusBadge } from "../../lib/format";

interface Unit {
  id: string; label: string; type: string; rent: number; status: string;
  hasWater: boolean; hasGarbage: boolean; hasElectricity: boolean;
  electricityFlat: number | null;
  tenancies: { renter: { name: string } }[];
}
interface Property {
  id: string; name: string; address: string; city: string;
  waterRatePerCbm: number; garbageFee: number; units: Unit[];
}

export function Properties() {
  const toast = useToast();
  const [props, setProps] = useState<Property[] | null>(null);
  const [onlyVacant, setOnlyVacant] = useState(false);
  const [showProp, setShowProp] = useState(false);
  const [unitFor, setUnitFor] = useState<Property | null>(null);

  const load = () => api.get<Property[]>("/landlord/properties").then(setProps);
  useEffect(() => { load(); }, []);

  async function delProperty(p: Property) {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    try { await api.del(`/landlord/properties/${p.id}`); toast("Property deleted"); load(); }
    catch (e: any) { toast(e.message, true); }
  }
  async function delUnit(u: Unit) {
    if (!confirm(`Delete unit ${u.label}?`)) return;
    try { await api.del(`/landlord/units/${u.id}`); toast("Unit deleted"); load(); }
    catch (e: any) { toast(e.message, true); }
  }

  if (!props) return <Layout title="Properties"><Spinner /></Layout>;

  const vacantCount = props.reduce((s, p) => s + p.units.filter((u) => u.status === "VACANT").length, 0);

  return (
    <Layout
      title="Properties"
      subtitle={`${props.length} properties · ${vacantCount} vacant units`}
      actions={
        <>
          <button className={"btn btn-ghost btn-sm"} onClick={() => setOnlyVacant((v) => !v)}>
            {onlyVacant ? "Show all" : "Vacant only"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowProp(true)}>+ Property</button>
        </>
      }
    >
      {props.length === 0 && <EmptyState icon="🏢" title="No properties yet" hint="Add your first property to get started." />}

      <div className="stack">
        {props.map((p) => {
          const units = onlyVacant ? p.units.filter((u) => u.status === "VACANT") : p.units;
          if (onlyVacant && units.length === 0) return null;
          const occ = p.units.filter((u) => u.status === "OCCUPIED").length;
          return (
            <Card key={p.id}>
              <div className="card-hd">
                <div>
                  <h3>{p.name}</h3>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {p.address}, {p.city} · water {money(p.waterRatePerCbm)}/m³ · garbage {money(p.garbageFee)}
                  </div>
                </div>
                <div className="hstack">
                  <span className="badge badge-info"><span className="dot" />{occ}/{p.units.length} occupied</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setUnitFor(p)}>+ Unit</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => delProperty(p)}>🗑</button>
                </div>
              </div>
              <div className="card-pad">
                {units.length === 0 ? (
                  <div className="muted" style={{ fontSize: 13.5 }}>No units{onlyVacant ? " vacant" : ""} here yet.</div>
                ) : (
                  <div className="grid grid-3">
                    {units.map((u) => {
                      const sb = statusBadge(u.status);
                      const utils = [
                        u.hasWater && "Water",
                        u.hasGarbage && "Garbage",
                        u.hasElectricity && "Electricity",
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={u.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
                          <div className="hstack" style={{ justifyContent: "space-between" }}>
                            <b style={{ fontSize: 15 }}>Unit {u.label}</b>
                            <Badge cls={sb.cls} label={sb.label} />
                          </div>
                          <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>{UNIT_TYPE_LABELS[u.type]}</div>
                          <div style={{ fontWeight: 700, marginTop: 8 }}>{money(u.rent)}<span className="muted" style={{ fontWeight: 400, fontSize: 12 }}> /mo</span></div>
                          {u.tenancies[0] && <div style={{ fontSize: 12.5, marginTop: 4 }}>👤 {u.tenancies[0].renter.name}</div>}
                          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{utils || "No utilities"}</div>
                          {u.status === "VACANT" && (
                            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: "100%" }} onClick={() => delUnit(u)}>Delete unit</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {showProp && <PropertyModal onClose={() => setShowProp(false)} onSaved={() => { setShowProp(false); load(); toast("Property added"); }} />}
      {unitFor && <UnitModal property={unitFor} onClose={() => setUnitFor(null)} onSaved={() => { setUnitFor(null); load(); toast("Unit added"); }} />}
    </Layout>
  );
}

function PropertyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", address: "", city: "Nairobi", waterRatePerCbm: 150, garbageFee: 200 });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  async function save() {
    setBusy(true);
    try { await api.post("/landlord/properties", f); onSaved(); }
    catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title="Add property" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.name} onClick={save}>Save property</button></>}>
      <Field label="Property name"><input className="input" value={f.name} onChange={set("name")} placeholder="e.g. Riverside Court" /></Field>
      <Field label="Address"><input className="input" value={f.address} onChange={set("address")} /></Field>
      <div className="row">
        <Field label="City"><input className="input" value={f.city} onChange={set("city")} /></Field>
        <Field label="Water rate (KES/m³)"><input className="input" type="number" value={f.waterRatePerCbm} onChange={set("waterRatePerCbm")} /></Field>
      </div>
      <Field label="Default garbage fee (KES)"><input className="input" type="number" value={f.garbageFee} onChange={set("garbageFee")} /></Field>
    </Modal>
  );
}

function UnitModal({ property, onClose, onSaved }: { property: Property; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>({
    label: "", type: "STUDIO", rent: 0, deposit: 0,
    hasWater: true, hasGarbage: true, hasElectricity: false, electricityFlat: 0,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const toggle = (k: string) => setF({ ...f, [k]: !f[k] });
  async function save() {
    setBusy(true);
    try {
      await api.post(`/landlord/properties/${property.id}/units`, {
        ...f, rent: Number(f.rent), deposit: Number(f.deposit),
        electricityFlat: f.hasElectricity ? Number(f.electricityFlat) : null,
      });
      onSaved();
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Add unit — ${property.name}`} subtitle="Set rent and which utilities this unit is billed for." onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !f.label} onClick={save}>Save unit</button></>}>
      <div className="row">
        <Field label="Label"><input className="input" value={f.label} onChange={set("label")} placeholder="A1" /></Field>
        <Field label="Type">
          <select className="select" value={f.type} onChange={set("type")}>
            {UNIT_TYPES.map((t) => <option key={t} value={t}>{UNIT_TYPE_LABELS[t]}</option>)}
          </select>
        </Field>
      </div>
      <div className="row">
        <Field label="Monthly rent"><input className="input" type="number" value={f.rent} onChange={set("rent")} /></Field>
        <Field label="Deposit"><input className="input" type="number" value={f.deposit} onChange={set("deposit")} /></Field>
      </div>
      <Field label="Utilities billed">
        <div className="hstack" style={{ flexWrap: "wrap", gap: 8 }}>
          {[["hasWater", "💧 Water (metered)"], ["hasGarbage", "🗑 Garbage"], ["hasElectricity", "⚡ Electricity"]].map(([k, lbl]) => (
            <button key={k} type="button" onClick={() => toggle(k)}
              className={"badge " + (f[k] ? "badge-info" : "badge-muted")} style={{ cursor: "pointer", padding: "7px 12px" }}>
              {f[k] ? "✓ " : ""}{lbl}
            </button>
          ))}
        </div>
      </Field>
      {f.hasElectricity && (
        <Field label="Electricity flat charge (KES/mo)"><input className="input" type="number" value={f.electricityFlat} onChange={set("electricityFlat")} /></Field>
      )}
    </Modal>
  );
}
