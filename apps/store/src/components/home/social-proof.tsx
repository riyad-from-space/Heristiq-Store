import { Reveal, StaggerGrid, StaggerItem } from "@/components/motion/reveal";
import { Container, Section, SectionHeader } from "@/components/ui/layout";
import { TESTIMONIALS_ARE_REAL, testimonials } from "@/config/testimonials";

/*
 * Customer messages.
 *
 * Renders nothing when the list is empty, which is the correct state until real
 * quotes exist — see the warning at the top of config/testimonials.ts. A social
 * proof section with invented reviews is worse than no section.
 */
export function SocialProof() {
  /*
   * Off unless someone has asserted the quotes are real. The array ships with
   * samples so the section can be designed, and publishing those as genuine
   * customer reviews would be a deception — so it takes a deliberate flag,
   * not merely forgetting to empty an array.
   */
  if (!TESTIMONIALS_ARE_REAL || testimonials.length === 0) return null;

  return (
    <Section tone="sea" as="div">
      <Container>
        <Reveal>
          <SectionHeader
            onDark
            eyebrow="From the DMs"
            title="What people say after it arrives"
          />
        </Reveal>

        <StaggerGrid className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-8">
          {testimonials.map((item) => (
            <StaggerItem key={item.name}>
            <blockquote className="flex flex-col">
              <span aria-hidden className="font-display text-3xl text-gold">
                &ldquo;
              </span>
              <p className="mt-2 text-copy-sm text-bone/85">
                {item.quote}
              </p>
              <footer className="text-eyebrow mt-5 uppercase text-bone/50">
                {item.name} · {item.city}
              </footer>
            </blockquote>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </Container>
    </Section>
  );
}
