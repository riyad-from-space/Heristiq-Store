import { NewsletterForm } from "@/components/site/newsletter-form";
import { Container, Section, SectionHeading } from "@/components/ui/layout";

/*
 * "Be first to the next drop".
 *
 * The form itself is unchanged in behaviour — it still writes to
 * storefront_subscribers through the existing server action, and an address
 * already on the list still reports plain success rather than announcing who
 * is subscribed. What changed is where it lives: the mockup gives it its own
 * sand-coloured section, where it used to be a cramped column inside the
 * footer sharing space with three link lists.
 *
 * That is worth more than the styling. A newsletter field in a footer is
 * furniture; one with its own band, a heading and a reason to sign up is an
 * actual ask.
 */
export function NewsletterSection() {
  return (
    <Section tone="sand" as="div">
      <Container>
        <div className="mx-auto max-w-[620px] text-center">
          <SectionHeading>Be first to the next drop</SectionHeading>
          <p className="text-copy text-stone mt-3">
            Early access and styling notes, straight to your inbox. Nothing
            else.
          </p>

          <NewsletterForm className="mt-7" />

          <p className="text-copy-xs text-stone mt-1">
            By joining you agree to hear from Heristiq. Unsubscribe anytime.
          </p>
        </div>
      </Container>
    </Section>
  );
}
