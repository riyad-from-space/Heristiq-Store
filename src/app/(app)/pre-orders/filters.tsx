"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Field, Input, Select } from "@/components/ui";
import { PAYMENT_STATUSES, PRE_ORDER_STATUSES } from "@/lib/types";

/**
 * Filter state lives in the URL, so a filtered view is shareable, survives a
 * refresh, and the back button behaves. Server Components read the same params.
 */
export function PreOrderFilters({ total, shown }: { total: number; shown: number }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/pre-orders?${next.toString()}`);
  }

  const filtered = shown !== total;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Search">
          <Input
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => setParam("q", e.target.value)}
            placeholder="Name, phone, product…"
            type="search"
          />
        </Field>
        <Field label="Payment">
          <Select
            defaultValue={params.get("payment") ?? ""}
            onChange={(e) => setParam("payment", e.target.value)}
          >
            <option value="">All</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="Order status">
          <Select
            defaultValue={params.get("status") ?? ""}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">All</option>
            {PRE_ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input
            type="date"
            defaultValue={params.get("from") ?? ""}
            onChange={(e) => setParam("from", e.target.value)}
          />
        </Field>
        <Field label="To">
          <Input
            type="date"
            defaultValue={params.get("to") ?? ""}
            onChange={(e) => setParam("to", e.target.value)}
          />
        </Field>
      </div>

      {filtered && (
        <p className="text-xs text-neutral-500">
          Showing {shown} of {total}.{" "}
          <button
            onClick={() => router.replace("/pre-orders")}
            className="underline hover:no-underline"
          >
            Clear filters
          </button>
        </p>
      )}
    </div>
  );
}
