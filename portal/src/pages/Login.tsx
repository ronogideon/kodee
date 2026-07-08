import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Card, LogoMark } from "../components/ui";

export function Login() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: any) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
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
        <div className="auth-sub">Property management, the organised way.</div>

        <Card className="card-pad">
          <div className="tabs" style={{ marginBottom: 18 }}>
            <button className={"tab" + (mode === "login" ? " active" : "")} onClick={() => setMode("login")}>
              Sign in
            </button>
            <button className={"tab" + (mode === "register" ? " active" : "")} onClick={() => setMode("register")}>
              New landlord
            </button>
          </div>

          <form onSubmit={submit}>
            {mode === "register" && (
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
              {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create landlord account"}
            </button>
          </form>

          {mode === "login" && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 14, textAlign: "center" }}>
              Demo — landlord@kodee.app · wanjiku@kodee.app · caretaker@kodee.app
              <br />
              password: kodee1234
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
