/*
 * The storefront's tables, as the ERP reads them.
 *
 * Hand-written rather than generated, matching the other types in this app.
 * Only the columns the ERP screens actually use — notably NOT the storefront's
 * courier webhook log or risk notes, which belong to the machinery.
 */
export type StorefrontOrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "handed_to_courier"
  | "delivered"
  | "cancelled"
  | "returned";

export type StorefrontPaymentState =
  | "due_on_delivery"
  | "advance_pending_verification"
  | "advance_verified"
  | "paid"
  | "refunded";

export type CourierStatus =
  | "pickup_scheduled"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cod_collected"
  | "on_hold"
  | "returned"
  | "lost"
  | "cancelled"
  | "unknown";

export type StorefrontOrderItem = {
  id: string;
  product_id: string;
  sku: string;
  name: string;
  qty: number;
  unit_price: number | string;
  is_pre_order: boolean;
};

export type StorefrontShipment = {
  id: string;
  courier: string;
  consignment_id: string | null;
  tracking_code: string | null;
  status: CourierStatus;
  raw_status: string | null;
  courier_fee: number | string | null;
  created_at: string;
  delivered_at: string | null;
};

export type StorefrontOrder = {
  id: string;
  reference: string;
  public_token: string;
  status: StorefrontOrderStatus;
  customer_name: string;
  customer_phone: string;
  phone_verified_at: string | null;
  division: string;
  district: string;
  area: string | null;
  address_line: string;
  landmark: string | null;
  courier_preference: string | null;
  payment_method: string;
  payment_state: StorefrontPaymentState;
  subtotal: number | string;
  delivery_fee: number | string;
  discount: number | string;
  total: number | string;
  amount_paid: number | string;
  has_pre_order: boolean;
  customer_note: string | null;
  risk_note: string | null;
  erp_sale_id: string | null;
  created_at: string;
  storefront_order_items?: StorefrontOrderItem[];
  storefront_shipments?: StorefrontShipment[];
};

export type StorefrontMessage = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  order_reference: string | null;
  message: string;
  handled_at: string | null;
  created_at: string;
};

/** Plain-language labels. The storefront has its own copy for customers. */
export const ORDER_STATUS_LABEL: Record<StorefrontOrderStatus, string> = {
  placed: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  handed_to_courier: "With courier",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

export const ORDER_STATUS_TONE: Record<
  StorefrontOrderStatus,
  "neutral" | "good" | "warn" | "bad"
> = {
  placed: "warn",
  confirmed: "neutral",
  packed: "neutral",
  handed_to_courier: "neutral",
  delivered: "good",
  cancelled: "bad",
  returned: "bad",
};

export const COURIER_STATUS_LABEL: Record<CourierStatus, string> = {
  pickup_scheduled: "Pickup scheduled",
  picked_up: "Picked up",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cod_collected: "Cash collected",
  on_hold: "On hold",
  returned: "Returned",
  lost: "Lost",
  cancelled: "Cancelled",
  unknown: "Unknown",
};

export const PAYMENT_STATE_LABEL: Record<StorefrontPaymentState, string> = {
  due_on_delivery: "Cash on delivery",
  advance_pending_verification: "Advance — needs checking",
  advance_verified: "Advance verified",
  paid: "Paid",
  refunded: "Refunded",
};

export function money(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0));
}
