"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { nav, site } from "@/config/site";
import { whatsappNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

/*
 * Sticky header.
 *
 * Two states, and the transition between them is the point: over the home hero
 * it is transparent with white text; everywhere else, and as soon as the page
 * scrolls, it is bone with a hairline. That keeps the hero photograph
 * full-bleed without losing the nav.
 *
 */
export function SiteHeader({ hasPromo = false }: { hasPromo?: boolean }) {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Only the home page has a hero the header can sit over. */
  const overHero = pathname === "/";

  /*
   * The promo strip is above the header and scrolls away with the page, so a
   * fixed header would cover it. `top-9` matches the strip's min-h-9; once the
   * page has scrolled past it the header returns to the top edge.
   */
  const offset = hasPromo && !scrolled ? "top-9" : "top-0";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Tapping a menu link must close the overlay, or it stays over the page it
     just navigated to. Handled on the click rather than in an effect on
     `pathname`: an effect that sets state on every route change re-renders the
     whole header for the many navigations that did not come from the menu. */
  const closeMenu = () => setMenuOpen(false);

  /* Lock the page behind the open menu, and restore whatever was there. */
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const inverted = overHero && !scrolled && !menuOpen;
  const wa = whatsappNumber(site.contact.phone);

  return (
    <>
      {/*
       * The transition list is spelled out property by property, and that is
       * the fix for a real bug: this was `transition-[colors,top]`, which
       * compiles to `transition-property: colors, top`. There is no CSS
       * property called `colors` — Tailwind's `transition-colors` is a
       * shorthand for a list of four — so the whole declaration was invalid
       * and the browser dropped it. Neither the colour NOR the offset
       * animated; the header simply snapped between its two states.
       */}
      <header
        className={cn(
          "fixed inset-x-0 z-50 ease-out-soft",
          "transition-[background-color,border-color,color,top,box-shadow] duration-calm",
          offset,
          inverted
            ? "border-b border-transparent text-white"
            : "border-line bg-bone/90 border-b text-ink backdrop-blur-md",
          /* A whisper of lift once it is floating over content, so the
             hairline is not the only thing separating it from the page. */
          scrolled && !inverted && "shadow-[0_1px_12px_-6px_rgba(23,21,15,0.25)]",
        )}
      >
        {/*
         * Condense on scroll: 64/80px at rest, 56/64px once moving. The
         * height is on the Container because that is what owns the padding,
         * and animating height here rather than on <header> keeps the fixed
         * element's own box out of the transition.
         */}
        <Container
          className={cn(
            "flex items-center justify-between gap-4",
            "transition-[height] duration-calm ease-out-soft",
            scrolled ? "h-14 sm:h-16" : "h-16 sm:h-20",
          )}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-ml-2 grid size-11 place-items-center lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <nav className="hidden items-center gap-8 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-eyebrow decoration-1 underline-offset-8 uppercase hover:underline"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Optically centred on desktop and left-of-centre on a phone,
              where the menu button owns the left edge. It shrinks with the
              header; the transform origin is the centre, so the optical
              centring survives the scale. */}
          <Link
            href="/"
            className={cn(
              "font-display absolute left-1/2 -translate-x-1/2 text-lg tracking-[0.22em] uppercase sm:text-xl",
              "transition-transform duration-calm ease-out-soft",
              scrolled && "scale-90",
            )}
          >
            {site.name}
          </Link>

          <div className="flex items-center justify-end gap-1">
            <Link
              href="/shop"
              aria-label="Search the shop"
              className="hidden size-11 place-items-center sm:grid"
            >
              <Search size={18} />
            </Link>
            <Link
              href="/cart"
              aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
              className="relative -mr-2 grid size-11 place-items-center"
            >
              <ShoppingBag size={19} />
              {/*
               * `ready` gates this on localStorage having been read. Rendering
               * the count during the first client render would not match the
               * server's HTML, and React would blame the whole header.
               */}
              {ready && count > 0 && (
                <span
                  className={cn(
                    "tnum absolute top-1.5 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[0.625rem] leading-4 font-medium",
                    inverted ? "bg-white text-sea" : "bg-ink text-bone",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          </div>
        </Container>
      </header>

      {/* Mobile menu. A full-height panel rather than a dropdown: the nav is
          short, and a panel gives the links a 44px target without cramming. */}
      {/*
       * `invisible` when closed, not merely `opacity-0`.
       *
       * A transparent element is still in the tab order, so a keyboard user
       * tabbing out of the header fell into six invisible menu links, a
       * WhatsApp button and two more links — with no way to see where focus
       * had gone. aria-hidden kept it out of the accessibility tree, which
       * means a screen-reader user was tabbing to targets their own screen
       * reader refused to describe.
       *
       * visibility:hidden removes it from the tab order. The cost is that the
       * fade only plays on the way in — visibility flips discretely — and
       * that is the right trade against unreachable focus.
       */}
      <div
        className={cn(
          "bg-bone fixed inset-0 z-40 transition-opacity duration-calm lg:hidden",
          menuOpen
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0",
        )}
        aria-hidden={!menuOpen}
      >
        <Container className="flex h-full flex-col pt-24 pb-10">
          <nav className="flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="border-line font-display border-b py-5 text-2xl"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/track"
              onClick={closeMenu}
              className="border-line border-b py-5 text-sm"
            >
              Track your order
            </Link>
            <Link
              href="/contact"
              onClick={closeMenu}
              className="border-line border-b py-5 text-sm"
            >
              Contact
            </Link>
          </nav>

          {/*
           * WhatsApp, as a real button at the bottom of the menu.
           *
           * It was reachable only from /contact, the PDP and the order
           * receipt — which means the customer who opened the menu because
           * they had a question had to guess that "Contact" was where the
           * chat lived. This business already takes orders on WhatsApp; the
           * fastest path to a human should not be two taps and an inference.
           */}
          <div className="mt-auto flex flex-col gap-4 pt-8">
            {wa && (
              <Button asChild size="lg" variant="secondary" onClick={closeMenu}>
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon size={18} />
                  Message us on WhatsApp
                </a>
              </Button>
            )}
            <p className="text-ink-muted text-copy-sm">
              Cash on delivery across Bangladesh.
              <br />
              {site.contact.hours}
            </p>
          </div>
        </Container>
      </div>
    </>
  );
}
