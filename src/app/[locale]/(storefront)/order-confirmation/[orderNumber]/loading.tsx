import { Skeleton } from "@/components/ui/skeleton";

export default function OrderConfirmationLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="mt-4 h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-24" />
        <div className="mt-4 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </div>

      <div className="mt-6 flex justify-center gap-3">
        <Skeleton className="h-11 w-40 rounded-lg" />
        <Skeleton className="h-11 w-40 rounded-lg" />
      </div>
    </div>
  );
}
