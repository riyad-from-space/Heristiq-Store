"use client";

import { useActionState, useRef } from "react";
import { Button, Input } from "@/components/ui";
import { createCategory } from "./actions";

export function CategoryForm() {
  const formRef = useRef<HTMLFormElement>(null);

  const [error, action, pending] = useActionState(
    async (prev: string | null, fd: FormData) => {
      const result = await createCategory(prev, fd);
      if (!result) formRef.current?.reset();
      return result;
    },
    null,
  );

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <div className="flex gap-2">
        <Input name="name" placeholder="New category" required />
        <Button type="submit" tone="ghost" disabled={pending}>
          Add
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}
