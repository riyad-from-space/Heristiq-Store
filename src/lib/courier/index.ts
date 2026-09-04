import "server-only";
import { courierEnv } from "@/lib/env";
import type { CourierProvider } from "@/lib/courier/provider";
import { SteadfastProvider } from "@/lib/courier/steadfast";
import { PathaoProvider } from "@/lib/courier/pathao";
import { RedxProvider } from "@/lib/courier/redx";
import { DemoCourierProvider } from "@/lib/courier/demo";
import type { CourierKey } from "@/lib/orders/types";

/*
 * Which courier carries a parcel.
 *
 * One factory, so no page, action or route ever names a provider class. The
 * tracking page in particular knows only CourierStatus — it renders the same
 * five-step rail whichever of these answered.
 */
const providers: Record<CourierKey, () => CourierProvider> = {
  steadfast: () => new SteadfastProvider(),
  pathao: () => new PathaoProvider(),
  redx: () => new RedxProvider(),
};

const cache = new Map<CourierKey, CourierProvider>();

export function courier(key?: CourierKey | null): CourierProvider {
  /* No preference means the default, which is the one with credentials. */
  const resolved = key ?? courierEnv.defaultCourier;
  const existing = cache.get(resolved);
  if (existing) return existing;

  const real = providers[resolved]();

  /*
   * With no courier credentials outside production, hand back a courier that
   * pretends — so the push, the tracking page and the status rail can be
   * walked on a fresh clone. See lib/courier/demo.ts.
   *
   * Both halves of this condition matter. In production an unconfigured
   * courier must fail loudly at the push rather than silently invent a
   * consignment id for a parcel nobody collected.
   */
  const created =
    !real.configured && process.env.NODE_ENV !== "production"
      ? new DemoCourierProvider(resolved)
      : real;

  cache.set(resolved, created);
  return created;
}

/**
 * Every courier we could actually ship with today.
 *
 * Used by phase 6's admin to decide what to offer, and worth reading as the
 * honest answer to "which of these three works": whichever ones have
 * credentials AND an implementation.
 */
export function availableCouriers(): CourierProvider[] {
  return (Object.keys(providers) as CourierKey[])
    .map((key) => courier(key))
    .filter((provider) => provider.configured);
}

export type { CourierProvider } from "@/lib/courier/provider";
