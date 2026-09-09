"use client";

import { Heart } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useWishlist } from "@/components/wishlist/wishlist-provider";
import { cn } from "@/lib/utils";

/*
 * The favourite heart on a product card.
 *
 * A real button over the card's stretched link, not inside it: a <button>
 * nested in an <a> is invalid markup that browsers resolve by guessing, and
 * the guess is usually "navigate". It stops propagation so tapping the heart
 * saves the piece instead of opening it.
 *
 * Always visible, on both pointer types. Quick-add is hover-revealed on a
 * mouse because it duplicates an action the card already offers, but a save
 * has no other entry point — hiding it behind hover would mean 85% of this
 * shop's traffic never discovers the feature exists.
 *
 * `ready` gates the filled state, not the button. The button renders
 * immediately so the layout is stable; only whether it looks saved waits for
 * localStorage, because the server cannot know that and a filled heart in the
 * server's HTML would be a hydration mismatch on every card.
 */
export function SaveButton({
  productId,
  name,
  className,
}: {
  productId: string;
  /** Used in the accessible label and the confirmation. */
  name: string;
  className?: string;
}) {
  const { has, toggle, ready } = useWishlist();
  const { show } = useToast();

  const saved = ready && has(productId);

  return (
    <button
      type="button"
      aria-pressed={ready ? saved : undefined}
      aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
      onClick={(event) => {
        /* The card's stretched link covers this button's box, so without both
           of these the tap navigates as well as saving. */
        event.preventDefault();
        event.stopPropagation();
        const nowSaved = toggle(productId);
        show(nowSaved ? "Saved to your wishlist" : "Removed from wishlist");
      }}
      className={cn(
        "duration-quick ease-out-soft z-20 grid size-9 place-items-center rounded-full transition-[color,background-color,scale]",
        "bg-blush/90 text-ink hover:bg-white motion-safe:hover:scale-[1.08]",
        "focus-visible:outline-rose focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        saved && "text-rose bg-white",
        className,
      )}
    >
      <Heart
        size={18}
        strokeWidth={1.7}
        /* Filled when saved — the outline-to-solid flip is the whole signal,
           and it survives a screenshot, a colourblind viewer and a
           high-contrast mode in a way a hue change alone would not. */
        className={cn(saved && "fill-rose")}
      />
    </button>
  );
}
