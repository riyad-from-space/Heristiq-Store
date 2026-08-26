"use client";

import { useTransition } from "react";
import { voidSale } from "./actions";

export function VoidSaleButtons({
  id,
  disabled,
}: {
  id: string;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(status: "cancelled" | "returned") {
    const verb = status === "returned" ? "returned" : "cancelled";
    if (!confirm(`Mark this sale as ${verb} and put the stock back?`)) return;

    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    startTransition(() => voidSale(fd));
  }

  if (disabled) return <span className="text-xs text-neutral-400">—</span>;

  return (
    <span className="flex gap-2 whitespace-nowrap">
      <button
        onClick={() => run("returned")}
        disabled={pending}
        className="text-xs text-neutral-500 hover:underline disabled:opacity-50"
      >
        Returned
      </button>
      <button
        onClick={() => run("cancelled")}
        disabled={pending}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
    </span>
  );
}
