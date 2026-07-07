import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Layout } from "../components/Layout";
import { Card, CircularProgress, Spinner, EmptyState } from "../components/ui";
import { api } from "../lib/api";
import { money, moneyShort, date } from "../lib/format";

interface Dash {
  period: string;
  periodLabel: string;
  kpis: {
    properties: number;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancy: number;
    potentialRent: number;
    billed: number;
    collected: number;
    outstanding: number;
    expensesThisMonth: number;
    netThisMonth: number;
    openTickets: number;
    pendingNotices: number;
  };
  statusBreakdown: Record<string, number>;
  trend: { period: string; label: string; collected: number }[];
  properties: {
    id: string;
    name: string;
    address: string;
    totalUnits: number;
    occupied: number;
    vacant: number;
    occupancy: number;
    rentRoll: number;
  }[];
  recentPayments: {
    id: string;
    amount: number;
    method: string;
    paidAt: string;
    renter: string;
    unit: string;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981",
  PARTIAL: "#f59e0b",
  PENDING: "#2563eb",
  OVERDUE: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  PENDING: "Pending",
  OVERDUE: "Overdue",
};

function Stat({ label, value, foot, icon, iconBg }: any) {
  return (
    <Card className="stat">
      {icon && (
        <div className="icon" style={{ background: iconBg }}>
          {icon}
        </div>
      )}
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </Card>
  );
}

export function Dashboard() {
  const [d, setD] = useState<Dash | null>(null);

  useEffect(() => {
    api.get<Dash>("/landlord/dashboard").then(setD).catch(() => setD(null));
  }, []);

  if (!d) return <Layout title="Dashboard"><Spinner /></Layout>;

  const collectionRate = d.kpis.billed ? Math.round((d.kpis.collected / d.kpis.billed) * 100) : 0;
  const pieData = Object.entries(d.statusBreakdown)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, key: k, value: v }));
  const totalInvoices = pieData.reduce((s, p) => s + p.value, 0);

  return (
    <Layout title="Dashboard" subtitle={`Overview for ${d.periodLabel}`}>
      <div className="stack">
        {/* KPI row */}
        <div className="grid grid-4">
          <Stat
            label="Collected this month"
            value={moneyShort(d.kpis.collected)}
            foot={`${collectionRate}% of ${moneyShort(d.kpis.billed)} billed`}
            icon="💰"
            iconBg="var(--ok-bg)"
          />
          <Stat
            label="Outstanding"
            value={moneyShort(d.kpis.outstanding)}
            foot={`${d.kpis.pendingNotices} notice${d.kpis.pendingNotices === 1 ? "" : "s"} pending`}
            icon="⏳"
            iconBg="var(--warn-bg)"
          />
          <Stat
            label="Expenses this month"
            value={moneyShort(d.kpis.expensesThisMonth)}
            foot={`Net ${moneyShort(d.kpis.netThisMonth)}`}
            icon="🧾"
            iconBg="var(--brand-50)"
          />
          <Stat
            label="Open requests"
            value={d.kpis.openTickets}
            foot="Maintenance tickets"
            icon="🛠️"
            iconBg="var(--danger-bg)"
          />
        </div>

        {/* Occupancy + revenue trend */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 340px) 1fr" }}>
          <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ alignSelf: "flex-start", fontWeight: 700, marginBottom: 4 }}>Total occupancy</div>
            <div className="muted" style={{ alignSelf: "flex-start", fontSize: 13, marginBottom: 18 }}>
              Across {d.kpis.properties} propert{d.kpis.properties === 1 ? "y" : "ies"}
            </div>
            <CircularProgress
              value={d.kpis.occupancy}
              size={168}
              stroke={15}
              sub={`${d.kpis.occupiedUnits}/${d.kpis.totalUnits} units`}
            />
            <div className="hstack" style={{ marginTop: 20, gap: 20 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "var(--ok)" }}>{d.kpis.occupiedUnits}</div>
                <div className="muted" style={{ fontSize: 12 }}>Occupied</div>
              </div>
              <div style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 20, color: "var(--muted)" }}>{d.kpis.vacantUnits}</div>
                <div className="muted" style={{ fontSize: 12 }}>Vacant</div>
              </div>
              <div style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 20 }}>{moneyShort(d.kpis.potentialRent)}</div>
                <div className="muted" style={{ fontSize: 12 }}>Rent roll</div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="card-hd">
              <h3>Collections — last 6 months</h3>
            </div>
            <div className="card-pad" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.trend} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis
                    tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : "" + v)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    width={38}
                  />
                  <Tooltip
                    formatter={(v: any) => money(v)}
                    cursor={{ fill: "rgba(37,99,235,0.06)" }}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e6ebf2", fontSize: 13 }}
                  />
                  <Bar dataKey="collected" radius={[8, 8, 0, 0]} fill="var(--brand)" maxBarSize={46} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Payment status + recent payments */}
        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 360px) 1fr" }}>
          <Card>
            <div className="card-hd">
              <h3>{d.periodLabel} invoices</h3>
            </div>
            <div className="card-pad">
              {totalInvoices === 0 ? (
                <EmptyState icon="🧾" title="No invoices yet" hint="Generate them from Payments." />
              ) : (
                <div className="hstack" style={{ gap: 18 }}>
                  <div style={{ width: 130, height: 130, position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2}>
                          {pieData.map((e) => (
                            <Cell key={e.key} fill={STATUS_COLORS[e.key]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 20 }}>{totalInvoices}</div>
                        <div className="muted" style={{ fontSize: 11 }}>invoices</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    {pieData.map((e) => (
                      <div key={e.key} className="hstack" style={{ justifyContent: "space-between", padding: "5px 0" }}>
                        <div className="hstack" style={{ gap: 8 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: STATUS_COLORS[e.key] }} />
                          <span style={{ fontSize: 13.5 }}>{e.name}</span>
                        </div>
                        <b style={{ fontSize: 13.5 }}>{e.value}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="card-hd">
              <h3>Recent payments</h3>
            </div>
            {d.recentPayments.length === 0 ? (
              <EmptyState icon="💳" title="No payments recorded yet" />
            ) : (
              <table className="table">
                <tbody>
                  {d.recentPayments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <b>{p.renter}</b>
                        <div className="muted" style={{ fontSize: 12.5 }}>
                          Unit {p.unit} · {p.method}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <b style={{ color: "var(--ok)" }}>{money(p.amount)}</b>
                        <div className="muted" style={{ fontSize: 12.5 }}>{date(p.paidAt)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Property cards — organised identically for quick scanning */}
        <div>
          <h3 style={{ margin: "6px 2px 12px" }}>Properties</h3>
          <div className="grid grid-3">
            {d.properties.map((p) => (
              <Card key={p.id} className="card-pad">
                <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{p.address}</div>
                  </div>
                  <CircularProgress
                    value={p.occupancy}
                    size={62}
                    stroke={7}
                    color={p.occupancy >= 80 ? "var(--ok)" : p.occupancy >= 50 ? "var(--brand)" : "var(--warn)"}
                  />
                </div>
                <div className="hstack" style={{ marginTop: 16, gap: 0, justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.occupied}/{p.totalUnits}</div>
                    <div className="muted" style={{ fontSize: 12 }}>occupied</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: p.vacant ? "var(--warn)" : "var(--muted)" }}>{p.vacant}</div>
                    <div className="muted" style={{ fontSize: 12 }}>vacant</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700 }}>{moneyShort(p.rentRoll)}</div>
                    <div className="muted" style={{ fontSize: 12 }}>rent roll</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
