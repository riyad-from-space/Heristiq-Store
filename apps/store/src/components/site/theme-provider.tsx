"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  isThemeChoice,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeChoice,
} from "@/lib/theme";

/*
 * Theme state.
 *
 * Modelled on cart-provider.tsx, and for the same reason stated there:
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than an effect. That hook is what makes the
 * server render, hydration, and a second tab changing the theme all agree.
 * Reading storage in an effect gets each of those subtly wrong, and the
 * failure here would be visible — a theme that flips on the second render.
 *
 * Two things are tracked, and conflating them is the usual bug:
 *
 *   choice   — what the customer picked: light, dark, or system.
 *   resolved — what that means at this moment: light or dark.
 *
 * A control that only stores the resolved value cannot express "follow my
 * phone", so it silently stops following when the phone switches at sunset.
 * The two are kept separate all the way to the toggle.
 */

type State = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  /** False until localStorage has been read. See the note in the toggle. */
  ready: boolean;
};

/*
 * Module scope, so every consumer shares one theme and a remount does not
 * lose it. The snapshot object is replaced, never mutated, because
 * useSyncExternalStore compares it by identity to decide whether to re-render.
 *
 * The server snapshot claims `light`/not-ready. It is never rendered as truth:
 * the toggle renders nothing theme-dependent until `ready`, and the actual
 * colours come from CSS that the pre-paint script has already resolved.
 */
const SERVER_STATE: State = { choice: "system", resolved: "light", ready: false };
let state: State = SERVER_STATE;
let loaded = false;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** The OS preference, or light where it cannot be asked. */
function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    /* Anything unrecognised — a value from an older version of this file, or
       hand-edited — falls back to system rather than crashing or sticking. */
    return isThemeChoice(raw) ? raw : "system";
  } catch {
    /* localStorage throws, not returns null, when site data is blocked. */
    return "system";
  }
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  return choice === "system" ? systemTheme() : choice;
}

/**
 * Reflect the current state into the document.
 *
 * The attribute is REMOVED for `system`, not set to a value. globals.css
 * resolves an absent attribute with prefers-color-scheme, which is what makes
 * "follow my phone" keep working — including with JavaScript disabled. See
 * the note in lib/theme.ts.
 */
function apply(next: State) {
  const root = document.documentElement;
  if (next.choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", next.choice);
  }

  /*
   * Patch the theme-color meta tag.
   *
   * layout.tsx declares one per prefers-color-scheme, which covers `system`
   * correctly and cannot cover an explicit override — a customer on a light
   * phone who chose dark would get a bone-coloured browser bar above a dark
   * page. Metadata is static; only the client knows the override exists, so
   * only the client can fix it.
   */
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]:not([media])',
  );
  const colour = THEME_COLOR[next.resolved];
  if (meta) {
    meta.content = colour;
  } else {
    const tag = document.createElement("meta");
    tag.name = "theme-color";
    tag.content = colour;
    document.head.appendChild(tag);
  }
}

function set(next: State) {
  state = next;
  apply(next);
  emit();
}

function subscribe(listener: () => void) {
  /*
   * First subscriber loads from storage. Doing it here rather than at module
   * scope keeps the module import side-effect-free, which matters because
   * this file is also imported during server rendering.
   */
  if (!loaded) {
    loaded = true;
    const choice = readChoice();
    state = { choice, resolved: resolve(choice), ready: true };
    /* No apply() here: the pre-paint script has already set the attribute for
       an explicit choice, and re-setting it during hydration would be a
       redundant DOM write on every page load. */
  }

  listeners.add(listener);

  /* Follow the OS while the choice is `system`, so a phone switching to dark
     at sunset switches the shop too, without a reload. */
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (state.choice !== "system") return;
    set({ ...state, resolved: systemTheme() });
  };
  media?.addEventListener("change", onSystemChange);

  /* And follow other tabs. A customer with the shop open twice should not see
     two different themes. `storage` fires only in the OTHER tab, which is
     exactly the semantics wanted here. */
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const choice = readChoice();
    set({ choice, resolved: resolve(choice), ready: true });
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    media?.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => SERVER_STATE;

/**
 * Read and set the theme.
 *
 * No context provider: the store is module-scoped, so any component can call
 * this without an ancestor. That is deliberate — a provider around the tree
 * would make the root layout a client component, and the whole point of the
 * cache-preserving design in lib/theme.ts is that the server tree stays
 * server-rendered.
 */
export function useTheme() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setChoice = useCallback((choice: ThemeChoice) => {
    try {
      /* `system` is stored explicitly rather than removed, so that choosing
         it is distinguishable from never having chosen — a distinction the
         pre-paint script relies on to leave the attribute off. */
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
      /* Blocked site data: the theme still applies for this page view, it
         just will not be remembered. Better than refusing to switch. */
    }
    set({ choice, resolved: resolve(choice), ready: true });
  }, []);

  return { ...snapshot, setChoice };
}
