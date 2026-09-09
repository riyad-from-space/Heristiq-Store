"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Menu, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { SearchField } from "@/components/site/search-field";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { nav, site } from "@/config/site";
import { whatsappNumber } from "@/lib/phone";
import { cn } from "@/lib/utils";

/*
 * Sticky header.
 *
 * ONE ground now, not two. It used to render transparent with white text over
 * the home hero, because that hero was a full-bleed dark photograph — and it
 * had to, or the nav would have sat invisibly on navy. The approved design
 * replaces that with a light, boxed hero, so the transparent state has no
 * dark surface left to sit on: keeping it made the entire header white on
 * blush, which is to say gone.
 *
 * What remains is the blush-with-blur ground, gaining a hairline and a soft
 * shadow once the page has scrolled past ~8px, exactly as the mockup does.
 */
export function SiteHeader({ hasPromo = false }: { hasPromo?: boolean }) {
  const { count, ready } = useCart();
  const { count: saved, ready: savedReady } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          "bg-blush/85 text-ink border-b backdrop-blur-[10px] backdrop-saturate-150",
          /* The hairline only appears once scrolled, so the header reads as
             part of the page at rest and as a floating bar in motion. */
          scrolled ? "border-line" : "border-transparent",
          /* A whisper of lift once it is floating over content, so the
             hairline is not the only thing separating it from the page — but
             only in light mode. A dark shadow does nothing on a dark page, so
             there the separation comes from the hairline alone, which the
             token layer has already made visible against the ground. */
          scrolled && "shadow-[0_8px_30px_-22px_rgba(42,33,38,.5)]",
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
                className="nav-wipe text-[0.94rem] font-medium"
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
            <span className="text-rose">.</span>
          </Link>

          {/* Desktop only — see the note in search-field.tsx. */}
          <SearchField className="ml-auto hidden w-[min(260px,30vw)] lg:flex" />

          <div className="flex items-center justify-end gap-0.5">
            <Link
              href="/wishlist"
              aria-label={
                saved > 0 ? `Saved pieces, ${saved} items` : "Saved pieces"
              }
              className="hover:bg-rose-soft duration-quick relative grid size-10 place-items-center rounded-full transition-colors"
            >
              <Heart size={19} strokeWidth={1.8} />
              {/* Same `ready` gate as the cart count: the server cannot know
                  what is in localStorage, so rendering a number during the
                  first client render would not match the server's HTML. */}
              {savedReady && saved > 0 && (
                <span className="tnum bg-rose-deep absolute top-0.5 right-0 grid min-w-[17px] place-items-center rounded-full px-1 text-[0.65rem] leading-[17px] font-bold text-white">
                  {saved}
                </span>
              )}
            </Link>
            <Link
              href="/cart"
              aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
              className="hover:bg-rose-soft duration-quick relative grid size-10 place-items-center rounded-full transition-colors"
            >
              <ShoppingBag size={19} strokeWidth={1.8} />
              {/*
               * `ready` gates this on localStorage having been read. Rendering
               * the count during the first client render would not match the
               * server's HTML, and React would blame the whole header.
               */}
              {ready && count > 0 && (
                <span className="tnum bg-rose-deep absolute top-0.5 right-0 grid min-w-[17px] place-items-center rounded-full px-1 text-[0.65rem] leading-[17px] font-bold text-white">
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
          "bg-blush fixed inset-0 z-40 transition-opacity duration-calm lg:hidden",
          menuOpen
            ? "pointer-events-auto visible opacity-100"
            : "pointer-events-none invisible opacity-0",
        )}
        aria-hidden={!menuOpen}
      >
        <Container className="flex h-full flex-col overflow-y-auto pt-24 pb-10">
          {/* The phone's search lives here rather than in the bar, where a
              field beside a burger, a wordmark, a heart and a cart would be
              about 60px wide. */}
          <SearchField className="mb-7" onSubmitted={closeMenu} />

          <nav className="flex flex-col">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeMenu}
                className="border-line font-display border-b py-4 text-[1.7rem]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/track"
              onClick={closeMenu}
              className="border-line text-copy-sm border-b py-4"
            >
              Track your order
            </Link>
            <Link
              href="/contact"
              onClick={closeMenu}
              className="border-line text-copy-sm border-b py-4"
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
              <Button asChild size="lg" variant="ghost" onClick={closeMenu}>
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
            <p className="text-stone text-copy-sm">
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
