export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse p-2">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <div className="h-6 w-36 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="h-32 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
