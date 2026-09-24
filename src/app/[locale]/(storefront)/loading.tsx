import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
        <Skeleton className="mx-auto h-10 w-2/3 max-w-xl" />
        <Skeleton className="mx-auto mt-4 h-10 w-1/2 max-w-md" />
        <Skeleton className="mx-auto mt-6 h-4 w-2/3 max-w-lg" />
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Skeleton className="h-11 w-44 rounded-lg" />
          <Skeleton className="h-11 w-40 rounded-lg" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <Skeleton className="h-56 w-full rounded-2xl" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-7 w-56" />
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
