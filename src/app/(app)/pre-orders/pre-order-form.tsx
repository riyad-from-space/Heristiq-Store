"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { money } from "@/lib/format";
import { isValidPhone } from "@/lib/phone";
import { PRE_ORDER_STATUSES, type PreOrderStatus } from "@/lib/types";
import { createPreOrder, updatePreOrder, type PreOrderInput } from "./actions";

export type CatalogueProduct = {
  id: string;
  name: string;
  sku: string;
  selling_price: number;
};

export type PreOrderValues = PreOrderInput & { id: string };

export function PreOrderForm({
  products,
  today,
  values,
  onDone,
}: {
  products: CatalogueProduct[];
  today: string;
  values?: PreOrderValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    customer_name: values?.customer_name ?? "",
    customer_phone: values?.customer_phone ?? "",
    product_id: values?.product_id ?? "",
    item_note: values?.item_note ?? "",
    qty: String(values?.qty ?? 1),
    total_amount: String(values?.total_amount ?? ""),
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

  // Picking a product with a known price fills the total, and the total keeps
  // following the quantity until the user types their own figure — otherwise
  // changing 1 to 3 silently left the single-unit price behind.
  const [totalEdited, setTotalEdited] = useState(values != null);

  function suggestTotal(productId: string, qty: number) {
    const p = byId.get(productId);
    return p && p.selling_price > 0 ? String(p.selling_price * qty) : "";
  }

  function pickProduct(id: string) {
    setForm((f) => ({
      ...f,
      product_id: id,
      total_amount: totalEdited
        ? f.total_amount
        : suggestTotal(id, Number(f.qty) || 1) || f.total_amount,
    }));
  }

  function setQty(qty: string) {
    setForm((f) => ({
      ...f,
      qty,
      total_amount:
        !totalEdited && f.product_id
          ? suggestTotal(f.product_id, Number(qty) || 1) || f.total_amount
          : f.total_amount,
    }));
  }

  const total = Number(form.total_amount) || 0;
  const paid = Number(form.amount_paid) || 0;
  const due = Math.max(0, total - paid);
  const payment = total === 0 ? "unpaid" : paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

  // Inline, per-field, shown only once the user has left the field.
  const fieldErrors: Record<string, string | null> = {
    customer_name: !form.customer_name.trim() ? "Required." : null,
    customer_phone: !form.customer_phone.trim()
      ? "Required."
      : !isValidPhone(form.customer_phone)
        ? "11 digits starting 01, e.g. 01712345678."
        : null,
    item: !form.product_id && !form.item_note.trim()
      ? "Pick a product, or describe the item."
      : null,
    qty: (Number(form.qty) || 0) < 1 ? "At least 1." : null,
    amount_paid: paid > total ? `More than the total of ${money(total)}.` : null,
    expected_date:
      form.expected_date && form.expected_date < form.order_date
        ? "Cannot be before the order date."
        : null,
  };

  const firstError = Object.values(fieldErrors).find(Boolean) ?? null;

  function submit() {
    setTouched({
      customer_name: true, customer_phone: true, item: true,
      qty: true, amount_paid: true, expected_date: true,
    });
    if (firstError) {
      setError(firstError);
      return;
    }
    setError(null);

    const payload: PreOrderInput = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      product_id: form.product_id || null,
      item_note: form.item_note || null,
      qty: Number(form.qty) || 1,
      total_amount: total,
      amount_paid: paid,
      order_date: form.order_date || today,
      expected_date: form.expected_date || null,
      status: form.status,
      note: form.note || null,
    };

    startTransition(async () => {
      const result = values
        ? await updatePreOrder(values.id, payload)
        : await createPreOrder(payload);

      if (result) {
        setError(result);
        return;
      }
      if (values) {
        router.push("/pre-orders");
      } else {
        setForm((f) => ({
          ...f,
          customer_name: "", customer_phone: "", product_id: "", item_note: "",
          qty: "1", total_amount: "", amount_paid: "0", expected_date: "", note: "",
        }));
        setTouched({});
        router.refresh();
        onDone?.();
      }
    });
  }

  const show = (k: string) => (touched[k] ? fieldErrors[k] : null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer name *" hint={show("customer_name") ?? undefined}>
          <Input
            value={form.customer_name}
            onChange={(e) => set("customer_name", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, customer_name: true }))}
            placeholder="Nusrat Jahan"
            aria-invalid={!!show("customer_name")}
          />
        </Field>

        <Field label="Contact number *" hint={show("customer_phone") ?? "Mobile, e.g. 01712345678"}>
          <Input
            value={form.customer_phone}
            onChange={(e) => set("customer_phone", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, customer_phone: true }))}
            inputMode="tel"
            placeholder="01712345678"
            aria-invalid={!!show("customer_phone")}
          />
        </Field>

        <Field label="Product" hint={show("item") ?? "From the catalogue"}>
          <Select
            value={form.product_id}
            onChange={(e) => pickProduct(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, item: true }))}
          >
            <option value="">— not in the catalogue —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Item description" hint="Only if it is not in the catalogue yet">
          <Input
            value={form.item_note}
            onChange={(e) => set("item_note", e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, item: true }))}
            placeholder="Gold anklet, custom size"
          />
        </Field>

        <Field label="Quantity *" hint={show("qty") ?? undefined}>
          <Input
            type="number" min="1" step="1"
            value={form.qty}
            onChange={(e) => setQty(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, qty: true }))}
          />
        </Field>

        <Field label="Total amount (BDT)">
          <Input
            type="number" min="0" step="1"
            value={form.total_amount}
            onChange={(e) => {
              setTotalEdited(true);
              set("total_amount", e.target.value);
            }}
            placeholder="0"
          />
        </Field>

        <Field label="Amount paid (BDT)" hint={show("amount_paid") ?? "Advance taken so far"}>
          <Input
            type="number" min="0" step="1"
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
            {PRE_ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
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

      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-800/50">
        <span className="text-neutral-500">
          Due <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">{money(due)}</strong>
        </span>
        <span className="text-neutral-500">
          Payment <strong className="capitalize text-neutral-900 dark:text-neutral-100">{payment}</strong>
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
