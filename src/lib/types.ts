export type OrderType = "walk_in" | "pre_order";

export type OrderStatus =
  | "pending_confirmation"
  | "confirmed"
  | "queued"
  | "preparing"
  | "ready"
  | "completed"
  | "rejected"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid";
export type PaymentMethod = "cash" | "manual_qris";
export type Role = "admin" | "cashier";

export type DayHours = {
  closed: boolean;
  open?: string;
  close?: string;
};

export type BusinessHours = Record<string, DayHours>;

export type StoreSettingsView = {
  storeName: string;
  timezone: string;
  businessHours: BusinessHours;
  slotIntervalMinutes: number;
  minPreorderMinutes: number;
  manualQrisEnabled: boolean;
};

export type ProductView = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  /** Optional cost/modal price per unit. Null means the admin has not filled it in. */
  costPrice: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
};

export type OrderItemView = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  /** Cost snapshot at order time. Null when the product had no cost price. */
  unitCost: number | null;
  subtotal: number;
};

export type OrderView = {
  id: string;
  code: string;
  /** Five-character customer-facing code. Only populated on staff pre-order views. */
  trackingCode: string | null;
  type: OrderType;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  pickupAt: string | null;
  totalAmount: number;
  createdAt: string;
  confirmedAt: string | null;
  queuedAt: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  queuePriority: boolean;
  /** Cashier who recorded the payment, when the order has been paid. */
  cashierName: string | null;
  items: OrderItemView[];
};

export type EmployeeView = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type DashboardMetrics = {
  revenue_today: number;
  paid_today: number;
  active_queue: number;
  pending_preorders: number;
  pickup_today: number;
};

export type BestSeller = {
  product_name: string;
  quantity: number;
  revenue: number;
};

export type SalesBucket = {
  bucket: string;
  revenue: number;
  profit: number;
  transactions: number;
};

export const DEFAULT_SETTINGS: StoreSettingsView = {
  storeName: "RotiPOS",
  timezone: "Asia/Jakarta",
  businessHours: {
    "0": { closed: false, open: "08:00", close: "20:00" },
    "1": { closed: false, open: "08:00", close: "20:00" },
    "2": { closed: false, open: "08:00", close: "20:00" },
    "3": { closed: false, open: "08:00", close: "20:00" },
    "4": { closed: false, open: "08:00", close: "20:00" },
    "5": { closed: false, open: "08:00", close: "20:00" },
    "6": { closed: false, open: "08:00", close: "20:00" },
  },
  slotIntervalMinutes: 30,
  minPreorderMinutes: 60,
  manualQrisEnabled: false,
};
