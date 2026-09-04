/*
 * A storefront order.
 *
 * These types live outside lib/erp on purpose. An order is the one thing in
 * this system the storefront OWNS — the ERP owns stock, cost and profit, and a
 * customer's order only becomes ERP data (a `sale`, and therefore a stock
 * movement) once it is delivered and the cash is collected.
 *
 * Money is in whole taka. There are no paisa in this business, the ERP's
 * numeric(12,2) columns store integers in practice, and floats that reach a
 * total via 0.1 + 0.2 are worse than useless in an order confirmation.
 */

/*
 * Order matters: this is the order the checkout offers them in, and Pathao is
 * the courier this business uses. Steadfast is implemented too and is one env
 * var (COURIER_DEFAULT) away from being primary again.
 */
export const COURIERS = {
  pathao: "Pathao",
  steadfast: "Steadfast",
  redx: "RedX",
} as const;

export type CourierKey = keyof typeof COURIERS;

export const PAYMENT_METHODS = {
  cod: "Cash on delivery",
  manual_bkash: "bKash",
  manual_nagad: "Nagad",
  gateway: "Card or mobile banking",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export type PaymentState =
  | "due_on_delivery"
  | "advance_pending_verification"
  | "advance_verified"
  | "paid"
  | "refunded";

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "handed_to_courier"
  | "delivered"
  | "cancelled"
  | "returned";

export type OrderAddress = {
  /** Division NAME, not slug — this is what a courier reads. */
  division: string;
  district: string;
  area: string | null;
  /** House, road, block. The line the rider actually navigates by. */
  addressLine: string;
  landmark: string | null;
};

export type OrderDraftLine = {
  productId: string;
  /** Snapshotted so a later rename does not rewrite order history. */
  sku: string;
  name: string;
  qty: number;
  /** Re-read from the ERP at placement time. Never taken from the client. */
  unitPrice: number;
  isPreOrder: boolean;
};

export type OrderDraft = {
  customerName: string;
  /** Already normalised to 01XXXXXXXXX. */
  customerPhone: string;
  /** ISO timestamp of a completed OTP, or null if it was never done. */
  phoneVerifiedAt: string | null;
  address: OrderAddress;
  /** null = no preference, which is most orders. */
  courierPreference: CourierKey | null;
  paymentMethod: PaymentMethod;
  paymentState: PaymentState;
  lines: OrderDraftLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  /** subtotal + deliveryFee - discount. Checked again by the database. */
  total: number;
  /** Paid up front: 0 for plain COD, > 0 for a pre-order advance or deposit. */
  amountPaid: number;
  customerNote: string | null;
};

export type CreatedOrder = {
  id: string;
  /** HQ-01042. Human, sequential, read out over the phone. */
  reference: string;
  /**
   * What goes in the confirmation URL. The reference is sequential, so a URL
   * built from it would let anyone walk the numbers and read every customer's
   * name, phone and home address.
   */
  token: string;
};

export type OrderLine = Omit<OrderDraftLine, "productId">;

/** An order as the confirmation and tracking pages need it. */
export type StoreOrder = {
  /**
   * The row id. Server-side only — it is the key shipments hang off, and it is
   * never rendered. The customer-facing identifiers are `reference` (human,
   * sequential) and `token` (unguessable, for URLs).
   */
  id: string;
  reference: string;
  token: string;
  status: OrderStatus;
  placedAt: string;
  customerName: string;
  customerPhone: string;
  phoneVerified: boolean;
  address: OrderAddress;
  courierPreference: CourierKey | null;
  paymentMethod: PaymentMethod;
  paymentState: PaymentState;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  amountPaid: number;
  hasPreOrder: boolean;
  customerNote: string | null;
};

/** What is still to be collected at the door. */
export function amountDue(order: Pick<StoreOrder, "total" | "amountPaid">) {
  return Math.max(0, order.total - order.amountPaid);
}
