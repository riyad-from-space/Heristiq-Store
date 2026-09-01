"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { money } from "@/lib/format";
import { Button, Input } from "@/components/ui";
import {
  deletePreOrder,
  markPreOrderPaid,
  recordPayment,
  setPreOrderStatus,
} from "./actions";
import type { PreOrderRow } from "@/lib/types";

export function PreOrderRowActions({ row }: { row: PreOrderRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState(String(row.amount_paid));
  const [error, setError] = useState<string | null>(null);

  function run(
    fn: (fd: FormData) => Promise<string | null>,
    extra?: Record<string, string>,
  ) {
    const fd = new FormData();
    fd.set("id", row.id);
    Object.entries(extra ?? {}).forEach(([k, v]) => fd.set(k, v));
    // Surface the failure — swallowing it made a failed delete look like it worked.
    startTransition(async () => setError(await fn(fd)));
  }

  if (paying) {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Input
          type="number" min="0" step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="!w-24 !py-1 !text-xs"
          autoFocus
        />
        <Button
          className="!px-2 !py-1 !text-xs"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const err = await recordPayment(row.id, Number(amount) || 0);
              setError(err);
              if (!err) {
                setPaying(false);
                router.refresh();
              }
            })
          }
        >
          Save
        </Button>
        <button
          onClick={() => setPaying(false)}
          className="text-xs text-neutral-500 hover:underline"
        >
          Cancel
        </button>
      </span>
    );
  }

  const settled = row.payment_status === "paid";
  const closed = row.status === "fulfilled" || row.status === "cancelled";

  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {error && (
        <span className="text-xs text-red-600" title={error}>
          Failed
        </span>
      )}
      {!settled && (
        <button
          onClick={() => {
            if (confirm(`Mark the full ${money(row.total_amount)} as paid?`)) {
              run(markPreOrderPaid);
            }
          }}
          disabled={pending}
          className="text-xs text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-400"
        >
          Mark paid
        </button>
      )}
      {!settled && (
        <button
          onClick={() => setPaying(true)}
          disabled={pending}
          className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
        >
          Part pay
        </button>
      )}
      {!closed && (
        <button
          onClick={() => run(setPreOrderStatus, { status: "fulfilled" })}
          disabled={pending}
          className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
        >
          Fulfil
        </button>
      )}
      <Link
        href={`/pre-orders/${row.id}`}
        className="text-xs text-neutral-500 hover:underline"
      >
        Edit
      </Link>
      <button
        onClick={() => {
          if (confirm(`Delete the pre-order for ${row.customer_name}? This cannot be undone.`)) {
            run(deletePreOrder);
          }
        }}
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Delete
      </button>
    </span>
  );
}
