import { Banknote, Truck, MapPin, RefreshCw } from "lucide-react";
import { Container } from "@/components/ui/layout";
import { courier } from "@/config/site";

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
    body: `Inside Dhaka usually next day, by ${courier.label}.`,
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
    /* Hairlines top AND bottom, on the blush base — the mockup's treatment.
       It reads as a band without introducing a fourth surface colour. */
    <div className="border-line bg-blush border-y">
      <Container className="py-9 sm:py-10">
        <div className="grid grid-cols-2 gap-x-7 gap-y-7 lg:grid-cols-4">
          {points.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              {/* A rounded tile rather than a bare icon: it gives the rose
                  somewhere to sit at a size the eye reads as deliberate. */}
              <span className="bg-rose-soft text-rose-deep grid size-11 shrink-0 place-items-center rounded-[12px]">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-[0.98rem] font-bold">{title}</h3>
                <p className="text-stone text-copy-xs mt-0.5">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
