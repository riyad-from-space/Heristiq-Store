import { z } from "zod";
import { MAX_QTY } from "@/lib/cart/types";
import { findDistrict } from "@/lib/bd-geo";
import { normalisePhone } from "@/lib/phone";
import { COURIERS } from "@/lib/orders/types";

/*
 * What the checkout form is allowed to submit.
 *
 * Note what is NOT in here: prices, the subtotal, the delivery fee, the total.
 * Every one of those is computed on the server from the ERP's own numbers in
 * lib/orders/place.ts. A schema that accepted a total would be a schema that
 * let a customer name their own — and no amount of validating the shape of a
 * number makes it the right number.
 *
 * `lines` carries productId and qty and nothing else, for the same reason.
 */
export const CHECKOUT_LIMITS = {
  name: 80,
  area: 80,
  addressLine: 300,
  landmark: 120,
  note: 500,
  /* Twenty distinct pieces in one order is already an event stall, not a
     customer. The cap exists so a hand-built payload cannot ask for 10,000
     ERP reads. */
  lines: 20,
} as const;

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .default(null);

export const checkoutSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Please give us a name for the parcel.")
      .max(CHECKOUT_LIMITS.name),

    /* Normalised here rather than validated here, so everything downstream —
       the OTP check, the order row, the ERP's own search — sees 01XXXXXXXXX. */
    phone: z
      .string()
      .transform((value) => normalisePhone(value))
      .refine((value): value is string => value !== null, {
        message: "That does not look like a Bangladeshi mobile number.",
      }),

    divisionId: z.string().min(1, "Choose a division."),
    districtId: z.string().min(1, "Choose a district."),
    /* Free text on purpose: the area list is autocomplete, not a constraint.
       See lib/bd-geo.ts. */
    area: trimmedOptional(CHECKOUT_LIMITS.area),

    addressLine: z
      .string()
      .trim()
      .min(10, "We need a house and road the rider can find.")
      .max(CHECKOUT_LIMITS.addressLine),
    landmark: trimmedOptional(CHECKOUT_LIMITS.landmark),

    courier: z.enum(Object.keys(COURIERS) as [keyof typeof COURIERS]).nullable().default(null),

    /*
     * Cash on delivery, or a manual mobile-money advance.
     *
     * "Manual" is the honest word: the customer sends money in their own bKash
     * or Nagad app and types the transaction id here. Nothing verifies it —
     * doing so needs a merchant API this business does not have — so the order
     * is marked "advance pending verification" and the owner checks their own
     * app before shipping. A gateway would slot in as a fourth value here.
     */
    paymentMethod: z
      .enum(["cod", "manual_bkash", "manual_nagad"])
      .default("cod"),

    /* Required for the manual methods; the refine below enforces that. */
    trxId: trimmedOptional(40),
    senderPhone: trimmedOptional(24),

    note: trimmedOptional(CHECKOUT_LIMITS.note),

    lines: z
      .array(
        z.object({
          productId: z.string().min(1).max(64),
          qty: z.number().int().min(1).max(MAX_QTY),
        }),
      )
      .min(1, "Your cart is empty.")
      .max(CHECKOUT_LIMITS.lines),
  })
  /* A district from a different division would produce a plausible order with
     an address that does not exist. */
  .refine(
    (value) => {
      const district = findDistrict(value.districtId);
      return district !== null && district.divisionId === value.divisionId;
    },
    { path: ["districtId"], message: "Choose a district in that division." },
  )
  /*
   * A mobile-money advance without proof is not an advance.
   *
   * Both halves are needed to find the payment: the transaction id identifies
   * it, and the sending number is what the owner actually searches their app
   * by when the customer mistypes the id — which they do.
   */
  .refine(
    (value) =>
      value.paymentMethod === "cod" ||
      (value.trxId !== null && value.senderPhone !== null),
    {
      path: ["trxId"],
      message: "Enter the transaction ID and the number you sent it from.",
    },
  )
  /* One product per order, not the same product on three lines. Otherwise the
     stock check passes three times against the same units. */
  .refine(
    (value) =>
      new Set(value.lines.map((line) => line.productId)).size ===
      value.lines.length,
    { path: ["lines"], message: "That cart has a duplicated line." },
  );

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutPayload = z.output<typeof checkoutSchema>;
