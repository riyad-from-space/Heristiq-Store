import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, MessageCircle, Package, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";
import { site } from "@/config/site";
import { erp, erpIsLive } from "@/lib/erp";
import { formatAddress } from "@/lib/bd-geo";
import { dateTimeDhaka, taka } from "@/lib/format";
import { displayPhone, whatsappNumber } from "@/lib/phone";
import { COURIERS, PAYMENT_METHODS, amountDue } from "@/lib/orders/types";

/*
 * Order confirmation.
 *
 * Keyed on the order's public token, never on its reference. References are
 * sequential — HQ-01001, HQ-01002 — so a page addressed by one would let anyone
 * walk the numbers and read every customer's name, phone number and home
 * address. The token is 16 random bytes and means nothing.
 *
 * Rendered fresh every time, and never cached: it contains one person's
 * address, and a cached copy of that is a copy of it served to someone else.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderPage({
  params,
}: PageProps<"/order/[token]">) {
  const { token } = await params;
  const order = await erp().getOrder(token);
  if (!order) notFound();

  const due = amountDue(order);
  const wa = whatsappNumber(site.contact.phone);
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi Heristiq, about order ${order.reference}:`,
      )}`
    : null;

  return (
    <Container width="prose" className="py-10 sm:py-16">
      {!erpIsLive() && (
        /*
         * The mock keeps orders in memory so checkout can be exercised without
         * credentials. Saying so here is not optional: a confirmation page that
         * looks real for an order nobody will ever pack is the one outcome
         * this whole flow must not produce.
         */
        <div className="border-warn/40 bg-warn/5 text-warn mb-8 border border-dashed px-4 py-3 text-sm leading-relaxed">
          <strong className="font-medium">Demo mode.</strong> No ERP credentials
          are configured, so this order exists only in this server&apos;s memory
          and nobody has been notified. Set <code>SUPABASE_URL</code> and{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> to record orders for real.
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="bg-success/10 text-success grid size-10 shrink-0 place-items-center rounded-full">
          <Check size={20} strokeWidth={2.5} />
        </span>
        <Eyebrow rule={false}>Order placed</Eyebrow>
      </div>

      <SectionHeading as="h1" size="l" className="mt-5">
        Thank you, {order.customerName.split(" ")[0]}.
      </SectionHeading>

      <p className="text-ink-muted mt-4 leading-relaxed">
        Your order is <strong className="text-ink font-medium">{order.reference}</strong>.
        We will call{" "}
        {/* A phone number broken across two lines is unreadable, and this one
            is the thing the customer most needs to check. */}
        <span className="whitespace-nowrap">
          {displayPhone(order.customerPhone)}
        </span>{" "}
        to confirm before it ships — usually the same day.
      </p>

      {order.hasPreOrder && (
        <div className="border-sea/20 bg-sea/5 mt-6 border px-4 py-3">
          <p className="text-sm font-medium">This order includes a pre-order</p>
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            One piece is being restocked. We will confirm the date when we call,
            and nothing is charged until it ships.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------- lines */}
      <div className="border-line bg-paper mt-10 border">
        <ul className="divide-line divide-y">
          {order.lines.map((line) => (
            <li
              key={line.sku}
              className="flex items-start justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0">
                <p className="text-sm leading-snug">{line.name}</p>
                <p className="text-ink-faint tnum mt-1 text-xs">
                  {line.sku} · qty {line.qty}
                </p>
                {line.isPreOrder && (
                  <Badge tone="sea" className="mt-2">
                    Pre-order
                  </Badge>
                )}
              </div>
              <p className="tnum shrink-0 text-sm">
                {taka(line.unitPrice * line.qty)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="border-line space-y-2.5 border-t px-5 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt>Subtotal</dt>
            <dd className="tnum">{taka(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Delivery</dt>
            <dd className="tnum">
              {order.deliveryFee === 0 ? (
                <span className="text-success">Free</span>
              ) : (
                taka(order.deliveryFee)
              )}
            </dd>
          </div>
          {order.amountPaid > 0 && (
            <div className="flex justify-between gap-4">
              <dt>Paid in advance</dt>
              <dd className="tnum text-success">−{taka(order.amountPaid)}</dd>
            </div>
          )}
        </dl>

        <div className="border-line flex items-baseline justify-between gap-4 border-t px-5 py-4">
          <span className="font-display text-base">
            {due > 0 ? "Pay on delivery" : "Total"}
          </span>
          <span className="font-display tnum text-xl">{taka(due || order.total)}</span>
        </div>
      </div>

      {/* -------------------------------------------------------- details */}
      <dl className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <dt className="text-eyebrow text-ink-faint uppercase">Delivering to</dt>
          <dd className="mt-2 text-sm leading-relaxed">
            {order.customerName}
            <br />
            {formatAddress(order.address)}
            <br />
            <span className="whitespace-nowrap">
              {displayPhone(order.customerPhone)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-eyebrow text-ink-faint uppercase">Payment</dt>
          <dd className="mt-2 text-sm leading-relaxed">
            {PAYMENT_METHODS[order.paymentMethod]}
            <br />
            <span className="text-ink-muted">
              {order.courierPreference
                ? `By ${COURIERS[order.courierPreference]}`
                : "By whichever courier is fastest"}
            </span>
            <br />
            <span className="text-ink-faint text-xs">
              Placed {dateTimeDhaka(order.placedAt)}
            </span>
          </dd>
        </div>
      </dl>

      {/* ------------------------------------------------------ next steps */}
      <div className="border-line mt-10 border-t pt-8">
        <h2 className="font-display text-display-s">What happens now</h2>
        <ol className="mt-5 space-y-4 text-sm">
          <Step icon={<Phone size={16} />} title="We call to confirm">
            A quick call to{" "}
            <span className="whitespace-nowrap">
              {displayPhone(order.customerPhone)}
            </span>{" "}
            to check the address. Please pick up — unconfirmed orders are not
            shipped.
          </Step>
          <Step icon={<Package size={16} />} title="It ships">
            You get a tracking code by SMS once the courier collects it.
          </Step>
          <Step icon={<Check size={16} />} title="Pay the rider">
            {taka(due)} in cash at the door.
          </Step>
        </ol>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        {waHref && (
          <Button asChild size="lg" variant="secondary" className="flex-1">
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon size={17} />
              Message us about this order
            </a>
          </Button>
        )}
        <Button asChild size="lg" className="flex-1">
          <Link href="/shop">Keep shopping</Link>
        </Button>
      </div>

      <p className="text-ink-faint mt-8 flex items-start gap-2 text-xs leading-relaxed">
        <MessageCircle size={14} className="mt-0.5 shrink-0" />
        Keep this page — the link is the only way back to it. Order{" "}
        {order.reference} is also all we need to find you.
      </p>
    </Container>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="text-gold mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-ink-muted mt-1 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
