"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { money } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import { PRE_ORDER_STATUSES, type PreOrderStatus } from "@/lib/types";
import { savePreOrder, type PreOrderPayload } from "./actions";

export type CatalogueProduct = {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
  available: number;
};

type Line = {
  key: number;
  product_id: string;
  item_note: string;
  qty: string;
  unit_price: string;
};

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  product_id: "",
  item_note: "",
  qty: "1",
  unit_price: "",
});

export type PreOrderValues = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  amount_paid: number;
  order_date: string;
  expected_date: string | null;
  status: PreOrderStatus;
  note: string | null;
  lines: {
    product_id: string | null;
    item_note: string | null;
    qty: number;
    unit_price: number;
  }[];
};

export function PreOrderForm({
  products,
  today,
  values,
}: {
  products: CatalogueProduct[];
  today: string;
  values?: PreOrderValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [lines, setLines] = useState<Line[]>(() =>
    values && values.lines.length > 0
      ? values.lines.map((l) => ({
          key: nextKey++,
          product_id: l.product_id ?? "",
          item_note: l.item_note ?? "",
          qty: String(l.qty),
          unit_price: String(l.unit_price),
        }))
      : [blankLine()],
  );

  const [form, setForm] = useState({
    customer_name: values?.customer_name ?? "",
    customer_phone: values?.customer_phone ?? "",
    customer_address: values?.customer_address ?? "",
    amount_paid: String(values?.amount_paid ?? 0),
    order_date: values?.order_date ?? today,
    expected_date: values?.expected_date ?? "",
    status: (values?.status ?? "pending") as PreOrderStatus,
    note: values?.note ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Choosing a product fills its list price, unless one was typed already.
        if (patch.product_id !== undefined && patch.product_id) {
          const p = byId.get(patch.product_id);
          if (p && p.selling_price > 0 && !l.unit_price) {
            next.unit_price = String(p.selling_price);
          }
          next.item_note = "";
        }
        return next;
      }),
    );
  }

  const totals = useMemo(() => {
    let total = 0;
    for (const l of lines) {
      total += (Number(l.qty) || 0) * (Number(l.unit_price) || 0);
    }
    const paid = Number(form.amount_paid) || 0;
    return {
      total,
      paid,
      due: Math.max(0, total - paid),
      payment:
        total === 0 ? "no price yet" : paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid",
    };
  }, [lines, form.amount_paid]);

  const filled = lines.filter((l) => l.product_id || l.item_note.trim());

  const fieldErrors: Record<string, string | null> = {
    customer_name: !form.customer_name.trim() ? "Required." : null,
    customer_phone: !form.customer_phone.trim()
      ? "Required."
      : !isValidPhone(form.customer_phone)
        ? "11 digits starting 01, e.g. 01712345678."
        : null,
    lines: filled.length === 0 ? "Add at least one item." : null,
    amount_paid:
      totals.paid > totals.total
        ? `More than the order total of ${money(totals.total)}.`
        : null,
    expected_date:
      form.expected_date && form.expected_date < form.order_date
        ? "Cannot be before the order date."
        : null,
  };

  const firstError = Object.values(fieldErrors).find(Boolean) ?? null;
  const show = (k: string) => (touched[k] ? fieldErrors[k] : null);

  function submit() {
    setTouched({
      customer_name: true, customer_phone: true, lines: true,
      amount_paid: true, expected_date: true,
    });
    if (firstError) {
      setError(firstError);
      return;
    }
    setError(null);

    const payload: PreOrderPayload = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address.trim() || null,
      amount_paid: totals.paid,
      order_date: form.order_date || today,
      expected_date: form.expected_date || null,
      status: form.status,
      note: form.note.trim() || null,
      lines: filled.map((l) => ({
        product_id: l.product_id || null,
        item_note: l.product_id ? null : l.item_note.trim() || null,
        qty: Number(l.qty) || 1,
        unit_price: Number(l.unit_price) || 0,
      })),
    };

    startTransition(async () => {
      const result = await savePreOrder(values?.id ?? null, payload);
      if (result) {
        setError(result);
        return;
      }
      if (values) {
        router.push("/pre-orders");
      } else {
        setLines([blankLine()]);
        setForm((f) => ({
          ...f,
          customer_name: "", customer_phone: "", customer_address: "",
          amount_paid: "0", expected_date: "", note: "",
        }));
        setTouched({});
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* ---------------- customer ---------------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Customer name *" hint={show("customer_name") ?? undefined}>
          <Input
            value={form.customer_name}
            onChange={(e) => set("customer_name", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, customer_name: true }))}
            placeholder="Nusrat Jahan"
            aria-invalid={!!show("customer_name")}
          />
        </Field>
        <Field label="Contact number *" hint={show("customer_phone") ?? "e.g. 01712345678"}>
          <Input
            value={form.customer_phone}
            onChange={(e) => set("customer_phone", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, customer_phone: true }))}
            inputMode="tel"
            placeholder="01712345678"
            aria-invalid={!!show("customer_phone")}
          />
        </Field>
        <Field label="Delivery address">
          <Input
            value={form.customer_address}
            onChange={(e) => set("customer_address", e.target.value)}
            placeholder="House, road, area, city"
          />
        </Field>
      </div>

      {/* ---------------- items ---------------- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
            Items
          </span>
          {show("lines") && (
            <span className="text-xs text-red-600">{show("lines")}</span>
          )}
        </div>

        {lines.map((line) => {
          const p = line.product_id ? byId.get(line.product_id) : null;
          const qty = Number(line.qty) || 0;
          const short = p != null && qty > p.available;

          return (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border border-neutral-200 p-2 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-start dark:border-neutral-800"
            >
              <div className="space-y-1">
                <Select
                  value={line.product_id}
                  onChange={(e) => update(line.key, { product_id: e.target.value })}
                >
                  <option value="">— not in the catalogue —</option>
                  {products.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name} ({op.sku}) · {op.available} free
                    </option>
                  ))}
                </Select>
                {!line.product_id && (
                  <Input
                    value={line.item_note}
                    onChange={(e) => update(line.key, { item_note: e.target.value })}
                    placeholder="Describe the item, e.g. gold anklet, custom size"
                  />
                )}
                {short && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Only {p!.available} free — you can still take the order, this is
                    just a heads-up.
                  </p>
                )}
              </div>

              <Input
                type="number" min="1" step="1" inputMode="numeric"
                value={line.qty}
                onChange={(e) => update(line.key, { qty: e.target.value })}
                aria-label="Quantity"
              />
              <Input
                type="number" min="0" step="1" inputMode="decimal"
                value={line.unit_price}
                onChange={(e) => update(line.key, { unit_price: e.target.value })}
                placeholder="Price each"
                aria-label="Unit price"
              />

              <button
                onClick={() =>
                  setLines((ls) => (ls.length === 1 ? [blankLine()] : ls.filter((l) => l.key !== line.key)))
                }
                className="justify-self-start px-2 py-2 text-xs text-neutral-500 hover:text-red-600 sm:justify-self-auto"
                aria-label="Remove item"
              >
                Remove
              </button>
            </div>
          );
        })}

        <Button tone="ghost" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          + Add another item
        </Button>
      </div>

      {/* ---------------- money and dates ---------------- */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Advance paid (BDT)" hint={show("amount_paid") ?? "For the whole order"}>
          <Input
            type="number" min="0" step="1" inputMode="decimal"
            value={form.amount_paid}
            onChange={(e) => set("amount_paid", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, amount_paid: true }))}
            aria-invalid={!!show("amount_paid")}
          />
        </Field>
        <Field label="Order status">
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as PreOrderStatus)}
          >
            {PRE_ORDER_STATUSES.filter((s) => s !== "fulfilled").map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Order date">
          <Input
            type="date"
            value={form.order_date}
            onChange={(e) => set("order_date", e.target.value)}
          />
        </Field>
        <Field label="Expected delivery" hint={show("expected_date") ?? undefined}>
          <Input
            type="date"
            value={form.expected_date}
            onChange={(e) => set("expected_date", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, expected_date: true }))}
            aria-invalid={!!show("expected_date")}
          />
        </Field>
      </div>

      <Field label="Note">
        <Textarea
          rows={2}
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Anything worth remembering about this order"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/50">
        <span className="text-neutral-500">
          Order total{" "}
          <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">
            {money(totals.total)}
          </strong>
        </span>
        <span className="text-neutral-500">
          Paid <strong className="tabular-nums">{money(totals.paid)}</strong>
        </span>
        <span className="text-neutral-500">
          Due{" "}
          <strong className="tabular-nums text-amber-600 dark:text-amber-400">
            {money(totals.due)}
          </strong>
        </span>
        <span className="text-neutral-500">
          Payment <strong className="capitalize">{totals.payment}</strong>
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button onClick={submit} disabled={pending}>
        {pending ? "Saving…" : values ? "Save changes" : "Add pre-order"}
      </Button>
    </div>
  );
}
