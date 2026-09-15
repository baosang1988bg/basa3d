export default function ToolsLoading() {
  return (
    <div className="mx-auto flex max-w-5xl animate-pulse flex-col gap-6 px-4 py-10">
      <div className="h-8 w-64 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-6 w-40 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-6 w-48 rounded bg-muted" />
          <div className="h-64 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
