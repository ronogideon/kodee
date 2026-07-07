import { ReactNode, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogoMark } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: "▦", end: true },
  { to: "/properties", label: "Properties", icon: "🏢" },
  { to: "/tenants", label: "Tenants", icon: "👥" },
  { to: "/payments", label: "Payments", icon: "💳" },
  { to: "/expenses", label: "Expenses", icon: "🧾" },
  { to: "/requests", label: "Requests", icon: "🛠️" },
  { to: "/team", label: "Team", icon: "🔑" },
];

export function Layout({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={"sidebar" + (open ? " open" : "")}>
        <div className="brand">
          <LogoMark />
          Kodee
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => "navlink" + (isActive ? " active" : "")}
              onClick={() => setOpen(false)}
            >
              <span style={{ width: 20, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="powered">
          Powered by <b>Dartbit</b>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button className="btn btn-ghost btn-sm menu-btn" onClick={() => setOpen(true)}>
            ☰
          </button>
          <div>
            <h1>{title}</h1>
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          <div className="spacer" />
          {actions}
          <div
            className="hstack"
            style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14, marginLeft: 4 }}
          >
            <div style={{ textAlign: "right", lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.name}</div>
              <div className="sub">Landlord</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">
              ⏻
            </button>
          </div>
        </div>
        <div className="content" key={loc.pathname}>
          {children}
        </div>
      </div>
    </div>
  );
}
