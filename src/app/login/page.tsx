"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action={action}
        className="w-full max-w-sm space-y-4 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div>
          <h1 className="text-lg font-semibold">Heristiq ERP</h1>
          <p className="text-sm text-neutral-500">Sign in to continue</p>
        </div>

        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>

        <Field label="Password">
          <Input
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}
