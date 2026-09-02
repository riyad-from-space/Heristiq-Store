"use client";

import { useActionState, useRef } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { adjustStock } from "./actions";

export function AdjustForm({
  products,
}: {
  products: {
    id: string; name: string; sku: string;
    on_hand: number; reserved: number; available: number;
  }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, action, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await adjustStock(prev, fd);
      if (!result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <Field label="Product">
        <Select name="product_id" required defaultValue="">
          <option value="">— choose —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sku}) · {p.on_hand} on shelf
              {p.reserved > 0 ? `, ${p.available} free` : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Direction">
          <Select name="direction" defaultValue="out">
            <option value="out">Remove from stock</option>
            <option value="in">Add to stock</option>
          </Select>
        </Field>
        <Field label="Quantity">
          <Input name="qty" type="number" min="1" step="1" defaultValue="1" required />
        </Field>
        <Field label="Reason">
          <Select name="reason" defaultValue="count">
            <option value="count">Stock count correction</option>
            <option value="damage">Damaged / lost</option>
          </Select>
        </Field>
      </div>

      <Field label="Note" hint="Why the count changed — useful when reviewing later">
        <Input name="note" />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record adjustment"}
      </Button>
    </form>
  );
}
