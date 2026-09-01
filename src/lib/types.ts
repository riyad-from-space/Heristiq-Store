export type MovementType =
  | "purchase_in"
  | "sale_out"
  | "return_in"
  | "damage_out"
  | "adjustment";

export type SaleStatus =
  | "pending"
  | "confirmed"
  | "delivered"
  | "cancelled"
  | "returned";

export type SalesChannel =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "messenger"
  | "whatsapp"
  | "stall"
  | "other";

export const SALES_CHANNELS: SalesChannel[] = [
  "facebook", "instagram", "tiktok", "messenger", "whatsapp", "stall", "other",
];

export const SALE_STATUSES: SaleStatus[] = [
  "pending", "confirmed", "delivered", "cancelled", "returned",
];

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  purchase_in: "Purchase in",
  sale_out: "Sale out",
  return_in: "Return in",
  damage_out: "Damaged",
  adjustment: "Adjustment",
};

export type PreOrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "no price yet";

export const PRE_ORDER_STATUSES: PreOrderStatus[] = [
  "pending", "confirmed", "fulfilled", "cancelled",
];

export const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "partial", "paid"];

export type PreOrderRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  product_id: string | null;
  product_name: string | null;
  product_sku: string | null;
  item_note: string | null;
  qty: number;
  total_amount: number;
  amount_paid: number;
  amount_due: number;
  payment_status: PaymentStatus;
  converted_sale_id: string | null;
  order_date: string;
  expected_date: string | null;
  status: PreOrderStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ProductStockRow = {
  id: string;
  sku: string;
  name: string;
  is_active: boolean;
  selling_price: number;
  reorder_level: number;
  category: string | null;
  supplier: string | null;
  on_hand: number;
  avg_cost: number;
  stock_value: number;
  unit_margin: number;
  margin_pct: number | null;
  last_movement_at: string | null;
};

export type SaleProfitRow = {
  id: string;
  sale_date: string;
  channel: SalesChannel;
  status: SaleStatus;
  posted: boolean;
  customer_name: string | null;
  customer_phone: string | null;
  items_total: number;
  discount: number;
  product_revenue: number;
  cogs: number;
  delivery_charge: number;
  delivery_cost: number;
  net_delivery: number;
  gross_profit: number;
  units: number;
};

export type ProductPerformanceRow = {
  id: string;
  sku: string;
  name: string;
  on_hand: number;
  units_30d: number;
  units_90d: number;
  profit_30d: number;
  last_sold_on: string | null;
  avg_daily_units_30d: number;
  days_of_stock_left: number | null;
};

/**
 * PostgREST returns an embedded to-one relation as an object, but some versions
 * and some query shapes return a single-element array. Normalise to one or null.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
