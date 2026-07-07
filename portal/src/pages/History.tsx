import { useEffect, useState } from "react";
import { Card, Badge, EmptyState, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { money, statusBadge } from "../lib/format";

interface Invoice {
  id: string; period: string; total: number; amountPaid: number; status: string;
  rentAmount: number; waterAmount: number; garbageAmount: number; electricityAmount: number;
}

function periodLabel(p: string) {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-KE", { month: "long", year: "numeric" });
}

export function History() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => { api.get<Invoice[]>("/renter/invoices").then(setInvoices); }, []);
  if (!invoices) return <Spinner />;

  return (
    <div className="stack">
      <div style={{ fontWeight: 700, margin: "2px 2px 0" }}>Invoice history</div>
      {invoices.length === 0 ? (
        <Card className="card-pad"><EmptyState icon="📜" title="No invoices yet" /></Card>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {invoices.map((i) => {
            const sb = statusBadge(i.status);
            const parts = [
              `Rent ${money(i.rentAmount)}`,
              i.waterAmount > 0 && `Water ${money(i.waterAmount)}`,
              i.garbageAmount > 0 && `Garbage ${money(i.garbageAmount)}`,
              i.electricityAmount > 0 && `Elec ${money(i.electricityAmount)}`,
            ].filter(Boolean).join(" · ");
            return (
              <Card key={i.id} className="card-pad">
                <div className="hstack" style={{ justifyContent: "space-between" }}>
                  <b>{periodLabel(i.period)}</b>
                  <Badge cls={sb.cls} label={sb.label} />
                </div>
                <div className="hstack" style={{ justifyContent: "space-between", marginTop: 8 }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>{parts}</span>
                  <b>{money(i.total)}</b>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
