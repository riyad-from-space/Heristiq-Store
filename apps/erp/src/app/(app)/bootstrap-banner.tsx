"use client";

import { useState, useTransition } from "react";
import { claimAdmin } from "./admin-actions";

/*
 * Shown while nobody has claimed admin access.
 *
 * This is the state where any signed-in Supabase user can reach the ERP, so
 * the banner is loud on purpose and does not offer a dismiss. One click ends
 * it: the current user becomes the only administrator and the database starts
 * refusing everyone else.
 */
export function BootstrapBanner({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-b border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            The ERP is open to any signed-in account
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            No administrator has been set, so anyone who registers can reach
            this data. Claim it as{" "}
            <span className="font-medium">{email}</span> to lock everyone else
            out.
            {error && <span className="mt-1 block font-medium">{error}</span>}
          </p>
        </div>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => setError(await claimAdmin()))
          }
          className="min-h-10 shrink-0 rounded-lg bg-amber-900 px-4 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-200 dark:text-amber-950"
        >
          {pending ? "Locking down…" : "Make me the administrator"}
        </button>
      </div>
    </div>
  );
}
