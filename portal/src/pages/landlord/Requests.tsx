import { useEffect, useState } from "react";
import { Layout } from "../../components/Layout";
import { Card, Badge, EmptyState, Spinner, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { date, statusBadge } from "../../lib/format";

interface Ticket {
  id: string; title: string; description: string; category: string; priority: string;
  status: string; createdAt: string; unit: { label: string }; tenancy: { renter: { name: string } };
}
interface Notice {
  id: string; moveOutDate: string; reason: string | null; status: string; createdAt: string;
  tenancy: { renter: { name: string }; unit: { label: string } };
}

const PRIORITY: Record<string, string> = { URGENT: "badge-danger", HIGH: "badge-warn", MEDIUM: "badge-info", LOW: "badge-muted" };

export function Requests() {
  const toast = useToast();
  const [tab, setTab] = useState<"tickets" | "notices">("tickets");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [notices, setNotices] = useState<Notice[] | null>(null);

  const load = () => {
    api.get<Ticket[]>("/landlord/tickets").then(setTickets);
    api.get<Notice[]>("/landlord/notices").then(setNotices);
  };
  useEffect(() => { load(); }, []);

  async function setTicket(id: string, status: string) {
    try { await api.patch(`/landlord/tickets/${id}`, { status }); toast("Updated"); load(); }
    catch (e: any) { toast(e.message, true); }
  }
  async function setNotice(id: string, status: string) {
    try { await api.patch(`/landlord/notices/${id}`, { status }); toast("Updated"); load(); }
    catch (e: any) { toast(e.message, true); }
  }

  if (!tickets || !notices) return <Layout title="Requests"><Spinner /></Layout>;
  const openCount = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;

  return (
    <Layout title="Requests" subtitle={`${openCount} open tickets · ${notices.filter((n) => n.status === "PENDING").length} pending notices`}>
      <div className="tabs" style={{ width: "fit-content", marginBottom: 16 }}>
        <button className={"tab" + (tab === "tickets" ? " active" : "")} onClick={() => setTab("tickets")}>Maintenance ({tickets.length})</button>
        <button className={"tab" + (tab === "notices" ? " active" : "")} onClick={() => setTab("notices")}>Notices ({notices.length})</button>
      </div>

      {tab === "tickets" ? (
        tickets.length === 0 ? <Card><EmptyState icon="🛠️" title="No maintenance requests" /></Card> : (
          <div className="grid grid-2">
            {tickets.map((t) => {
              const sb = statusBadge(t.status);
              return (
                <Card key={t.id} className="card-pad">
                  <div className="hstack" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <b style={{ fontSize: 15 }}>{t.title}</b>
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                        Unit {t.unit.label} · {t.tenancy.renter.name} · {date(t.createdAt)}
                      </div>
                    </div>
                    <Badge cls={PRIORITY[t.priority]} label={t.priority[0] + t.priority.slice(1).toLowerCase()} />
                  </div>
                  {t.description && <div style={{ fontSize: 13.5, marginTop: 10, color: "var(--ink-2)" }}>{t.description}</div>}
                  <div className="hstack" style={{ justifyContent: "space-between", marginTop: 14 }}>
                    <Badge cls={sb.cls} label={sb.label} />
                    <select className="select" style={{ width: "auto", padding: "6px 10px", fontSize: 13 }} value={t.status} onChange={(e) => setTicket(t.id, e.target.value)}>
                      <option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option>
                      <option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card>
          {notices.length === 0 ? <EmptyState icon="📤" title="No move-out notices" /> : (
            <table className="table">
              <thead><tr><th>Tenant</th><th>Unit</th><th>Move-out</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {notices.map((n) => {
                  const sb = statusBadge(n.status);
                  return (
                    <tr key={n.id}>
                      <td><b>{n.tenancy.renter.name}</b></td>
                      <td>{n.tenancy.unit.label}</td>
                      <td style={{ fontSize: 13 }}>{date(n.moveOutDate)}</td>
                      <td className="muted" style={{ fontSize: 13 }}>{n.reason || "—"}</td>
                      <td>
                        <select className="select" style={{ width: "auto", padding: "6px 10px", fontSize: 13 }} value={n.status} onChange={(e) => setNotice(n.id, e.target.value)}>
                          <option value="PENDING">Pending</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="COMPLETED">Completed</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </Layout>
  );
}
