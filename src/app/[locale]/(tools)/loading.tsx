import { Skeleton } from "@/components/ui/skeleton";

export default function ToolsLoading() {
  return (
    <div className="grid gap-2 p-2 lg:h-[calc(100dvh-3.5rem)] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-0 lg:p-0">
      <Skeleton className="h-[50dvh] min-h-[360px] rounded-none lg:h-full" />
      <div className="flex flex-col gap-4 border-border p-4 lg:border-l">
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-lg" />
        <div className="mt-auto grid gap-2">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
