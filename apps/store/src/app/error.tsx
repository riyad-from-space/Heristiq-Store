"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";

/*
 * The error boundary for the whole storefront.
 *
 * Two things it must do and one it must not. It must offer a retry, because
 * most of what lands here is a transient database read on a page that would
 * work a second later. It must give a way out that is not the back button. It
 * must NOT show the customer the error message — that text can contain a
 * table name, a column, or a connection string, and none of it means anything
 * to them anyway. The digest is enough to find it in the logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[storefront] unhandled error", error);
  }, [error]);

  return (
    <Container width="prose" className="py-20 text-center sm:py-28">
      <Eyebrow className="items-center">Something broke</Eyebrow>
      <SectionHeading as="h1" size="l" className="mt-5">
        That did not work
      </SectionHeading>
      <p className="text-ink-muted mx-auto mt-4 max-w-sm text-copy-sm">
        Sorry — something went wrong at our end, not yours. Trying again usually
        fixes it.
      </p>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button size="lg" onClick={reset}>
          <RotateCw size={16} />
          Try again
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/shop">Back to the shop</Link>
        </Button>
      </div>

      <p className="text-ink-faint mt-10 text-copy-xs">
        If it keeps happening,{" "}
        <Link href="/contact" className="underline underline-offset-4">
          tell us
        </Link>
        {error.digest && (
          <>
            {" "}
            and quote <span className="tnum">{error.digest}</span>
          </>
        )}
        . If you were placing an order, please check on WhatsApp before trying
        again so it is not sent twice.
      </p>
    </Container>
  );
}
