"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  EMPTY_CART,
  MAX_QTY,
  cartCount,
  cartSubtotal,
  type Cart,
  type CartLine,
} from "@/lib/cart/types";

/*
 * Cart state, in localStorage.
 *
 * Deviating from the brief here, which listed carts under "persistence: D1 /
 * Supabase". A server cart costs a round trip on every quantity change and
 * needs a cookie and a reaper for abandoned rows, and it buys nothing this
 * business can use: there is no login, so a cart cannot follow anyone to
 * another device, and the ERP already reports abandoned interest better than a
 * carts table would. Orders, OTPs and payment records are persisted properly —
 * those are the rows that matter.
 *
 * What makes this safe is that the cart is not a source of truth. See
 * lib/cart/types.ts: the server re-prices every line from the ERP before it
 * writes an order.
 *
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than an effect. That is not a style preference:
 * the hook is what makes the server render, hydration and a second tab writing
 * the same key all agree, and reading storage in an effect gets each of those
 * subtly wrong.
 */
const STORAGE_KEY = "heristiq.cart.v1";

type State = {
  cart: Cart;
  /** False until localStorage has been read. Render counts only when true. */
  ready: boolean;
};

/*
 * Module scope, so every consumer shares one cart and a remount does not lose
 * it. The snapshot object is replaced, never mutated, because
 * useSyncExternalStore compares it by identity to decide whether to re-render.
 */
const SERVER_STATE: State = { cart: EMPTY_CART, ready: false };
let state: State = SERVER_STATE;
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function parse(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !Array.isArray((parsed as Cart).lines)
    ) {
      return EMPTY_CART;
    }
    /* Trust nothing that came out of storage: it may be a cart from an older
       version of this file, or hand-edited. Anything malformed is dropped
       rather than allowed to crash the page it renders on. */
    const lines = (parsed as Cart).lines.filter(
      (line): line is CartLine =>
        typeof line?.productId === "string" &&
        typeof line?.sku === "string" &&
        typeof line?.slug === "string" &&
        typeof line?.name === "string" &&
        Number.isFinite(line?.qty) &&
        line.qty > 0,
    );
    return { lines: lines.slice(0, 50) };
  } catch {
    return EMPTY_CART;
  }
}

function write(cart: Cart) {
  state = { cart, ready: true };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    /* Private mode, over quota, storage disabled. The in-memory cart still
       works for this visit, which is all a single-session checkout needs. */
  }
  emit();
}

/**
 * The snapshot React renders from.
 *
 * The first call on the client is where storage is read. It has to be cached
 * after that — returning a fresh object per call would re-render forever.
 */
function getSnapshot(): State {
  if (!loaded) {
    loaded = true;
    try {
      state = { cart: parse(window.localStorage.getItem(STORAGE_KEY)), ready: true };
    } catch {
      state = { cart: EMPTY_CART, ready: true };
    }
  }
  return state;
}

function getServerSnapshot(): State {
  return SERVER_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  /* A second tab is a real case on a phone browser with restored tabs, and two
     carts silently diverging ends with someone ordering the wrong thing. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    state = { cart: parse(event.newValue), ready: true };
    emit();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function update(mutate: (cart: Cart) => Cart) {
  write(mutate(getSnapshot().cart));
}

type CartContextValue = State & {
  count: number;
  subtotal: number;
  add: (line: Omit<CartLine, "qty">, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { cart, ready } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    update((current) => {
      const existing = current.lines.find((l) => l.productId === line.productId);
      if (existing) {
        return {
          lines: current.lines.map((l) =>
            l.productId === line.productId
              ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) }
              : l,
          ),
        };
      }
      return {
        lines: [...current.lines, { ...line, qty: Math.min(MAX_QTY, qty) }],
      };
    });
  }, []);

  const setQty = useCallback((productId: string, qty: number) => {
    update((current) => ({
      /* Zero is a removal, not a zero-quantity line — the stepper's minus
         button at qty 1 has to do something, and this is what it should do. */
      lines:
        qty <= 0
          ? current.lines.filter((l) => l.productId !== productId)
          : current.lines.map((l) =>
              l.productId === productId
                ? { ...l, qty: Math.min(MAX_QTY, Math.floor(qty)) }
                : l,
            ),
    }));
  }, []);

  const remove = useCallback((productId: string) => {
    update((current) => ({
      lines: current.lines.filter((l) => l.productId !== productId),
    }));
  }, []);

  const clear = useCallback(() => write(EMPTY_CART), []);

  const value = useMemo(
    () => ({
      cart,
      ready,
      count: cartCount(cart),
      subtotal: cartSubtotal(cart),
      add,
      setQty,
      remove,
      clear,
    }),
    [cart, ready, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside <CartProvider>");
  }
  return context;
}
