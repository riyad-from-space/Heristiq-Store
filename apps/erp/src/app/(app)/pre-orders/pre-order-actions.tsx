"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money } from "@/lib/format";
import { deletePreOrder, deliverPreOrder } from "./actions";
import type { PreOrderRow } from "@/lib/types";

/**
 * Three actions only: Edit, Deliver, Delete.
 *
 * Status and payment changes belong in the form, where the whole order is in
 * view. A row full of one-click state changes invites a mistap, and Deliver is
 * the one that moves stock and books revenue.
 */
export function PreOrderRowActions({ row }: { row: PreOrderRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const delivered = row.converted_sale_id != null;
  const cancelled = row.status === "cancelled";

  function deliver() {
    if (row.unlinked_items > 0) {
      setError(
        `${row.unlinked_items} item(s) are not linked to a catalogue product. Add them to Products first, then edit this pre-order.`,
      );
      return;
    }

    const ok = confirm(
      `Deliver this order to ${row.customer_name}?\n\n` +
        `${row.summary ?? `${row.total_qty} item(s)`}\n\n` +
        `This records a sale of ${money(row.total_amount)}, takes the items out of ` +
        `stock, and marks the pre-order fulfilled.\n\n` +
        `Until now it has not affected any of your totals.`,
    );
    if (!ok) return;

    startTransition(async () => {
      const result = await deliverPreOrder(row.id);
      if ("error" in result) setError(result.error);
      else {
        setError(null);
        router.push("/sales");
      }
    });
  }

  function remove() {
    const ok = confirm(
      `Delete the pre-order for ${row.customer_name}?\n\n` +
        `${row.summary ?? ""}\n\nThis cannot be undone.`,
    );
    if (!ok) return;

    const fd = new FormData();
    fd.set("id", row.id);
    startTransition(async () => setError(await deletePreOrder(fd)));
  }

  return (
    <span className="flex items-center gap-3 whitespace-nowrap">
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Failed
        </span>
      )}

      <Link
        href={`/pre-orders/${row.id}`}
        className="text-xs text-neutral-600 hover:underline dark:text-neutral-400"
      >
        Edit
      </Link>

      {delivered ? (
        <Link
          href="/sales"
          className="text-xs text-emerald-700 hover:underline dark:text-emerald-400"
        >
          View sale
        </Link>
      ) : (
        !cancelled && (
          <button
            onClick={deliver}
            disabled={pending}
            className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
          >
            {pending ? "…" : "Deliver"}
          </button>
        )
      )}

      <button
        onClick={remove}
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </span>
  );
}
