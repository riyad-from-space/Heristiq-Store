import Link from "next/link";
import type { PromoSetting } from "@/lib/settings";

/*
 * The promo strip above the header.
 *
 * Server-rendered from storefront_settings, so the owner turns it on and edits
 * the words from the ERP without a deploy — which is the whole reason it is a
 * setting and not a constant. Renders nothing when it is off or has no words,
 * so the header sits flush and nothing shifts.
 */
export function PromoBanner({ promo }: { promo: PromoSetting }) {
  if (!promo.enabled) return null;

  const content = (
    <span className="text-eyebrow uppercase">{promo.message}</span>
  );

  return (
    <div className="bg-inverted text-on-inverted relative z-50 flex min-h-9 items-center justify-center px-4 text-center">
      {promo.href ? (
        <Link
          href={promo.href}
          className="decoration-gold-pale/50 underline-offset-4 hover:underline"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
