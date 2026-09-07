import { Banknote, Truck, MapPin, RefreshCw } from "lucide-react";
import { StaggerGrid, StaggerItem } from "@/components/motion/reveal";
import { Container } from "@/components/ui/layout";

/*
 * The trust row, directly under the hero.
 *
 * This is the highest-value block on the page for Bangladeshi f-commerce: the
 * reason a first-time buyer abandons is not price, it is not believing the
 * parcel will arrive or that they will have to pay before it does. So COD comes
 * first and is stated in the plainest possible words.
 */
const points = [
  {
    icon: Banknote,
    title: "Cash on delivery",
    body: "Pay the courier when it reaches you. No advance for in-stock pieces.",
  },
  {
    icon: Truck,
    title: "2–4 day delivery",
    body: "Inside Dhaka usually next day. Pathao, Steadfast or RedX.",
  },
  {
    icon: MapPin,
    title: "Tracked all the way",
    body: "A tracking link by SMS, and a status page you can check any time.",
  },
  {
    icon: RefreshCw,
    title: "Wrong or damaged",
    body: "Message us within 3 days with a photo and we replace it.",
  },
];

export function TrustStrip() {
  return (
    <div className="border-line bg-paper border-b">
      <Container className="py-10 sm:py-12">
        {/* The grid moved off <Container> and onto the stagger parent: the
            animating element has to be the one that owns grid-cols, or the
            cells are no longer its direct children. */}
        <StaggerGrid className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {points.map(({ icon: Icon, title, body }) => (
            <StaggerItem key={title} className="flex flex-col gap-2">
              <Icon size={20} className="text-gold" strokeWidth={1.5} />
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="text-ink-muted text-copy-xs">{body}</p>
            </StaggerItem>
          ))}
        </StaggerGrid>
      </Container>
    </div>
  );
}
