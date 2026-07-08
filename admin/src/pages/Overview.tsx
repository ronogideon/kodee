import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { Card, CircularProgress, Spinner } from "../components/ui";
import { api } from "../lib/api";
import { money } from "../lib/format";

interface Dash {
  landlords: number;
  properties: number;
  units: number;
  occupied: number;
  occupancy: number;
  tenants: number;
  smsSent: number;
  smsRevenue: number;
  walletBalanceTotal: number;
  walletToppedUpTotal: number;
  walletSpentTotal: number;
  smsRatePerSms: number;
}

function Stat({ label, value, foot }: { label: string; value: any; foot?: string }) {
  return (
    <Card className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </Card>
  );
}

export function Overview() {
  const [d, setD] = useState<Dash | null>(null);
  useEffect(() => {
    api.get<Dash>("/superadmin/dashboard").then(setD);
  }, []);
  if (!d) return <Layout title="Overview"><Spinner /></Layout>;

  return (
    <Layout title="Overview" subtitle="Kodee platform at a glance">
      <div className="stack">
        <div className="grid grid-4">
          <Stat label="Landlords" value={d.landlords} foot="Accounts being serviced" />
          <Stat label="Properties" value={d.properties} foot={`${d.units} units total`} />
          <Stat label="Tenants" value={d.tenants} foot={`${d.occupied} occupied units`} />
          <Stat label="SMS sent" value={d.smsSent.toLocaleString()} foot={`${money(d.smsRevenue)} SMS revenue`} />
        </div>

        <div className="grid" style={{ gridTemplateColumns: "minmax(280px, 340px) 1fr" }}>
          <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ alignSelf: "flex-start", fontWeight: 700, marginBottom: 18 }}>Platform occupancy</div>
            <CircularProgress value={d.occupancy} size={150} stroke={14} sub={`${d.occupied}/${d.units} units`} />
          </Card>
          <Card>
            <div className="card-hd"><h3>SMS wallets</h3></div>
            <div className="card-pad">
              <div className="line"><span className="muted">Current balances (all landlords)</span><b>{money(d.walletBalanceTotal)}</b></div>
              <div className="line"><span className="muted">Lifetime topped up</span><b style={{ color: "var(--ok)" }}>{money(d.walletToppedUpTotal)}</b></div>
              <div className="line"><span className="muted">Lifetime spent on SMS</span><b>{money(d.walletSpentTotal)}</b></div>
              <div className="line"><span className="muted">Current rate</span><b>{money(d.smsRatePerSms)} / SMS</b></div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
