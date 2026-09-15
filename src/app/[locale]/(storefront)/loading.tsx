export default function StorefrontLoading() {
  return (
    <div className="mx-auto flex max-w-6xl animate-pulse flex-col gap-6 px-4 py-10">
      <div className="h-8 w-56 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="aspect-square rounded-xl bg-muted md:col-span-2" />
        <div className="flex flex-col gap-4">
          <div className="h-7 w-3/4 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-24 rounded-xl bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
