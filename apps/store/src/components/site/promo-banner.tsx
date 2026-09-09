import Link from "next/link";
import type { PromoSetting } from "@/lib/settings";

/*
 * The announcement strip above the header.
 *
 * Server-rendered from storefront_settings, so the owner turns it on and edits
 * the words from the ERP without a deploy — which is the whole reason it is a
 * setting and not a constant. Renders nothing when it is off or has no words,
 * so the header sits flush and nothing shifts.
 *
 * The mockup sets one phrase of this in rose to draw the eye. That phrase is
 * the LINK, when there is one, rather than an arbitrary span: the setting is a
 * single string, so there is no field that says which words to emphasise, and
 * inventing one would mean a schema change for a colour. Making the link the
 * emphasised part gives the mockup's two-tone strip out of data that already
 * exists — and puts the emphasis on the only part that does anything.
 */
export function PromoBanner({ promo }: { promo: PromoSetting }) {
  if (!promo.enabled) return null;

  return (
    <div className="bg-plum text-on-inverted relative z-50 flex min-h-9 items-center justify-center px-4 py-1.5 text-center text-[0.83rem]">
      {promo.href ? (
        <Link
          href={promo.href}
          className="text-rose decoration-rose/40 font-semibold underline-offset-4 transition-colors hover:underline"
        >
          {promo.message}
        </Link>
      ) : (
        <span>{promo.message}</span>
      )}
    </div>
  );
}
