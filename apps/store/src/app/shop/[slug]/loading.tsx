import { Container } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";

/* The PDP's two-column shape, so the gallery does not jump into place. */
export default function ProductLoading() {
  return (
    <Container className="py-6 sm:py-10">
      <Skeleton className="h-3 w-48" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Skeleton className="-mx-5 aspect-4/5 sm:mx-0" />
        <div className="lg:pt-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-9 w-3/4" />
          <Skeleton className="mt-4 h-4 w-1/2" />
          <Skeleton className="mt-6 h-8 w-32" />
          <Skeleton className="mt-8 h-13 w-full" />
          <Skeleton className="mt-3 h-13 w-full" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
      </div>
    </Container>
  );
}
