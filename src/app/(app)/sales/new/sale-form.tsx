"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { money } from "@/lib/format";
import { SALES_CHANNELS, type SalesChannel, type SaleStatus } from "@/lib/types";
import { createSale, updateSale, type SaleInput } from "../actions";

export type SellableProduct = {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  avg_cost: number;
  on_hand: number;
};

type Line = { key: number; product_id: string; qty: string; unit_price: string };

/** Existing sale being edited. Absent when recording a new one. */
export type SaleEditValues = {
  id: string;
  sale_date: string;
  channel: SalesChannel;
  status: SaleStatus;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  discount: number;
  delivery_charge: number;
  delivery_cost: number;
  note: string | null;
  lines: { product_id: string; qty: number; unit_price: number }[];
};

let nextKey = 1;
const blankLine = (): Line => ({ key: nextKey++, product_id: "", qty: "1", unit_price: "" });

export function SaleForm({
  products,
  today,
  values,
}: {
  products: SellableProduct[];
  today: string;
  values?: SaleEditValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>(
    values
      ? values.lines.map((l) => ({
          key: nextKey++,
          product_id: l.product_id,
          qty: String(l.qty),
          unit_price: String(l.unit_price),
        }))
      : [blankLine()],
  );
  const [header, setHeader] = useState({
    sale_date: values?.sale_date ?? today,
    channel: (values?.channel ?? "facebook") as SalesChannel,
    status: (values?.status ?? "confirmed") as SaleStatus,
    customer_name: values?.customer_name ?? "",
    customer_phone: values?.customer_phone ?? "",
    customer_address: values?.customer_address ?? "",
    note: values?.note ?? "",
  });
  const [charges, setCharges] = useState({
    discount: String(values?.discount ?? 0),
    delivery_charge: String(values?.delivery_charge ?? 0),
    delivery_cost: String(values?.delivery_cost ?? 0),
  });

  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Choosing a product pre-fills its list price; the user can still override.
        if (patch.product_id) {
          const p = byId.get(patch.product_id);
          if (p) next.unit_price = String(p.selling_price);
        }
        return next;
      }),
    );
  }

  const totals = useMemo(() => {
    let itemsTotal = 0;
    let cogs = 0;
    let shortStock = false;

    for (const l of lines) {
      const p = byId.get(l.product_id);
      if (!p) continue;
      const qty = Number(l.qty) || 0;
      itemsTotal += qty * (Number(l.unit_price) || 0);
      cogs += qty * Number(p.avg_cost);
      if (qty > p.on_hand) shortStock = true;
    }

    const discount = Number(charges.discount) || 0;
    const deliveryCharge = Number(charges.delivery_charge) || 0;
    const deliveryCost = Number(charges.delivery_cost) || 0;

    const revenue = itemsTotal - discount;
    const netDelivery = deliveryCharge - deliveryCost;

    return {
      itemsTotal,
      discount,
      revenue,
      cogs,
      netDelivery,
      profit: revenue - cogs + netDelivery,
      customerPays: revenue + deliveryCharge,
      shortStock,
    };
  }, [lines, charges, byId]);

  function submit() {
    setError(null);
    const payload: SaleInput = {
      sale_date: header.sale_date || today,
      channel: header.channel,
      status: header.status,
      customer_name: header.customer_name.trim() || null,
      customer_phone: header.customer_phone.trim() || null,
      customer_address: header.customer_address.trim() || null,
      discount: Number(charges.discount) || 0,
      delivery_charge: Number(charges.delivery_charge) || 0,
      delivery_cost: Number(charges.delivery_cost) || 0,
      note: header.note.trim() || null,
      lines: lines
        .filter((l) => l.product_id)
        .map((l) => ({
          product_id: l.product_id,
          qty: Number(l.qty) || 0,
          unit_price: Number(l.unit_price) || 0,
        })),
    };

    startTransition(async () => {
      const result = values
        ? await updateSale(values.id, payload)
        : await createSale(payload);
      if (result) setError(result);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date">
          <Input
            type="date"
            value={header.sale_date}
            onChange={(e) => setHeader({ ...header, sale_date: e.target.value })}
          />
        </Field>
        <Field label="Channel">
          <Select
            value={header.channel}
            onChange={(e) =>
              setHeader({ ...header, channel: e.target.value as SalesChannel })
            }
          >
            {SALES_CHANNELS.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select
            value={header.status}
            onChange={(e) =>
              setHeader({ ...header, status: e.target.value as SaleStatus })
            }
          >
            <option value="confirmed">Confirmed</option>
            <option value="delivered">Delivered</option>
            <option value="pending">Pending</option>
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Customer name">
          <Input
            value={header.customer_name}
            onChange={(e) => setHeader({ ...header, customer_name: e.target.value })}
          />
        </Field>
        <Field label="Phone">
          <Input
            inputMode="tel"
            value={header.customer_phone}
            onChange={(e) => setHeader({ ...header, customer_phone: e.target.value })}
          />
        </Field>
        <Field label="Address">
          <Input
            value={header.customer_address}
            onChange={(e) =>
              setHeader({ ...header, customer_address: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Products</h3>
        {lines.map((line) => {
          const p = byId.get(line.product_id);
          const qty = Number(line.qty) || 0;
          return (
            <div
              key={line.key}
              className="grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end dark:border-neutral-800"
            >
              <Field label="Product">
                <Select
                  value={line.product_id}
                  onChange={(e) => update(line.key, { product_id: e.target.value })}
                >
                  <option value="">— choose —</option>
                  {products.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.sku}) · {op.on_hand} in stock
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Qty">
                <Input
                  type="number" min="1" step="1" inputMode="numeric"
                  value={line.qty}
                  onChange={(e) => update(line.key, { qty: e.target.value })}
                />
              </Field>
              <Field label="Unit price">
                <Input
                  type="number" min="0" step="0.01" inputMode="decimal"
                  value={line.unit_price}
                  onChange={(e) => update(line.key, { unit_price: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-3 pb-2 sm:pb-0">
                {p && qty > p.on_hand && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    only {p.on_hand} in stock
                  </span>
                )}
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <Button
          type="button"
          tone="ghost"
          onClick={() => setLines((ls) => [...ls, blankLine()])}
        >
          + Add line
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Discount">
          <Input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={charges.discount}
            onChange={(e) => setCharges({ ...charges, discount: e.target.value })}
          />
        </Field>
        <Field label="Delivery charged to customer">
          <Input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={charges.delivery_charge}
            onChange={(e) => setCharges({ ...charges, delivery_charge: e.target.value })}
          />
        </Field>
        <Field label="Delivery paid to courier">
          <Input
            type="number" min="0" step="0.01" inputMode="decimal"
            value={charges.delivery_cost}
            onChange={(e) => setCharges({ ...charges, delivery_cost: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Note">
        <Textarea
          rows={2}
          value={header.note}
          onChange={(e) => setHeader({ ...header, note: e.target.value })}
        />
      </Field>

      <div className="space-y-1 rounded-lg bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-800">
        <Row label="Items" value={money(totals.itemsTotal)} />
        {totals.discount > 0 && (
          <Row label="Discount" value={`− ${money(totals.discount)}`} muted />
        )}
        <Row label="Product revenue" value={money(totals.revenue)} />
        <Row label="Cost of goods" value={`− ${money(totals.cogs)}`} muted />
        <Row
          label="Delivery (charged − paid)"
          value={money(totals.netDelivery)}
          muted
        />
        <div className="mt-1 flex justify-between border-t border-neutral-300 pt-1 font-semibold dark:border-neutral-700">
          <span>Gross profit</span>
          <span
            className={`tabular-nums ${
              totals.profit < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {money(totals.profit)}
          </span>
        </div>
        <Row
          label="Customer pays"
          value={money(totals.customerPays)}
          className="pt-1"
        />
      </div>

      {totals.shortStock && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          A line is above available stock. The sale will still record and stock
          will go negative — fix it later with a stock adjustment.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button type="button" onClick={submit} disabled={pending}>
        {pending ? "Saving…" : values ? "Save changes" : "Record sale"}
      </Button>
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
  className = "",
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between ${muted ? "text-neutral-500" : ""} ${className}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
