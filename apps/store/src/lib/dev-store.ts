import "server-only";

/*
 * One instance of a development store per PROCESS, not per module graph.
 *
 * The bug this fixes, because it is not obvious: module-level state is scoped
 * to a module instance, and a server action, a route handler and a page can be
 * bundled into separate module graphs. So `const rows = new Map()` at the top
 * of a file gives the checkout action and the courier API route two different
 * maps — the action places an order into one and the route looks for it in the
 * other and reports it missing.
 *
 * Hanging it off globalThis is the standard Next.js answer (the same trick
 * used to keep one database client across dev hot reloads) and it also
 * survives a hot reload, which module scope does not.
 *
 * Only the credential-free fallbacks use this: the mock catalogue's orders, the
 * memory OTP store, the memory shipment store and the demo courier. Nothing
 * that runs in production depends on it, because a single process is not a
 * durability model — on Workers the next request may be a different isolate
 * entirely, which is exactly why the real implementations use Postgres.
 */
const registry = Symbol.for("heristiq.dev-store");

type Registry = Map<string, unknown>;

function store(): Registry {
  const host = globalThis as typeof globalThis & { [registry]?: Registry };
  host[registry] ??= new Map();
  return host[registry];
}

export function devStore<T>(key: string, create: () => T): T {
  const existing = store();
  if (!existing.has(key)) existing.set(key, create());
  return existing.get(key) as T;
}
