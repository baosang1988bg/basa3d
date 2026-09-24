import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsListLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 max-w-3xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-h-56 rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="mt-4 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-4 h-9 w-28 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
