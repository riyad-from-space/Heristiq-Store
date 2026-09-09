import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dateTime, money as fmt } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Badge, Card, LinkButton, Table, Td } from "@/components/ui";
import {
  COURIER_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATE_LABEL,
  type StorefrontOrder,
} from "@/lib/store-types";
import { setOrderStatus, verifyAdvance, rejectAdvance, recordSale } from "../actions";
import { PushToCourierButton } from "./order-actions";

/*
 * One storefront order, and everything the owner does to it.
 *
 * Ordered by what happens in real life: check who it is and whether the phone
 * was verified, confirm it, check any advance actually arrived, send it to a
 * courier, then follow it. The audit trail sits at the bottom because it is
 * only read when something has gone wrong.
 */
export const dynamic = "force-dynamic";

const COURIERS = [
  { key: "pathao", label: "Pathao" },
  { key: "steadfast", label: "Steadfast" },
  { key: "redx", label: "RedX" },
];

/* What can follow what. Keeps the owner from having to think about it. */
const NEXT_STATUS: Record<string, { to: string; label: string }[]> = {
  placed: [
    { to: "confirmed", label: "Confirm" },
    { to: "cancelled", label: "Cancel" },
  ],
  confirmed: [
    { to: "packed", label: "Mark packed" },
    { to: "cancelled", label: "Cancel" },
  ],
  packed: [{ to: "handed_to_courier", label: "Mark handed over" }],
  handed_to_courier: [
    { to: "delivered", label: "Mark delivered" },
    { to: "returned", label: "Mark returned" },
  ],
  delivered: [{ to: "returned", label: "Mark returned" }],
  cancelled: [{ to: "placed", label: "Reopen" }],
  returned: [{ to: "placed", label: "Reopen" }],
};

