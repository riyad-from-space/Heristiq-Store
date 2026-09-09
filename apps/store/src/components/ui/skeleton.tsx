import { cn } from "@/lib/utils";

/*
 * A loading placeholder.
 *
 * Shell-coloured and gently pulsing rather than grey and shimmering: the whole
 * site is bone and shell, and a stock skeleton looks like somebody else's
 * component library dropped in. Respects prefers-reduced-motion via the global
 * rule in globals.css, which kills the animation duration.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("bg-sand animate-pulse rounded-tile", className)}
    />
  );
}

/** A product card's shape, for the shop grid while it loads. */
export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-4/5 w-full" />
      <Skeleton className="mt-4 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}
