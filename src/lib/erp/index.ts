import "server-only";
import { erpEnv } from "@/lib/env";
import type { ErpClient } from "@/lib/erp/client";
import { MockErpClient } from "@/lib/erp/mock";
import { SupabaseErpClient } from "@/lib/erp/erp-client";

/*
 * One place decides which catalogue the site is reading.
 *
 * Falling back to the mock rather than throwing is deliberate: a fresh clone
 * with no .env.local should still render the whole storefront, so the design
 * can be worked on and the build can be verified. The admin footer shows which
 * source answered so "why is stock wrong" is never a mystery.
 */
let cached: ErpClient | null = null;

export function erp(): ErpClient {
  if (cached) return cached;
  cached =
    erpEnv.configured && !erpEnv.forceMock
      ? new SupabaseErpClient()
      : new MockErpClient();
  return cached;
}

/** True when the site is showing real ERP prices and stock. */
export function erpIsLive() {
  return erp().source === "erp";
}

export type { ErpClient } from "@/lib/erp/client";
