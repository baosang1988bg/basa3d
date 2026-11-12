export default function AdminAuthLoading() {
  return (
    <div className="flex min-h-screen animate-pulse items-center justify-center bg-muted p-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="mx-auto h-8 w-40 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
        <div className="h-10 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
