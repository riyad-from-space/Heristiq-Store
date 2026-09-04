"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { money } from "@/lib/format";
import { createPurchase, type PurchaseInput } from "../actions";

type Option = { id: string; name: string; sku?: string };
type Line = { key: number; product_id: string; qty: string; unit_cost: string };

let nextKey = 1;
const blankLine = (): Line => ({
  key: nextKey++,
  product_id: "",
  qty: "1",
  unit_cost: "",
});

export function PurchaseForm({
  products,
  suppliers,
  today,
}: {
  products: Option[];
  suppliers: Option[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [extras, setExtras] = useState({ freight: "0", importCost: "0", other: "0" });
  const [header, setHeader] = useState({
    supplier_id: "",
    purchase_date: today,
    note: "",
  });

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const totals = useMemo(() => {
    const parsed = lines.map((l) => ({
      ...l,
      qtyNum: Number(l.qty) || 0,
      costNum: Number(l.unit_cost) || 0,
    }));
    const goods = parsed.reduce((s, l) => s + l.qtyNum * l.costNum, 0);
    const extra =
      (Number(extras.freight) || 0) +
      (Number(extras.importCost) || 0) +
      (Number(extras.other) || 0);

    // Mirrors post_purchase(): extras are allocated across lines by line value.
    const landed = new Map<number, number>();
    for (const l of parsed) {
      const value = l.qtyNum * l.costNum;
      if (goods > 0 && l.qtyNum > 0) {
        landed.set(l.key, l.costNum + (extra * (value / goods)) / l.qtyNum);
      }
    }

    return { goods, extra, total: goods + extra, landed };
  }, [lines, extras]);

  function submit() {
    setError(null);
    const payload: PurchaseInput = {
      supplier_id: header.supplier_id || null,
      purchase_date: header.purchase_date || today,
      freight_cost: Number(extras.freight) || 0,
      import_cost: Number(extras.importCost) || 0,
      other_cost: Number(extras.other) || 0,
      note: header.note.trim() || null,
      lines: lines
        .filter((l) => l.product_id)
        .map((l) => ({
          product_id: l.product_id,
          qty: Number(l.qty) || 0,
          unit_cost: Number(l.unit_cost) || 0,
        })),
    };

    startTransition(async () => {
      const result = await createPurchase(payload);
      if (result) setError(result);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier">
          <Select
            value={header.supplier_id}
            onChange={(e) => setHeader({ ...header, supplier_id: e.target.value })}
          >
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Purchase date">
          <Input
            type="date"
            value={header.purchase_date}
            onChange={(e) => setHeader({ ...header, purchase_date: e.target.value })}
          />
        </Field>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Products</h3>
        {lines.map((line) => (
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
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Qty">
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={line.qty}
                onChange={(e) => update(line.key, { qty: e.target.value })}
              />
            </Field>
            <Field label="Unit cost">
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={line.unit_cost}
                onChange={(e) => update(line.key, { unit_cost: e.target.value })}
              />
            </Field>
            <div className="flex items-center gap-3 pb-2 sm:pb-0">
              <span className="text-xs text-neutral-500">
                {totals.landed.has(line.key)
                  ? `landed ${money(totals.landed.get(line.key), true)}/unit`
                  : ""}
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setLines((ls) => ls.filter((l) => l.key !== line.key))
                  }
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        <Button
          type="button"
          tone="ghost"
          onClick={() => setLines((ls) => [...ls, blankLine()])}
        >
          + Add line
        </Button>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Extra costs
          <span className="ml-2 font-normal text-neutral-500">
            spread across the lines above, by value
          </span>
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Freight / courier">
            <Input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={extras.freight}
              onChange={(e) => setExtras({ ...extras, freight: e.target.value })}
            />
          </Field>
          <Field label="Import / customs">
            <Input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={extras.importCost}
              onChange={(e) => setExtras({ ...extras, importCost: e.target.value })}
            />
          </Field>
          <Field label="Other">
            <Input
              type="number" min="0" step="0.01" inputMode="decimal"
              value={extras.other}
              onChange={(e) => setExtras({ ...extras, other: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <Field label="Note">
        <Textarea
          rows={2}
          value={header.note}
          onChange={(e) => setHeader({ ...header, note: e.target.value })}
        />
      </Field>

      <div className="rounded-lg bg-neutral-100 px-4 py-3 text-sm dark:bg-neutral-800">
        <div className="flex justify-between">
          <span>Goods</span>
          <span className="tabular-nums">{money(totals.goods)}</span>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>Extra costs</span>
          <span className="tabular-nums">{money(totals.extra)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-neutral-300 pt-1 font-semibold dark:border-neutral-700">
          <span>Total landed cost</span>
          <span className="tabular-nums">{money(totals.total)}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button type="button" onClick={submit} disabled={pending}>
        {pending ? "Saving…" : "Save purchase & add to stock"}
      </Button>
    </div>
  );
}
