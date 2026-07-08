// Shared constants (SQLite has no native enums, so we validate in-app).

export const ROLES = ["SUPERADMIN", "LANDLORD", "RENTER", "CARETAKER"] as const;
export type Role = (typeof ROLES)[number];

export const UNIT_TYPES = [
  "STUDIO",
  "SINGLE",
  "DOUBLE",
  "BR1",
  "BR2",
  "BR3",
  "BR4",
  "BR5",
  "BR6",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

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

export const INVOICE_STATUS = ["PENDING", "PARTIAL", "PAID", "OVERDUE"] as const;
export const TICKET_STATUS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
export const TICKET_CATEGORY = [
  "PLUMBING",
  "ELECTRICAL",
  "STRUCTURAL",
  "APPLIANCE",
  "GENERAL",
] as const;
export const TICKET_PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const NOTICE_STATUS = ["PENDING", "ACKNOWLEDGED", "COMPLETED"] as const;
export const EXPENSE_CATEGORY = [
  "MAINTENANCE",
  "UTILITY",
  "SALARY",
  "REPAIR",
  "OTHER",
] as const;
export const PAYMENT_METHOD = ["MPESA", "CASH", "BANK"] as const;
