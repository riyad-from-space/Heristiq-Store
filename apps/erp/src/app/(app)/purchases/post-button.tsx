"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { postPurchase } from "./actions";

/**
 * Post a draft purchase.
 *
 * Confirms first, because posting is not reversible from the UI: it writes
 * rows into the append-only stock ledger, and there is no unpost. The
 * confirmation names the units so the number can be checked against what is
 * physically there before it becomes the truth the shop sells against.
 */
export function PostButton({ id, units }: { id: string; units: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Add ${units} unit${units === 1 ? "" : "s"} to stock? This cannot be undone.`,
            )
          ) {
            return;
          }
          start(async () => {
            const message = await postPurchase(id);
            setError(message);
            if (!message) router.refresh();
          });
        }}
      >
        {pending ? "Posting…" : "Post"}
      </Button>
      {error && (
        <span className="max-w-48 text-right text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
