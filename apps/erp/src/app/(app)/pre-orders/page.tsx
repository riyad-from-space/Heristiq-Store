import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { date, money, todayDhaka } from "@/lib/format";
import { Badge, Card, Empty, Stat } from "@/components/ui";
import type {
  PaymentStatus, PreOrderItemRow, PreOrderRow, PreOrderStatus,
} from "@/lib/types";
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

export default async function PreOrdersPage({ searchParams }: PageProps<"/pre-orders">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const payment = typeof sp.payment === "string" ? sp.payment : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const supabase = await createClient();

  let query = supabase.from("v_pre_orders").select("*").order("order_date", { ascending: false });
  if (status) query = query.eq("status", status);
  if (payment) query = query.eq("payment_status", payment);
  if (from) query = query.gte("order_date", from);
  if (to) query = query.lte("order_date", to);

  const [ordersRes, productsRes, itemsRes, allRes] = await Promise.all([
    query,
    supabase
      .from("v_product_stock")
      .select("id, name, sku, selling_price, available")
      .eq("is_active", true)
      .order("name"),
    supabase.from("v_pre_order_items").select("*"),
    supabase.from("v_pre_orders").select("id", { count: "exact", head: true }),
  ]);

  const all = (ordersRes.data ?? []) as PreOrderRow[];
  const items = (itemsRes.data ?? []) as PreOrderItemRow[];

  const byOrder = new Map<string, PreOrderItemRow[]>();
  for (const it of items) {
    const list = byOrder.get(it.pre_order_id) ?? [];
    list.push(it);
    byOrder.set(it.pre_order_id, list);
  }

  const orders = q
    ? all.filter((o) => {
        const lines = byOrder.get(o.id) ?? [];
        return [
          o.customer_name, o.customer_phone, o.customer_address, o.note,
          ...lines.map((l) => l.product_name), ...lines.map((l) => l.product_sku),
          ...lines.map((l) => l.item_note),
        ].some((f) => (f ?? "").toLowerCase().includes(q));
      })
    : all;

  const open = orders.filter((o) => o.status !== "cancelled" && o.converted_sale_id == null);
  const outstanding = open.reduce((s, o) => s + Number(o.amount_due), 0);
  const advances = open.reduce((s, o) => s + Number(o.amount_paid), 0);
  const today = todayDhaka();

  return (
    <>
      <h1 className="text-xl font-semibold">Pre-orders</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Open pre-orders" value={open.length} hint="Awaiting delivery" />
        <Stat
          label="Advances taken"
          value={money(advances)}
          tone={advances > 0 ? "good" : "neutral"}
          hint="Already collected"
        />
        <Stat
          label="Still owed"
          value={money(outstanding)}
          tone={outstanding > 0 ? "warn" : "neutral"}
          hint="Not revenue until delivered"
        />
      </div>

      <Card title="New pre-order">
        <PreOrderForm
          products={(productsRes.data ?? []) as CatalogueProduct[]}
          today={today}
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
              : "No pre-orders yet. Add one above when a customer commits to something you do not have in stock."}
          </Empty>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => {
              const lines = byOrder.get(o.id) ?? [];
              const overdue =
                o.expected_date != null &&
                o.expected_date < today &&
                o.converted_sale_id == null &&
                o.status !== "cancelled";

              return (
                <li
                  key={o.id}
                  className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
                >
                  {/* ---- who ---- */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{o.customer_name}</div>
                      <a
                        href={`tel:${o.customer_phone}`}
                        className="text-sm text-neutral-500 hover:underline"
                      >
                        {o.customer_phone}
                      </a>
                      {o.customer_address && (
                        <div className="mt-0.5 text-sm text-neutral-500">
                          {o.customer_address}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={PAYMENT_TONE[o.payment_status]}>{o.payment_status}</Badge>
                      <Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge>
                    </div>
                  </div>

                  {/* ---- what ---- */}
                  <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-2 text-sm dark:border-neutral-800">
                    {lines.map((l) => (
                      <li key={l.id} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0">
                          <span className="tabular-nums text-neutral-500">{l.qty} ×</span>{" "}
                          {l.product_name ?? l.item_note ?? "item"}
                          {l.product_sku && (
                            <span className="ml-1.5 text-xs text-neutral-500">
                              {l.product_sku}
                            </span>
                          )}
                          {l.product_id == null && (
                            <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">
                              not in catalogue
                            </span>
                          )}
                        </span>
                        <span className="whitespace-nowrap tabular-nums text-neutral-500">
                          {money(l.unit_price)} → {money(l.line_total)}
                        </span>
                      </li>
                    ))}
                    {lines.length === 0 && (
                      <li className="text-neutral-500">No items on this order.</li>
                    )}
                  </ul>

                  {/* ---- money and dates ---- */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-neutral-100 pt-2 text-sm dark:border-neutral-800">
                    <span className="text-neutral-500">
                      Total{" "}
                      <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">
                        {money(o.total_amount)}
                      </strong>
                    </span>
                    <span className="text-neutral-500">
                      Paid <strong className="tabular-nums">{money(o.amount_paid)}</strong>
                    </span>
                    <span className="text-neutral-500">
                      Due{" "}
                      <strong
                        className={`tabular-nums ${
                          Number(o.amount_due) > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : ""
                        }`}
                      >
                        {money(o.amount_due)}
                      </strong>
                    </span>
                    <span className="text-neutral-500">
                      Ordered <strong>{date(o.order_date)}</strong>
                    </span>
                    {o.expected_date && (
                      <span className={overdue ? "text-red-600 dark:text-red-400" : "text-neutral-500"}>
                        Expected <strong>{date(o.expected_date)}</strong>
                        {overdue && " — overdue"}
                      </span>
                    )}
                  </div>

                  {o.note && (
                    <p className="mt-2 text-sm text-neutral-500">{o.note}</p>
                  )}

                  <div className="mt-3 border-t border-neutral-100 pt-2 dark:border-neutral-800">
                    <PreOrderRowActions row={o} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-neutral-500">
        A pre-order reserves stock but moves none of it — the items still show under
        Products, just no longer as available. Nothing here counts towards revenue or
        profit. Press <strong>Deliver</strong> when the customer actually receives the
        order: that records the sale for you and takes the items out of stock, so you
        never enter it twice.
      </p>
    </>
  );
}
