"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/*
 * The wishlist, in localStorage.
 *
 * Deliberately per-device rather than per-account, because there are no
 * accounts: checkout is phone-OTP only, by design, so there is no identity to
 * hang a server-side wishlist off. A Supabase table would need customer auth
 * the site does not have and does not want.
 *
 * The trade is honest and worth stating: a save does not follow someone from
 * their phone to their laptop. What it does do is survive a reload, a
 * navigation and a closed tab, which is what "save this for later" actually
 * means to someone browsing Instagram at midnight.
 *
 * Modelled on cart-provider.tsx down to the shape, and for the same reason
 * stated there: localStorage is an external store, so it is read through
 * useSyncExternalStore rather than an effect. That hook is what makes the
 * server render, hydration, and a second tab writing the same key all agree.
 * Reading storage in an effect gets each of those subtly wrong, and here the
 * failure would be visible — hearts that fill in a beat after the page paints.
 *
 * Nothing here is a source of truth about anything but intent. Prices, stock
 * and availability are always re-read from the ERP; a wishlist entry is just
 * an id.
 */
const STORAGE_KEY = "heristiq.wishlist.v1";

/** How many saves to keep. Generous, but bounded so storage cannot grow forever. */
const MAX_ITEMS = 100;

type State = {
  /** Product ids, newest first. */
  ids: string[];
  /** False until localStorage has been read. Render hearts only when true. */
  ready: boolean;
};

/*
 * Module scope, so every consumer shares one list and a remount does not lose
 * it. The snapshot object is replaced, never mutated, because
 * useSyncExternalStore compares it by identity to decide whether to re-render.
 */
const SERVER_STATE: State = { ids: [], ready: false };
let state: State = SERVER_STATE;
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    /* Trust nothing that came out of storage: it may be from an older version
       of this file, or hand-edited. Anything malformed is dropped rather than
       allowed to crash the page it renders on. */
    return parsed
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function persist(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* localStorage THROWS, rather than returning null, when a browser is set
       to block site data. The heart still works for this page view; it just
       will not be remembered. Better than refusing to save. */
  }
}

function update(next: (current: string[]) => string[]) {
  const ids = next(state.ids).slice(0, MAX_ITEMS);
  state = { ids, ready: true };
  persist(ids);
  emit();
}

function subscribe(listener: () => void) {
  /* First subscriber loads from storage. Doing it here rather than at module
     scope keeps the import side-effect-free, which matters because this file
     is also evaluated during server rendering. */
  if (!loaded) {
    loaded = true;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      raw = null;
    }
    state = { ids: parse(raw), ready: true };
  }

  listeners.add(listener);

  /* Follow other tabs. Someone with the shop open twice should not see two
     different wishlists. `storage` fires only in the OTHER tab, which is
     exactly the semantics wanted. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = { ids: parse(event.newValue), ready: true };
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

type WishlistApi = {
  ids: string[];
  count: number;
  ready: boolean;
  has: (id: string) => boolean;
  /** Adds or removes, and returns the state it ended up in. */
  toggle: (id: string) => boolean;
  remove: (id: string) => void;
};

const WishlistContext = createContext<WishlistApi | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { ids, ready } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  /* A Set for lookups: a product grid asks `has` once per card, and on the
     shop page that is nine linear scans per render otherwise. */
  const set = useMemo(() => new Set(ids), [ids]);

  const has = useCallback((id: string) => set.has(id), [set]);

  const toggle = useCallback(
    (id: string) => {
      const next = !set.has(id);
      update((current) =>
        next ? [id, ...current.filter((x) => x !== id)] : current.filter((x) => x !== id),
      );
      return next;
    },
    [set],
  );

  const remove = useCallback((id: string) => {
    update((current) => current.filter((x) => x !== id));
  }, []);

  const value = useMemo<WishlistApi>(
    () => ({ ids, count: ids.length, ready, has, toggle, remove }),
    [ids, ready, has, toggle, remove],
  );

  return (
    <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used inside <WishlistProvider>");
  }
  return context;
}
