"use client";

import { useActionState, useRef } from "react";
import { Button, Field, Input, Select } from "@/components/ui";

type Option = { id: string; name: string };

export type ProductValues = {
  id?: string;
  sku?: string;
  name?: string;
  category_id?: string | null;
  supplier_id?: string | null;
  selling_price?: number;
  reorder_level?: number;
  is_active?: boolean;
  avg_cost?: number;
};

export function ProductForm({
  action,
  categories,
  suppliers,
  values = {},
  submitLabel,
  resetOnSuccess = false,
}: {
  action: (prev: string | null, fd: FormData) => Promise<string | null>;
  categories: Option[];
  suppliers: Option[];
  values?: ProductValues;
  submitLabel: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, formAction, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await action(prev, fd);
      if (!result && resetOnSuccess) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product name">
          <Input name="name" defaultValue={values.name ?? ""} required />
        </Field>
        <Field label="SKU" hint="Your own product code, e.g. PWC-001">
          <Input name="sku" defaultValue={values.sku ?? ""} required />
        </Field>
        <Field label="Category">
          <Select name="category_id" defaultValue={values.category_id ?? ""}>
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Supplier">
          <Select name="supplier_id" defaultValue={values.supplier_id ?? ""}>
            <option value="">— none —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Selling price (BDT)">
          <Input
            name="selling_price"
            type="number"
            min="0"
            step="1"
            defaultValue={values.selling_price ?? 0}
          />
        </Field>
        <Field label="Reorder level" hint="Warn when stock drops to this">
          <Input
            name="reorder_level"
            type="number"
            min="0"
            step="1"
            defaultValue={values.reorder_level ?? 3}
          />
        </Field>
        {values.id && (
          <Field
            label="Cost per unit (BDT)"
            hint="Normally from your purchases. Changing it is recorded as a correction."
          >
            <Input
              name="avg_cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={values.avg_cost ?? 0}
            />
          </Field>
        )}
      </div>

      {values.id && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={values.is_active ?? true}
            className="h-4 w-4"
          />
          Active (uncheck to hide from lists without deleting history)
        </label>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
