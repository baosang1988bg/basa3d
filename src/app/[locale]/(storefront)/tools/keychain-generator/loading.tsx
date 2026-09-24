import { Skeleton } from "@/components/ui/skeleton";
import { WorkbenchLoading } from "@/components/storefront/workbench-loading";

export default function KeychainGeneratorLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Skeleton className="h-4 w-32" />
      <div className="mb-8 max-w-3xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-72" />
        <Skeleton className="mt-2 h-4 w-full" />
      </div>
      <WorkbenchLoading />
    </div>
  );
}
