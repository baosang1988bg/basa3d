import { Skeleton } from "@/components/ui/skeleton";

export default function QuoteLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-6">
        <Skeleton className="mx-auto h-6 w-48" />
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-6 h-32 w-32 rounded-lg" />
        <Skeleton className="mt-6 h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}
