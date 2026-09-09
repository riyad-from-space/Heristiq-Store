import Link from "next/link";
import { Reveal, StaggerGrid, StaggerItem } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { site } from "@/config/site";
import { dayRange, taka } from "@/lib/format";
import { whatsappNumber } from "@/lib/phone";
import { deliveryTerms } from "@/lib/delivery.server";

/*
 * How ordering works.
 *
 * This section exists because of a hole and a rule.
 *
 * The hole: the home page went straight from the motif story to the Instagram
 * strip, because the social-proof band between them renders nothing — and
 * correctly so. config/testimonials.ts ships sample quotes behind
 * TESTIMONIALS_ARE_REAL, which is false, because publishing invented reviews
 * as genuine is deceptive and in most markets unlawful. So the page had a
 * missing beat and, worse, was missing it exactly where a first-time buyer
 * decides whether to trust the shop.
 *
 * The rule: whatever fills that hole has to be TRUE. Not "trusted by 5,000
 * customers", not five gold stars, not a fabricated review. So this is the
 * ordering process, stated plainly, with the fees and timings read from the
 * same settings the checkout charges from — which means it cannot quietly go
 * stale when the owner changes a delivery fee in the ERP.
 *
 * For a cash-on-delivery buyer that is better social proof than a testimonial
 * would be anyway. The hesitation is never "is this pretty", it is "will a
 * stranger from Instagram actually send me a parcel, and do I have to pay
 * first". Answering both in three steps is the whole job.
 *
 * When real quotes exist, <SocialProof> turns itself on and sits below this;
 * the two do different work and both can stay.
 */
export async function HowItWorks() {
  const terms = await deliveryTerms();
  const wa = whatsappNumber(site.contact.phone);

  const steps = [
    {
      n: "01",
      title: "Pick your piece",
      body: "Add it to the cart. Nothing is charged and nothing is reserved until you confirm.",
    },
    {
      n: "02",
      title: "Confirm your number",
      body: "We text a code to your mobile. It is how we make sure the parcel and the tracking link reach the right person.",
    },
    {
      n: "03",
      title: "Pay the courier",
      body: `Cash, at your door, when it arrives — ${dayRange(
        terms.insideDays.min,
        terms.insideDays.max,
      )} inside Dhaka and ${dayRange(
        terms.outsideDays.min,
        terms.outsideDays.max,
      )} outside. Nothing in advance for in-stock pieces.`,
    },
  ];

  return (
    <Section tone="inverted" as="div">
      <Container>
        <Reveal>
          <SectionHeader
            onDark
            eyebrow="Ordering"
            title="No advance, no card, no account"
            lede="You have probably been asked to send bKash to a page you had never heard of. We do not work that way for anything we have in stock."
          />
        </Reveal>

        <StaggerGrid className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-8">
          {steps.map((step) => (
            <StaggerItem key={step.n} className="flex flex-col">
              <span
                aria-hidden
                className="font-display text-gold/70 text-2xl"
                /* Decorative: the step order is already carried by the list
                   order and the headings, so a screen reader gains nothing
                   from hearing "zero one". */
              >
                {step.n}
              </span>
              <h3 className="text-on-inverted mt-3 text-sm font-medium">
                {step.title}
              </h3>
              <p className="text-copy-sm text-on-inverted/70 mt-2">{step.body}</p>
            </StaggerItem>
          ))}
        </StaggerGrid>

        <Reveal className="border-on-inverted/10 mt-12 flex flex-col gap-6 border-t pt-8 sm:mt-16 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-copy-sm text-on-inverted/70 max-w-md">
            Delivery is {taka(terms.insideDhakaFee)} inside Dhaka and{" "}
            {taka(terms.outsideDhakaFee)} outside
            {terms.freeThreshold > 0 && (
              <>, free over {taka(terms.freeThreshold)}</>
            )}
            . Pre-orders are the one exception: those take a small advance, and
            we confirm the restock date before taking anything.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="gold">
              <Link href="/shop">Start shopping</Link>
            </Button>
            {/* WhatsApp as the alternative, because a good share of this
                market would rather ask a person than fill in a form — and
                they are buying either way. */}
            {wa && (
              <Button asChild variant="onDark">
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <WhatsAppIcon size={17} />
                  Ask us anything
                </a>
              </Button>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
