"use client";

import { useActionState, useRef } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { createSupplier } from "./actions";

export function SupplierForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, action, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await createSupplier(prev, fd);
      if (!result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier name">
          <Input name="name" required />
        </Field>
        <Field label="Phone">
          <Input name="phone" inputMode="tel" />
        </Field>
      </div>
      <Field label="Address">
        <Input name="address" />
      </Field>
      <Field label="Note">
        <Textarea name="note" rows={2} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add supplier"}
      </Button>
    </form>
  );
}
