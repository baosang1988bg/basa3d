export function SectionHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">{eyebrow}</p>}
      <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-base text-muted-foreground">{description}</p>}
    </div>
  );
}
