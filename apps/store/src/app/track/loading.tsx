import { Container } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";

export default function TrackLoading() {
  return (
    <Container width="prose" className="py-10 sm:py-16">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-5 h-10 w-64" />
      <Skeleton className="mt-4 h-4 w-full" />
      <div className="mt-10 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-12 w-24 sm:mt-6" />
      </div>
    </Container>
  );
}
