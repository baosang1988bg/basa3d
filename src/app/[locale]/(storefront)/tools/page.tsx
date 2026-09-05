import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Box, CircleUserRound, Cuboid, Grid2X2, Image, Layers3, Palette, Puzzle, ScanLine, Scaling, Shapes, Tag, Type, Waves } from 'lucide-react';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { Link } from '@/i18n/navigation';
import { storefrontButtonClasses } from '@/components/storefront/button';

const ICONS = [Tag, Type, Grid2X2, Waves, Puzzle, Box, Image, Shapes, Palette, ScanLine, Scaling, Cuboid, Layers3, CircleUserRound];

export const metadata: Metadata = { title: 'Công cụ thiết kế 3D — BaSa3D' };

export default async function ToolsPage() {
  const t = await getTranslations('tools');
  const tools = t.raw('items') as { name: string; description: string; status: 'available' | 'planned' }[];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbTools') }]} />
      <header className="max-w-3xl"><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('eyebrow')}</p><h1 className="font-heading mt-2 text-3xl font-extrabold md:text-4xl">{t('title')}</h1><p className="mt-3 text-muted-foreground">{t('description')}</p></header>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, index) => {
          const Icon = ICONS[index] ?? Cuboid;
          const available = tool.status === 'available';
          const href = index === 2 ? '/tools/organizer' : '/tools/keychain-generator';
          return (
            <article key={tool.name} className="flex min-h-56 flex-col rounded-xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-start justify-between gap-3"><span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>{available ? t('available') : t('planned')}</span></div>
              <h2 className="font-heading mt-4 text-lg font-bold">{tool.name}</h2><p className="mt-2 flex-1 text-sm text-muted-foreground">{tool.description}</p>
              {available ? <Link href={href} className={storefrontButtonClasses('primary', 'mt-5 w-full text-sm')}>{t('openTool')}</Link> : <p className="mt-5 text-xs text-muted-foreground">{t('plannedNote')}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
