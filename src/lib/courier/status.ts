/*
 * One vocabulary for "where is my parcel", across every courier.
 *
 * This is the point of the whole courier layer. Steadfast says
 * `delivered_approval_pending`, Pathao says `Pickup_Requested`, RedX says
 * something else again, and none of that belongs on a customer's screen or in
 * a conditional anywhere else in this codebase. Providers map their own
 * vocabulary onto this one and nothing downstream knows which courier carried
 * the parcel.
 *
 * The brief's chain is
 *   pickup_scheduled → picked_up → in_transit → out_for_delivery → delivered
 *   → cod_collected, or returned / lost
 *
 * Three states are added to it, each because a courier genuinely reports it
 * and folding it into `unknown` would throw away something the owner needs:
 * `cancelled` (the order was killed before pickup), `on_hold` (Steadfast's
 * `hold` — the rider could not deliver and is holding the parcel, which is the
 * moment a phone call saves the sale) and `unknown` (a status string we do not
 * recognise, which must be visible rather than silently mapped to something
 * plausible).
 */
export const COURIER_STATUSES = [
  "pickup_scheduled",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cod_collected",
  "on_hold",
  "returned",
  "lost",
  "cancelled",
  "unknown",
] as const;

export type CourierStatus = (typeof COURIER_STATUSES)[number];

type StatusMeta = {
  /** What the customer reads. Plain, not courier jargon. */
  label: string;
  /** One line under it, in the customer's terms. */
  detail: string;
  /**
   * Position on the five-step progress rail, or null for anything off the
   * happy path. cod_collected shares step 5 with delivered: the parcel arrived
   * either way, and "we have been paid" is the owner's milestone, not the
   * customer's.
   */
  step: 1 | 2 | 3 | 4 | 5 | null;
  /** Nothing further will happen without a human. */
  terminal: boolean;
  tone: "neutral" | "progress" | "good" | "warn" | "bad";
};

export const STATUS_META: Record<CourierStatus, StatusMeta> = {
  pickup_scheduled: {
    label: "Pickup scheduled",
    detail: "The courier has the order and is coming to collect the parcel.",
    step: 1,
    terminal: false,
    tone: "neutral",
  },
  picked_up: {
    label: "Picked up",
    detail: "The parcel is with the courier.",
    step: 2,
    terminal: false,
    tone: "progress",
  },
  in_transit: {
    label: "On its way",
    detail: "Moving through the courier's network towards your area.",
    step: 3,
    terminal: false,
    tone: "progress",
  },
  out_for_delivery: {
    label: "Out for delivery",
    detail: "With a rider today. Keep your phone nearby and the cash ready.",
    step: 4,
    terminal: false,
    tone: "progress",
  },
  delivered: {
    label: "Delivered",
    detail: "Handed over. Thank you.",
    step: 5,
    terminal: true,
    tone: "good",
  },
  cod_collected: {
    label: "Delivered",
    /* Deliberately the same words as `delivered`. That the courier has settled
       the cash with us is our bookkeeping, not the customer's business. */
    detail: "Handed over and paid. Thank you.",
    step: 5,
    terminal: true,
    tone: "good",
  },
  on_hold: {
    label: "On hold",
    detail:
      "The rider could not complete the delivery and is holding the parcel. We will call you.",
    step: null,
    terminal: false,
    tone: "warn",
  },
  returned: {
    label: "Returned to us",
    detail: "The parcel came back. Message us and we will sort it out.",
    step: null,
    terminal: true,
    tone: "bad",
  },
  lost: {
    label: "Lost in transit",
    detail: "The courier cannot account for the parcel. We will make it right.",
    step: null,
    terminal: true,
    tone: "bad",
  },
  cancelled: {
    label: "Cancelled",
    detail: "This delivery was cancelled.",
    step: null,
    terminal: true,
    tone: "bad",
  },
  unknown: {
    label: "With the courier",
    /*
     * Shown when a provider reports something this codebase has never seen.
     * The customer gets an honest non-answer rather than a guess, and the raw
     * string is kept on the shipment row so the owner can see exactly what
     * arrived.
     */
    detail: "We are waiting for the courier's next update.",
    step: null,
    terminal: false,
    tone: "neutral",
  },
};

/** The five steps of the happy path, for the progress rail. */
export const STATUS_STEPS = [
  { step: 1, label: "Scheduled" },
  { step: 2, label: "Picked up" },
  { step: 3, label: "On its way" },
  { step: 4, label: "Out for delivery" },
  { step: 5, label: "Delivered" },
] as const;

export function isCourierStatus(value: string): value is CourierStatus {
  return (COURIER_STATUSES as readonly string[]).includes(value);
}

/**
 * True when this status means the parcel arrived, whatever the courier called
 * it. The one question asked in enough places to be worth a function.
 */
export function isDelivered(status: CourierStatus) {
  return status === "delivered" || status === "cod_collected";
}

/** True when the parcel is not coming — the RTO cases plus a cancellation. */
export function isFailed(status: CourierStatus) {
  return status === "returned" || status === "lost" || status === "cancelled";
}