export default async function OrderPage({
  params,
  searchParams: searchParamsPromise,
}: PageProps<"/orders/[id]">) {
  const { id } = await params;
  /* recordSale redirects back here with ?error= when the database refuses —
     see the note on that action. */
  const searchParams = await searchParamsPromise;
  const errorMessage =
    typeof searchParams?.error === "string" ? searchParams.error : null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("storefront_orders")
    .select("*, storefront_order_items ( * ), storefront_shipments ( * )")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const order = data as unknown as StorefrontOrder;

  /*
   * Has this order already been recorded as a sale?
   *
   * Read rather than inferred from the order's own status: the link lives on
   * sales.storefront_order_id (unique), so this is the single source of truth
   * for "already done" and it cannot drift from what the RPC would allow.
   */
  const { data: sale } = await supabase
    .from("sales")
    .select("id, posted")
    .eq("storefront_order_id", id)
    .maybeSingle();

  const { data: events } = await supabase
    .from("storefront_order_events")
    .select("id, at, kind, detail")
    .eq("order_id", id)
    .order("at", { ascending: false })
    .limit(30);

  const items = order.storefront_order_items ?? [];
  const shipment = (order.storefront_shipments ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const total = Math.round(Number(order.total));
  const paid = Math.round(Number(order.amount_paid));
  const due = Math.max(0, total - paid);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              {order.reference}
            </h1>
            <Badge tone={ORDER_STATUS_TONE[order.status]}>
              {ORDER_STATUS_LABEL[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            Placed {dateTime(order.created_at)}
          </p>
        </div>
        <LinkButton href="/orders" tone="ghost">
          All orders
        </LinkButton>
      </div>

      {order.risk_note && (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Worth a call before shipping
          </p>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {order.risk_note}
          </p>
        </Card>
      )}

      {!order.phone_verified_at && (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            This phone number was never verified by SMS. Worth a call before
            shipping.
          </p>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <Card>
            <h2 className="text-sm font-semibold">Items</h2>
            <Table head={["Piece", "Qty", "Each", "Line"]}>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <Td>
                    {item.name}
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {item.sku}
                      {item.is_pre_order && " · pre-order"}
                    </span>
                  </Td>
                  <Td className="tabular-nums">{item.qty}</Td>
                  <Td className="tabular-nums">{fmt(item.unit_price)}</Td>
                  <Td className="tabular-nums">
                    {fmt(Number(item.unit_price) * item.qty)}
                  </Td>
                </tr>
              ))}
            </Table>
            <dl className="mt-4 space-y-1.5 border-t border-neutral-100 pt-4 text-sm dark:border-neutral-800">
              <Row label="Subtotal" value={fmt(order.subtotal)} />
              <Row label="Delivery" value={fmt(order.delivery_fee)} />
              {Number(order.discount) > 0 && (
                <Row label="Discount" value={"−" + fmt(order.discount)} />
              )}
              <Row label="Total" value={fmt(total)} strong />
              {paid > 0 && (
                <Row label="Paid in advance" value={"−" + fmt(paid)} />
              )}
              <Row label="To collect" value={fmt(due)} strong />
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Deliver to</h2>
            <p className="mt-2 text-sm leading-relaxed">
              {order.customer_name}
              <br />
              {order.address_line}
              {order.landmark && <> ({order.landmark})</>}
              <br />
              {[order.area, order.district, order.division]
                .filter(Boolean)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(", ")}
              <br />
              <a
                href={"tel:+88" + order.customer_phone}
                className="hover:underline"
              >
                {displayPhone(order.customer_phone)}
              </a>
            </p>
            {order.customer_note && (
              <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {order.customer_note}
              </p>
            )}
          </Card>

          {events && events.length > 0 && (
            <Card>
              <h2 className="text-sm font-semibold">History</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {events.map((event) => (
                  <li
                    key={String(event.id)}
                    className="flex justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 dark:border-neutral-800"
                  >
                    <span>
                      {String(event.kind).replace(/_/g, " ")}
                      <span className="ml-2 text-xs text-neutral-500">
                        {summarise(event.detail)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {dateTime(String(event.at))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/*
            * The accounting step, above "Next step" once it is due: recording the
            * sale is what makes the reports true, and burying it under the status
            * buttons is how it gets forgotten.
            */}
          {order.status === "delivered" && (
            <Card>
              <h2 className="text-sm font-semibold">Accounting</h2>
              {sale ? (
                <p className="mt-2 text-sm text-neutral-500">
                  Recorded as a sale
                  {sale.posted ? " and posted to stock" : " (not yet posted)"}.{" "}
                  <a
                    href={`/sales/${sale.id}`}
                    className="underline underline-offset-4"
                  >
                    Open the sale
                  </a>{" "}
                  and add what the courier charged you, so the margin is right.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                    This order is not in your sales, stock or profit figures yet.
                    Recording it creates the sale and moves the stock — do it once
                    the cash is actually in hand.
                  </p>
                  {errorMessage && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      {errorMessage}
                    </p>
                  )}
                  <form action={recordSale} className="mt-3">
                    <input type="hidden" name="id" value={order.id} />
                    <button className="min-h-10 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                      Record as sale
                    </button>
                  </form>
                </>
              )}
            </Card>
          )}
          <Card>
            <h2 className="text-sm font-semibold">Next step</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(NEXT_STATUS[order.status] ?? []).map((step) => (
                <form key={step.to} action={setOrderStatus}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value={step.to} />
                  <button className="min-h-10 rounded-lg border border-neutral-200 px-3 text-sm font-medium transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800">
                    {step.label}
                  </button>
                </form>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Payment</h2>
            <p className="mt-2 text-sm text-neutral-500">
              {PAYMENT_STATE_LABEL[order.payment_state] ?? order.payment_state}
            </p>
            {order.payment_state === "advance_pending_verification" && (
              <div className="mt-3 space-y-2">
                <p className="text-xs leading-relaxed text-neutral-500">
                  Check your bKash or Nagad app for the transaction the customer
                  gave, then confirm what actually arrived.
                </p>
                <form action={verifyAdvance} className="flex gap-2">
                  <input type="hidden" name="id" value={order.id} />
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    defaultValue={paid || ""}
                    placeholder="Amount"
                    aria-label="Amount received"
                    className="min-h-10 w-24 rounded-lg border border-neutral-200 px-2 text-sm dark:border-neutral-800 dark:bg-neutral-900"
                  />
                  <button className="min-h-10 flex-1 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                    Confirm received
                  </button>
                </form>
                <form action={rejectAdvance}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="text-xs text-neutral-500 hover:underline">
                    Nothing arrived — switch to full cash on delivery
                  </button>
                </form>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-sm font-semibold">Courier</h2>
            {shipment ? (
              <div className="mt-2 text-sm">
                <p className="font-medium capitalize">{shipment.courier}</p>
                <p className="mt-1 text-neutral-500">
                  {COURIER_STATUS_LABEL[shipment.status] ?? shipment.status}
                </p>
                {shipment.tracking_code && (
                  <p className="mt-1 font-mono text-xs text-neutral-500">
                    {shipment.tracking_code}
                  </p>
                )}
                {shipment.courier_fee != null && (
                  <p className="mt-1 text-xs text-neutral-500">
                    Courier charge {fmt(shipment.courier_fee)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-3 text-xs leading-relaxed text-neutral-500">
                  Sends the address and {fmt(due)} to collect. Only ever once
                  — a second push means two riders and two delivery charges.
                </p>
                <PushToCourierButton
                  reference={order.reference}
                  couriers={COURIERS}
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? "font-medium" : "text-neutral-500"}>{label}</dt>
      <dd className={"tabular-nums " + (strong ? "font-medium" : "")}>{value}</dd>
    </div>
  );
}

/** One readable line from an event's detail blob. */
function summarise(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const d = detail as Record<string, unknown>;
  if (d.from && d.to) return String(d.from) + " → " + String(d.to);
  if (d.to) return String(d.to);
  if (d.amount) return "৳" + String(d.amount);
  if (d.lines) return String(d.lines) + " line(s)";
  return "";
}
