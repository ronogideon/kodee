import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Card, LogoMark } from "../components/ui";

type Tab = "tenant" | "landlord";

export function Login() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<Tab>("tenant");
  const [signup, setSignup] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  function switchTab(t: Tab) {
    setTab(t);
    setSignup(false);
    setErr("");
  }

  async function submit(e: any) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (signup) await register(form);
      else await login(form.email, form.password);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <LogoMark />
          Kodee
        </div>
        <div className="auth-sub">
          {tab === "tenant" ? "Your home, sorted — invoices, payments and requests." : "Property management, the organised way."}
        </div>

        <Card className="card-pad">
          <div className="tabs" style={{ marginBottom: 18 }}>
            <button className={"tab" + (tab === "tenant" ? " active" : "")} style={{ flex: 1 }} onClick={() => switchTab("tenant")}>
              Tenant / Caretaker
            </button>
            <button className={"tab" + (tab === "landlord" ? " active" : "")} style={{ flex: 1 }} onClick={() => switchTab("landlord")}>
              Landlord
            </button>
          </div>

          <form onSubmit={submit}>
            {signup && (
              <>
                <div className="field">
                  <label>Full name</label>
                  <input className="input" value={form.name} onChange={set("name")} required />
                </div>
                <div className="field">
                  <label>Phone</label>
                  <input className="input" value={form.phone} onChange={set("phone")} placeholder="+2547…" />
                </div>
              </>
            )}
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={set("email")} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={form.password} onChange={set("password")} required />
            </div>

            {err && (
              <div className="badge badge-danger" style={{ width: "100%", marginBottom: 12, padding: "8px 12px" }}>
                {err}
              </div>
            )}

            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Please wait…" : signup ? "Create landlord account" : "Sign in"}
            </button>
          </form>

          {tab === "tenant" && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 14, textAlign: "center" }}>
              Your landlord sets up your account — use the credentials they sent you.
            </div>
          )}

          {tab === "landlord" && (
            <div style={{ marginTop: 16, textAlign: "center", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
              {signup ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSignup(false)}>
                  ← Back to sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSignup(true)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--brand)", fontWeight: 700, fontSize: 14, fontFamily: "inherit" }}
                >
                  Start managing properties →
                </button>
              )}
            </div>
          )}
        </Card>
        <div className="powered" style={{ textAlign: "center", border: "none", color: "var(--muted)" }}>
          Powered by <b style={{ color: "var(--ink-2)" }}>Dartbit</b>
        </div>
      </div>
    </div>
  );
}
