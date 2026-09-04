import type { CourierStatus } from "@/lib/courier/status";
import type { CourierKey } from "@/lib/orders/types";

/*
 * The seam between the storefront and whoever carries the parcel.
 *
 * Steadfast is implemented fully; Pathao and RedX are stubs behind this same
 * interface. That is not hedging — this business changes courier by area and
 * by whoever is answering the phone that week, and the storefront must not
 * have an opinion. Nothing outside lib/courier/ imports a provider directly.
 *
 * What every provider must do, and the only hard rule here: translate its own
 * status vocabulary into a CourierStatus. See lib/courier/status.ts.
 */

export type DeliveryType = "home" | "hub";

export type ShipmentRequest = {
  /** Our order reference (HQ-01042). Couriers call this the invoice. */
  reference: string;
  recipientName: string;
  /** Normalised 01XXXXXXXXX. Providers reformat if their API insists. */
  recipientPhone: string;
  /** One line, as the rider will read it. */
  recipientAddress: string;
  /** Taka to collect at the door. 0 for a fully prepaid parcel. */
  codAmount: number;
  note: string | null;
  deliveryType: DeliveryType;
  /** What is in the parcel, for the courier's manifest. */
  itemDescription: string | null;
  /** Number of physical parcels. Almost always 1 here. */
  totalLot: number;
};

export type CreatedShipment = {
  /** The courier's own id for the consignment. */
  consignmentId: string | null;
  /** What the customer can paste into the courier's tracking page. */
  trackingCode: string | null;
  status: CourierStatus;
  /** The courier's own status string, kept verbatim for the owner. */
  rawStatus: string | null;
};

/** How a shipment is identified when asking for an update. */
export type ShipmentRef = {
  consignmentId?: string | null;
  trackingCode?: string | null;
  /** Our reference. Useful when the courier lost our consignment id. */
  reference?: string | null;
};

export type TrackingSnapshot = {
  status: CourierStatus;
  rawStatus: string | null;
  /** When the courier says it last changed, if it says. */
  updatedAt: string | null;
};

/**
 * A phone number's delivery history, as the courier sees it.
 *
 * The anti-fraud control the brief asks for, normalised across providers so
 * "flag risky numbers" is one rule rather than three. Advisory by design: it
 * annotates an order for the owner, it never blocks one. A customer with two
 * cancelled parcels two years ago is not a fraudster, and a storefront that
 * silently refuses their order will never find out why it lost them.
 */
export type RiskProfile = {
  phone: string;
  totalParcels: number;
  delivered: number;
  cancelled: number;
  /** 0-100. Null when the courier gave counts but no ratio. */
  successRatio: number | null;
  /** Which courier's history this is. */
  source: CourierKey;
};

export type PriceQuote = {
  /** Taka. What the courier will bill us, not what we charge the customer. */
  fee: number;
};

export interface CourierProvider {
  readonly key: CourierKey;
  readonly label: string;
  /** False when its credentials are missing. Checked before it is offered. */
  readonly configured: boolean;

  createShipment(request: ShipmentRequest): Promise<CreatedShipment>;
  track(ref: ShipmentRef): Promise<TrackingSnapshot>;

  /** Map one of this courier's status strings onto our vocabulary. */
  normalise(raw: string): CourierStatus;

  /** Optional: what the courier will charge us. Not every API offers it. */
  priceQuote?(request: Pick<ShipmentRequest, "codAmount" | "deliveryType">): Promise<PriceQuote>;
  /** Optional: our prepaid balance with them, so a push cannot fail for it. */
  balance?(): Promise<number>;
  /** Optional: the recipient's delivery history. Advisory only. */
  riskCheck?(phone: string): Promise<RiskProfile | null>;
}

/*
 * Why a custom error class: a courier push has three genuinely different
 * failure modes and the caller must treat them differently.
 *
 *   retryable   — a timeout or a 5xx. Try again; nothing was created.
 *   !retryable  — a rejected address or a bad credential. Retrying spams them.
 *   uncertain   — the request may have created a consignment and we did not
 *                 hear back. NEVER retry blindly; two consignments means two
 *                 riders at one door and two delivery charges.
 */
export class CourierError extends Error {
  readonly courier: CourierKey;
  readonly retryable: boolean;
  readonly uncertain: boolean;
  readonly status: number | null;

  constructor(
    courier: CourierKey,
    message: string,
    options: { retryable?: boolean; uncertain?: boolean; status?: number | null } = {},
  ) {
    super(message);
    this.name = "CourierError";
    this.courier = courier;
    this.retryable = options.retryable ?? false;
    this.uncertain = options.uncertain ?? false;
    this.status = options.status ?? null;
  }
}

/** Thrown by a provider that exists as a seam but has no implementation yet. */
export class CourierNotImplemented extends CourierError {
  constructor(courier: CourierKey, what: string) {
    super(courier, `${courier}: ${what} is not implemented yet.`, {
      retryable: false,
    });
    this.name = "CourierNotImplemented";
  }
}
