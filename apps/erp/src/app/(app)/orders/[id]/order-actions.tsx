"use client";

import { useState, useTransition } from "react";
import { pushToCourier } from "../actions";

/*
 * The one-tap courier push, as a button.
 *
 * A client component rather than a plain form action because the push has
 * three outcomes worth telling apart: it worked, it worked but the recipient's
 * delivery history is poor, or it failed and the message says whether pressing
 * again is safe. A form post would swallow all three.
 */
export function PushToCourierButton({
  reference,
  couriers,
}: {
  reference: string;
  couriers: { key: string; label: string }[];
}) {
  const [courier, setCourier] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          aria-label="Courier"
          className="min-h-11 rounded-lg border border-neutral-200 bg-white px-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="">Default courier</option>
          {couriers.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const form = new FormData();
              form.set("reference", reference);
              if (courier) form.set("courier", courier);
              setMessage(await pushToCourier(form));
            });
          }}
          className="min-h-11 flex-1 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Sending to courier…" : "Send to courier"}
        </button>
      </div>
      {message && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
          {message}
        </p>
      )}
    </div>
  );
}
