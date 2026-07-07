export const UNIT_TYPE_LABELS: Record<string, string> = {
  STUDIO: "Studio",
  SINGLE: "Single room",
  DOUBLE: "Double room",
  BR1: "1 Bedroom",
  BR2: "2 Bedroom",
  BR3: "3 Bedroom",
  BR4: "4 Bedroom",
  BR5: "5 Bedroom",
  BR6: "6 Bedroom",
};

export const UNIT_TYPES = Object.keys(UNIT_TYPE_LABELS);

export function money(n: number): string {
  return "KES " + Math.round(n || 0).toLocaleString("en-KE");
}
export function moneyShort(n: number): string {
  if (n >= 1_000_000) return "KES " + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "KES " + (n / 1_000).toFixed(n >= 100_000 ? 0 : 1) + "K";
  return "KES " + Math.round(n || 0).toLocaleString("en-KE");
}
export function date(d: string | Date): string {
  return new Date(d).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function statusBadge(status: string): { cls: string; label: string } {
  const map: Record<string, { cls: string; label: string }> = {
    PAID: { cls: "badge-ok", label: "Paid" },
    PARTIAL: { cls: "badge-warn", label: "Partial" },
    PENDING: { cls: "badge-info", label: "Pending" },
    OVERDUE: { cls: "badge-danger", label: "Overdue" },
    OPEN: { cls: "badge-warn", label: "Open" },
    IN_PROGRESS: { cls: "badge-info", label: "In progress" },
    RESOLVED: { cls: "badge-ok", label: "Resolved" },
    CLOSED: { cls: "badge-muted", label: "Closed" },
    ACKNOWLEDGED: { cls: "badge-info", label: "Acknowledged" },
    COMPLETED: { cls: "badge-muted", label: "Completed" },
    VACANT: { cls: "badge-muted", label: "Vacant" },
    OCCUPIED: { cls: "badge-ok", label: "Occupied" },
  };
  return map[status] || { cls: "badge-muted", label: status };
}
