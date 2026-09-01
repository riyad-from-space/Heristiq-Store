import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { date, money, todayDhaka } from "@/lib/format";
import { Badge, Card, Empty, Stat, Table, Td } from "@/components/ui";
import type { PaymentStatus, PreOrderRow, PreOrderStatus } from "@/lib/types";
import { PreOrderForm, type CatalogueProduct } from "./pre-order-form";
import { PreOrderRowActions } from "./pre-order-actions";
import { PreOrderFilters } from "./filters";

export const dynamic = "force-dynamic";

const PAYMENT_TONE: Record<PaymentStatus, "neutral" | "good" | "warn" | "bad"> = {
  paid: "good",
  partial: "warn",
  unpaid: "bad",
  "no price yet": "neutral",
};

const STATUS_TONE: Record<PreOrderStatus, "neutral" | "good" | "warn" | "bad"> = {
  pending: "warn",
  confirmed: "neutral",
  fulfilled: "good",
  cancelled: "bad",
};

export default async function PreOrdersPage({
  searchParams,
}: PageProps<"/pre-orders">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const payment = typeof sp.payment === "string" ? sp.payment : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const supabase = await createClient();

  // Date and status filter in the database; free-text search in memory, because
  // it spans a joined product name and the volume here is small.
  let query = supabase.from("v_pre_orders").select("*").order("order_date", { ascending: false });
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);

  const [ordersRes, productsRes, allRes] = await Promise.all([
    query,
    supabase
      .from("products")
      .select("id, name, sku, selling_price")
      .eq("is_active", true)
      .order("name"),
    supabase.from("v_pre_orders").select("id", { count: "exact", head: true }),
  ]);

  const all = (ordersRes.data ?? []) as PreOrderRow[];
  const orders = q
    ? all.filter((o) =>
        [o.customer_name, o.customer_phone, o.product_name, o.product_sku, o.item_note]
          .some((f) => (f ?? "").toLowerCase().includes(q)),
      )
    : all;

  const open = orders.filter((o) => o.status !== "cancelled" && o.status !== "fulfilled");
  const outstanding = open.reduce((s, o) => s + Number(o.amount_due), 0);
  const advances = open.reduce((s, o) => s + Number(o.amount_paid), 0);

  return (
    <>
      <h1 className="text-xl font-semibold">Pre-orders</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open pre-orders" value={open.length} hint="Not fulfilled or cancelled" />
        <Stat
          label="Advances taken"
          value={money(advances)}
          tone={advances > 0 ? "good" : "neutral"}
          hint="Money already collected"
        />
        <Stat
          label="Still owed"
          value={money(outstanding)}
          tone={outstanding > 0 ? "warn" : "neutral"}
          hint="Not counted as revenue until delivered"
        />
      </div>

      <Card title="New pre-order">
        <PreOrderForm
          products={(productsRes.data ?? []) as CatalogueProduct[]}
          today={todayDhaka()}
        />
      </Card>

      <Card title={`Pre-orders (${orders.length})`}>
        <div className="mb-4">
          <Suspense fallback={null}>
            <PreOrderFilters total={allRes.count ?? orders.length} shown={orders.length} />
          </Suspense>
        </div>

        {ordersRes.error && (
          <p className="mb-3 text-sm text-red-600">{ordersRes.error.message}</p>
        )}

        {orders.length === 0 ? (
          <Empty>
            {q || payment || status || from || to
              ? "No pre-orders match these filters."
              : "No pre-orders yet. Add one above when a customer commits to an item you do not have in stock."}
          </Empty>
        ) : (
          <Table
            head={[
              "Ordered", "Customer", "Item", "Qty", "Total",
              "Paid", "Due", "Payment", "Status", "Expected", "",
            ]}
          >
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="whitespace-nowrap text-neutral-500">{date(o.order_date)}</Td>
                <Td className="font-medium">
                  {o.customer_name}
                  <a
                    href={`tel:${o.customer_phone}`}
                    className="ml-2 text-xs font-normal text-neutral-500 hover:underline"
                  >
                    {o.customer_phone}
                  </a>
                </Td>
                <Td>
                  {o.product_name ?? o.item_note ?? "—"}
                  {o.product_sku && (
                    <span className="ml-2 text-xs text-neutral-500">{o.product_sku}</span>
                  )}
                </Td>
                <Td className="tabular-nums">{o.qty}</Td>
                <Td className="tabular-nums">{money(o.total_amount)}</Td>
                <Td className="tabular-nums text-neutral-500">{money(o.amount_paid)}</Td>
                <Td
                  className={`tabular-nums font-medium ${
                    Number(o.amount_due) > 0 ? "text-amber-600 dark:text-amber-400" : ""
                  }`}
                >
                  {money(o.amount_due)}
                </Td>
                <Td>
                  <Badge tone={PAYMENT_TONE[o.payment_status]}>{o.payment_status}</Badge>
                </Td>
                <Td>
                  <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-neutral-500">
                  {o.expected_date ? date(o.expected_date) : "—"}
                </Td>
                <Td>
                  <PreOrderRowActions row={o} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <p className="text-xs text-neutral-500">
        Nothing here counts towards your stock, revenue or profit. A pre-order is a
        promise, not a shipment. Press <strong>Deliver</strong> when the customer
        actually gets the item — that records the sale for you, takes it out of
        stock, and marks the pre-order fulfilled. You do not need to enter it again
        on the Sales page.
      </p>
    </>
  );
}
