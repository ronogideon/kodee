import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { LogoMark } from "./ui";

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isCaretaker = user?.role === "CARETAKER";

  const nav = isCaretaker
    ? [{ to: "/", label: "Readings", icon: "💧", end: true }]
    : [
        { to: "/", label: "Home", icon: "🏠", end: true },
        { to: "/requests", label: "Requests", icon: "🛠️" },
        { to: "/history", label: "History", icon: "📜" },
      ];

  return (
    <div className="portal">
      <div className="portal-top">
        <div className="brand">
          <LogoMark sm />
          Kodee
        </div>
        <div className="spacer" />
        <div style={{ textAlign: "right", lineHeight: 1.2 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{user?.name}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{isCaretaker ? "Caretaker" : "Tenant"}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} title="Sign out">⏻</button>
      </div>

      <div className="portal-body">{children}</div>

      <nav className="portal-nav">
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <span className="ico">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
        <div style={{ position: "absolute", top: -22, left: 0, right: 0, textAlign: "center", fontSize: 10.5, color: "var(--muted)" }}>
          Powered by <b style={{ color: "var(--ink-2)" }}>Dartbit</b>
        </div>
      </nav>
    </div>
  );
}
