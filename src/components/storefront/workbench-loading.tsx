import { Skeleton } from "@/components/ui/skeleton";

export function WorkbenchLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Skeleton className="h-[50dvh] min-h-[360px] rounded-xl lg:h-full" />
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <div className="mt-auto grid gap-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
