import { Skeleton } from "@/components/ui/skeleton";

export default function BlogPostLoading() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 aspect-video w-full rounded-xl" />
      <Skeleton className="mt-6 h-8 w-4/5" />
      <Skeleton className="mt-2 h-3 w-32" />

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
    </article>
  );
}
