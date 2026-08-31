export function SpecTable({ specs }: { specs: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {specs.map((spec) => (
        <div key={spec.label} className="rounded-md border border-border/80 bg-muted/60 p-2.5 text-center">
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{spec.label}</div>
          <div className="font-mono text-sm font-bold text-foreground">{spec.value}</div>
        </div>
      ))}
    </div>
  );
}
