"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/components/cart/cart-provider";
import { Container } from "@/components/ui/layout";
import { nav, site } from "@/config/site";
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
export function SiteHeader() {
  const pathname = usePathname();
  const { count, ready } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /* Only the home page has a hero the header can sit over. */
  const overHero = pathname === "/";

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

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
          inverted
            ? "text-white"
            : "border-line bg-bone/95 border-b text-ink backdrop-blur-md",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-4 sm:h-20">
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

          {/* The wordmark is optically centred on desktop and left-of-centre on
              a phone, where the menu button owns the left edge. */}
          <Link
            href="/"
            className="font-display absolute left-1/2 -translate-x-1/2 text-lg tracking-[0.22em] uppercase sm:text-xl"
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
      <div
        className={cn(
          "bg-bone fixed inset-0 z-40 transition-opacity duration-300 lg:hidden",
          menuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
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
          <p className="text-ink-muted mt-auto text-sm">
            Cash on delivery across Bangladesh.
            <br />
            {site.contact.hours}
          </p>
        </Container>
      </div>
    </>
  );
}
