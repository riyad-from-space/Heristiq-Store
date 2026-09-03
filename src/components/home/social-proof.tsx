import { Container, Eyebrow, SectionHeading } from "@/components/ui/layout";
import { testimonials } from "@/config/testimonials";

/*
 * Customer messages.
 *
 * Renders nothing when the list is empty, which is the correct state until real
 * quotes exist — see the warning at the top of config/testimonials.ts. A social
 * proof section with invented reviews is worse than no section.
 */
export function SocialProof() {
  if (testimonials.length === 0) return null;

  return (
    <div className="bg-sea py-16 text-bone sm:py-24">
      <Container>
        <div className="max-w-xl">
          <Eyebrow onDark>From the DMs</Eyebrow>
          <SectionHeading className="mt-5 text-bone">
            What people say after it arrives
          </SectionHeading>
        </div>

        <div className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-8">
          {testimonials.map((item) => (
            <blockquote key={item.name} className="flex flex-col">
              <span aria-hidden className="font-display text-3xl text-gold">
                &ldquo;
              </span>
              <p className="mt-2 text-sm leading-relaxed text-bone/85">
                {item.quote}
              </p>
              <footer className="text-eyebrow mt-5 uppercase text-bone/50">
                {item.name} · {item.city}
              </footer>
            </blockquote>
          ))}
        </div>
      </Container>
    </div>
  );
}
