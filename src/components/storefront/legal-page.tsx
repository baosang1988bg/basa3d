import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ViewPolicyTracker } from '@/components/analytics/storefront-trackers';

export function LegalPage({ title, updatedAt, children }: { title: string; updatedAt: string; children: ReactNode }) {
  const t = useTranslations('policies');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <ViewPolicyTracker policyName={title} />
      <h1 className="font-heading text-2xl font-bold text-foreground md:text-[2rem]">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('updatedAtLabel', { date: updatedAt })}</p>
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-foreground [&_h2]:font-heading [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_p]:text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
