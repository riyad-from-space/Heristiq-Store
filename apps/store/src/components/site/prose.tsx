import type { ReactNode } from "react";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";

/*
 * The shell every written page uses — About, Contact, Shipping, Size guide,
 * Policies.
 *
 * One component so the six of them cannot drift into six slightly different
 * headers, measures and rhythms, which is exactly what happens when static
 * pages are written one at a time. It also fixes the measure at ~65
 * characters; a policy page at full container width is unreadable on a
 * desktop and looks unconsidered.
 */
export function ProsePage({
  eyebrow,
  title,
  lede,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
  /** Optional block under the lede — a notice, or contact shortcuts. */
  aside?: ReactNode;
}) {
  return (
    <Container width="prose" className="py-10 sm:py-16">
      <header>
        <Eyebrow>{eyebrow}</Eyebrow>
        <SectionHeading as="h1" size="l" className="mt-5">
          {title}
        </SectionHeading>
        {lede && (
          <p className="text-ink-muted mt-5 text-base leading-relaxed">
            {lede}
          </p>
        )}
      </header>

      {aside && <div className="mt-8">{aside}</div>}

      {/*
       * `prose-heristiq` is defined in globals.css rather than using a
       * typography plugin: the site has its own type scale and a plugin's
       * opinions would fight it.
       */}
      <div className="prose-heristiq mt-10 sm:mt-12">{children}</div>
    </Container>
  );
}

/** A section inside a prose page. h2 in the display serif, with a rule. */
export function ProseSection({
  title,
  id,
  children,
}: {
  title: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-line mt-10 border-t pt-8 first:mt-0 first:border-0 first:pt-0">
      <h2 id={id} className="font-display text-display-s scroll-mt-24">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A dated "last updated" line for policy pages. */
export function LastUpdated({ date }: { date: string }) {
  return (
    <p className="text-ink-faint border-line mt-12 border-t pt-6 text-xs">
      Last updated {date}. We will post any change here.
    </p>
  );
}
