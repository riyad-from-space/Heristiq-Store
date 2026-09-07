import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateTime, money as fmt } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Badge, Card, Empty, Stat, Table, Td } from "@/components/ui";
import {
  COURIER_STATUS_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  type StorefrontOrder,
} from "@/lib/store-types";

/*
 * Storefront orders.
 *
 * The screen the business runs on, and the one thing missing until now: orders
 * were being written to the database with nothing to read them. Sorted newest
 * first and led by what needs a human — new orders and unverified advances —
 * because that is the question the owner is actually asking when they open
 * this on a phone.
 */
export const dynamic = "force-dynamic";

const COLUMNS = `
  id, reference, status, customer_name, customer_phone, phone_verified_at,
  district, area, payment_method, payment_state, total, amount_paid,
  has_pre_order, risk_note, created_at,
  storefront_order_items ( id, sku, name, qty, unit_price, is_pre_order ),
  storefront_shipments ( id, courier, tracking_code, status, created_at )
`;

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("storefront_orders")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(100);

  const orders = (data ?? []) as unknown as StorefrontOrder[];

  const needsAction = orders.filter(
    (o) =>
      o.status === "placed" || o.payment_state === "advance_pending_verification",
  );
  const open = orders.filter(
    (o) => !["delivered", "cancelled", "returned"].includes(o.status),
  );
  const toCollect = open.reduce(
    (sum, o) => sum + Math.max(0, fmtNum(o.total) - fmtNum(o.amount_paid)),
    0,
  );

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-neutral-500">From the storefront</p>
      </div>

      {error && (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Could not read orders: {error.message}
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            If this says the relation does not exist, the storefront migrations
            (1001 and up) have not been applied to this database yet.
          </p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Needs you" value={String(needsAction.length)} />
        <Stat label="Open" value={String(open.length)} />
        <Stat label="To collect" value={fmt(toCollect)} />
        <Stat label="Total orders" value={String(orders.length)} />
      </div>

      {orders.length === 0 ? (
        <Empty>
          No orders yet. Orders placed on the storefront appear here the moment
          they are made.
        </Empty>
      ) : (
        <Card className="mt-4 p-0">
          <Table head={["Order", "Customer", "Where", "Total", "Status", ""]}>
            {orders.map((order) => {
              const due = Math.max(
                0,
                fmtNum(order.total) - fmtNum(order.amount_paid),
              );
              const shipment = order.storefront_shipments?.[0];
              const pieces =
                order.storefront_order_items?.reduce((s, i) => s + i.qty, 0) ?? 0;

              return (
                <tr
                  key={order.id}
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <Td>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium hover:underline"
                    >
                      {order.reference}
                    </Link>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {dateTime(order.created_at)}
                    </span>
                  </Td>
                  <Td>
                    {order.customer_name}
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {displayPhone(order.customer_phone)}
                      {!order.phone_verified_at && (
                        <span className="ml-1 text-amber-600">unverified</span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    {order.area ? `${order.area}, ` : ""}
                    {order.district}
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {pieces} {pieces === 1 ? "piece" : "pieces"}
                      {order.has_pre_order && " · pre-order"}
                    </span>
                  </Td>
                  <Td className="tabular-nums">
                    {fmt(order.total)}
                    {due !== fmtNum(order.total) && (
                      <span className="mt-0.5 block text-xs text-neutral-500">
                        {fmt(due)} due
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[order.status]}>
                      {ORDER_STATUS_LABEL[order.status]}
                    </Badge>
                    {shipment && (
                      <span className="mt-1 block text-xs text-neutral-500">
                        {COURIER_STATUS_LABEL[shipment.status] ?? shipment.status}
                      </span>
                    )}
                    {order.payment_state === "advance_pending_verification" && (
                      <span className="mt-1 block text-xs font-medium text-amber-600">
                        Check advance
                      </span>
                    )}
                    {order.risk_note && (
                      <span className="mt-1 block text-xs text-amber-600">
                        Risk flag
                      </span>
                    )}
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/orders/${order.id}`}
                      className="text-sm text-neutral-500 hover:underline"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </>
  );
}

function fmtNum(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0));
}
