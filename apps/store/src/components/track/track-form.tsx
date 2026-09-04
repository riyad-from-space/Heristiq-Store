"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2, PackageSearch, Search } from "lucide-react";
import { trackOrderAction, type TrackResult } from "@/app/track/actions";
import { StatusRail } from "@/components/track/status-rail";
import { Field, Input } from "@/components/checkout/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { site } from "@/config/site";
import { dateTimeDhaka, taka } from "@/lib/format";
import { isValidPhone, whatsappNumber } from "@/lib/phone";

/*
 * The tracking screen.
 *
 * Two fields, one button, and the answer appears underneath — no navigation,
 * so a customer who mistyped their phone does not lose the order number too.
 * Prefilled from the query string when the confirmation page links here, which
 * makes the common path a single tap.
 */
export function TrackForm({
  initialReference = "",
}: {
  initialReference?: string;
}) {
  const [reference, setReference] = useState(initialReference);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      setResult(await trackOrderAction(reference, phone));
    });
  };

  const wa = whatsappNumber(site.contact.phone);

  return (
    <div>
      <form
        className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        <Field label="Order number" htmlFor="reference">
          <Input
            id="reference"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="HQ-01042"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>

        <Field label="Mobile number" htmlFor="track-phone">
          <Input
            id="track-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={pending || !reference.trim() || !isValidPhone(phone)}
          className="sm:mb-0"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Track
        </Button>
      </form>

      {result && !result.ok && (
        <p role="alert" className="border-danger/30 bg-danger/5 text-danger mt-8 border px-4 py-3 text-sm leading-relaxed">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <div className="mt-10">
          <div className="border-line flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b pb-4">
            <div>
              <p className="font-display text-display-s">{result.reference}</p>
              <p className="text-ink-faint mt-1 text-xs">
                Placed {dateTimeDhaka(result.placedAt)}
              </p>
            </div>
            {result.hasPreOrder && <Badge tone="sea">Includes a pre-order</Badge>}
          </div>

          <div className="mt-8">
            {result.status ? (
              <StatusRail status={result.status} />
            ) : (
              /*
               * Placed but not yet handed over. Not an error and not a rail
               * frozen at step one — the parcel genuinely has not moved, and
               * saying so beats implying the courier has it.
               */
              <div className="border-line bg-paper flex items-start gap-3 border px-4 py-4">
                <PackageSearch size={18} className="text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Being packed</p>
                  <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                    Not with a courier yet. We call to confirm before it ships,
                    and tracking appears here the moment it is collected.
                  </p>
                </div>
              </div>
            )}
          </div>

          <dl className="mt-8 grid gap-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-eyebrow text-ink-faint uppercase">In the parcel</dt>
              <dd className="mt-2 leading-relaxed">
                {result.lines.map((line) => (
                  <span key={line.name} className="block">
                    {line.name}
                    {line.qty > 1 && ` × ${line.qty}`}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow text-ink-faint uppercase">To pay</dt>
              <dd className="tnum mt-2">
                {result.amountDue > 0 ? `${taka(result.amountDue)} in cash` : "Paid"}
              </dd>
            </div>
            <div>
              <dt className="text-eyebrow text-ink-faint uppercase">Courier</dt>
              <dd className="mt-2 leading-relaxed">
                {result.courierLabel ?? "Not assigned yet"}
                {result.trackingCode && (
                  <>
                    <br />
                    <span className="text-ink-muted tnum text-xs">
                      {result.trackingCode}
                    </span>
                  </>
                )}
                {result.lastUpdatedAt && (
                  <>
                    <br />
                    <span className="text-ink-faint text-xs">
                      Updated {dateTimeDhaka(result.lastUpdatedAt)}
                    </span>
                  </>
                )}
              </dd>
            </div>
          </dl>

          {wa && (
            <Button asChild variant="secondary" size="lg" className="mt-10 w-full sm:w-auto">
              <a
                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi Heristiq, about order ${result.reference}:`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon size={17} />
                Ask about this order
              </a>
            </Button>
          )}
        </div>
      )}

      {!result && (
        <p className="text-ink-faint mt-8 text-xs leading-relaxed">
          Your order number is in the confirmation we showed you after checkout
          — it looks like HQ-01042. Lost it?{" "}
          <Link href="/contact" className="underline underline-offset-4">
            Message us
          </Link>{" "}
          and we will find it from your phone number.
        </p>
      )}
    </div>
  );
}
