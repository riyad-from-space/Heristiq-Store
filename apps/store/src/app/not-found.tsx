import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";

/*
 * 404.
 *
 * A dead end is a chance to send someone to the shop, not a stack trace and an
 * apology. Kept on-brand — most 404s here will be a mistyped product URL or an
 * old link from an Instagram story, and both of those people came to look at
 * jewellery.
 */
export default function NotFound() {
  return (
    <Container width="prose" className="py-20 text-center sm:py-28">
      <Eyebrow className="items-center">404</Eyebrow>
      <SectionHeading as="h1" size="l" className="mt-5">
        This page has wandered off
      </SectionHeading>
      <p className="text-stone mx-auto mt-4 max-w-sm text-copy-sm">
        The link may be old, or the piece may have sold out and been retired.
        The collection is small — everything we sell is one tap away.
      </p>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/shop">See the collection</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/">Back to the shop front</Link>
        </Button>
      </div>

      <p className="text-stone-soft mt-10 text-xs">
        Looking for an order? <Link href="/track" className="underline underline-offset-4">Track it here</Link>
        {" · "}
        Need a hand? <Link href="/contact" className="underline underline-offset-4">Message us</Link>
      </p>
    </Container>
  );
}
