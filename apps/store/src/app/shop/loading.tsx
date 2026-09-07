import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { Container } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * The shop grid, while the catalogue is read.
 *
 * A skeleton in the grid's exact shape, so nothing moves when the real cards
 * arrive — the layout shift a spinner causes is worse on a phone than the wait
 * it covers.
 */
export default function ShopLoading() {
  return (
    <Container className="py-10 sm:py-16">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-10 w-56" />
      <Skeleton className="mt-4 h-4 w-full max-w-xl" />
      <Skeleton className="mt-10 h-24 w-full sm:mt-12" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 sm:mt-12 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}
