import "server-only";
import { findDistrict, findDivision, isInsideDhaka } from "@/lib/bd-geo";
import { deliveryFeeFor } from "@/lib/delivery";
import { deliveryTerms } from "@/lib/delivery.server";
import { erp } from "@/lib/erp";
import { verifiedPhone } from "@/lib/otp/session";
import { checkoutSchema, type CheckoutInput } from "@/lib/orders/schema";
import type { OrderDraftLine } from "@/lib/orders/types";
import { taka } from "@/lib/format";

/*
 * Placing an order.
 *
 * The rule this file exists to enforce: NOTHING about money comes from the
 * browser. The payload carries product ids, quantities and an address. Prices
 * are re-read from the ERP, the delivery fee is recomputed from the district,
 * and the total is derived — then checked a second time by a CHECK constraint
 * in the database.
 *
 * The order of operations matters, and it is cheapest-and-most-likely-to-fail
 * first: shape, then the verified phone, then the ERP reads. There is no point
 * spending a database round trip on a payload with no address.
 */

export type LineProblem = {
  productId: string;
  name: string;
  problem: string;
};

export type PlaceOrderResult =
  | { ok: true; reference: string; token: string; demo: boolean }
  | {
      ok: false;
      error: string;
      /** Per-field messages, keyed by the form field name. */
      fieldErrors?: Record<string, string>;
      /** Lines the customer has to fix before this can go through. */
      lineProblems?: LineProblem[];
      /** True when the phone needs (re-)verifying before this can go through. */
      needsVerification?: boolean;
    };

export async function placeOrder(
  input: CheckoutInput,
): Promise<PlaceOrderResult> {
  const parsed = checkoutSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return {
      ok: false,
      error: "Some details need fixing.",
      fieldErrors,
    };
  }

  const payload = parsed.data;

  const division = findDivision(payload.divisionId);
  const district = findDistrict(payload.districtId);
  if (!division || !district) {
    return {
      ok: false,
      error: "We could not place that address. Choose the division and district again.",
    };
  }

  /*
   * The phone that answered an SMS must be the phone on the order.
   *
   * Checking the cookie is present is not enough: verifying your own number
   * and then submitting a stranger's is the obvious bypass, and it is the one
   * that produces the undeliverable COD parcels this control exists to stop.
   */
  const verified = await verifiedPhone();
  if (verified !== payload.phone) {
    return {
      ok: false,
      error: verified
        ? "That number has not been verified. Send a code to the number you want the parcel delivered to."
        : "Please verify your phone number first.",
      needsVerification: true,
    };
  }

  const client = erp();
  const productIds = payload.lines.map((line) => line.productId);

  const [products, stock] = await Promise.all([
    client.getProductsByIds(productIds),
    client.getStock(productIds),
  ]);

  const productById = new Map(products.map((product) => [product.id, product]));
  const availableById = new Map(
    stock.map((level) => [level.productId, level.available]),
  );

  const problems: LineProblem[] = [];
  const lines: OrderDraftLine[] = [];

  for (const line of payload.lines) {
    const product = productById.get(line.productId);

    if (!product) {
      problems.push({
        productId: line.productId,
        name: "One of your pieces",
        problem: "is no longer in the collection. Remove it to continue.",
      });
      continue;
    }

    if (product.availability.state === "unavailable") {
      problems.push({
        productId: line.productId,
        name: product.name,
        problem: "is no longer available. Remove it to continue.",
      });
      continue;
    }

    /*
     * The price on the ERP right now, never the snapshot the cart carried.
     * A cart can sit in localStorage for a week; a piece that got repriced or
     * un-priced in that week must not be sold at the old number.
     */
    if (product.price === null) {
      problems.push({
        productId: line.productId,
        name: product.name,
        problem:
          "is not priced yet. Remove it and message us — we will confirm the price.",
      });
      continue;
    }

    const available = availableById.get(line.productId) ?? 0;

    /* Sold out is not an error. It is a pre-order, and the flag is recomputed
       here rather than trusted from the cart, which may have been filled while
       the piece was still in stock. */
    const isPreOrder = available <= 0;

    if (!isPreOrder && line.qty > available) {
      problems.push({
        productId: line.productId,
        name: product.name,
        problem:
          available === 1
            ? "has only one left. Reduce the quantity to continue."
            : `has only ${available} left. Reduce the quantity to continue.`,
      });
      continue;
    }

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      qty: line.qty,
      unitPrice: product.price,
      isPreOrder,
    });
  }

  if (problems.length > 0) {
    return {
      ok: false,
      error:
        problems.length === 1
          ? "One piece in your cart needs attention."
          : "Some pieces in your cart need attention.",
      lineProblems: problems,
    };
  }

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.qty,
    0,
  );
  const terms = deliveryTerms();
  const deliveryFee = deliveryFeeFor(subtotal, isInsideDhaka(district.id), terms);
  const total = subtotal + deliveryFee;

  /*
   * Phase 3 is COD only, so nothing is paid up front and the whole total is
   * collected at the door. Phase 5 adds the pre-order advance and the optional
   * COD deposit, both of which move amountPaid above zero and change
   * paymentState — which is why those are fields rather than constants.
   */
  const created = await client.createOrder({
    customerName: payload.name,
    customerPhone: payload.phone,
    phoneVerifiedAt: new Date().toISOString(),
    address: {
      division: division.name,
      district: district.name,
      area: payload.area,
      addressLine: payload.addressLine,
      landmark: payload.landmark,
    },
    courierPreference: payload.courier,
    paymentMethod: "cod",
    paymentState: "due_on_delivery",
    lines,
    subtotal,
    deliveryFee,
    discount: 0,
    total,
    amountPaid: 0,
    customerNote: buildNote(payload.note, lines, total),
  });

  return {
    ok: true,
    reference: created.reference,
    token: created.token,
    /* The confirmation page says so out loud. See app/order/[token]. */
    demo: client.source === "mock",
  };
}

/**
 * The customer's note, plus what the owner needs to read before packing.
 *
 * A pre-order in the parcel changes what happens next — part of it ships later,
 * and an advance has to be agreed — so it is stated at the top of the note
 * rather than left to be inferred from a per-line flag on a phone screen.
 */
function buildNote(
  note: string | null,
  lines: OrderDraftLine[],
  total: number,
): string | null {
  const preOrders = lines.filter((line) => line.isPreOrder);
  if (preOrders.length === 0) return note;

  const heading =
    `PRE-ORDER: ${preOrders.map((line) => line.sku).join(", ")} ` +
    `— confirm restock date and advance before shipping. COD total ${taka(total)}.`;

  return note ? `${heading}\n\n${note}` : heading;
}
