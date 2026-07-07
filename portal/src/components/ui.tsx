import { ReactNode, createContext, useContext, useState, useCallback } from "react";

export function LogoMark({ sm }: { sm?: boolean }) {
  return <div className={"logo-mark" + (sm ? " sm" : "")}>K</div>;
}

export function Card({ children, className = "", ...rest }: any) {
  return (
    <div className={"card " + className} {...rest}>
      {children}
    </div>
  );
}

export function Badge({ status, cls, label }: { status?: string; cls?: string; label?: string }) {
  return (
    <span className={"badge " + (cls || "badge-muted")}>
      <span className="dot" />
      {label || status}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="modal-bd">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <div style={{ fontWeight: 600, color: "var(--ink-2)" }}>{title}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 13.5 }}>{hint}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="page-loading">
      <div className="spinner" />
    </div>
  );
}

/* Circular progress ring — the signature occupancy dial. */
export function CircularProgress({
  value,
  size = 132,
  stroke = 12,
  color = "var(--brand)",
  label,
  sub,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: size * 0.26, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {label ?? pct + "%"}
          </div>
          {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---- Toast ---- */
const ToastCtx = createContext<(msg: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const show = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <div className="toast-wrap">
          <div className={"toast" + (toast.err ? " err" : "")}>{toast.msg}</div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
