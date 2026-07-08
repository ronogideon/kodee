import { useState } from "react";
import { useAuth } from "../lib/auth";
import { Card, LogoMark } from "../components/ui";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: any) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
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
          Kodee <span style={{ fontSize: 13, fontWeight: 800, color: "var(--brand)" }}>ADMIN</span>
        </div>
        <div className="auth-sub">Superadmin console — manage serviced landlords</div>

        <Card className="card-pad">
          <form onSubmit={submit}>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {err && (
              <div className="badge badge-danger" style={{ width: "100%", marginBottom: 12, padding: "8px 12px" }}>
                {err}
              </div>
            )}
            <button className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Please wait…" : "Sign in"}
            </button>
          </form>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 14, textAlign: "center" }}>
            Demo: admin@kodee.app / kodee1234
          </div>
        </Card>
        <div className="powered" style={{ textAlign: "center", border: "none", color: "var(--muted)" }}>
          Powered by <b style={{ color: "var(--ink-2)" }}>Dartbit</b>
        </div>
      </div>
    </div>
  );
}
