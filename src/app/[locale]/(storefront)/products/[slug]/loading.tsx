import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-4 w-40" />

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="mt-2 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="size-16 rounded-lg" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="mt-2 h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
