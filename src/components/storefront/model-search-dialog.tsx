'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Image as ImageIcon, Sparkles } from 'lucide-react';
import { SearchModalShell, SearchTab } from './search/search-modal-shell';
import { ModelSearchPanel, type ModelSearchTab } from './search/model-search-panel';

/** 3D-library search dialog (keywords + image). Used by the /custom-print banner and /bao-gia. ADR-0060/0064. */
export function ModelSearchDialog({
  isOpen,
  onClose,
  initialQuery = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}) {
  const t = useTranslations('modelSearch');
  const [tab, setTab] = useState<ModelSearchTab>('text');

  return (
    <SearchModalShell isOpen={isOpen} onClose={onClose} labelledBy="model-search-title" closeLabel={t('close')}>
      <div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            <Sparkles className="size-3.5" />
            {t('badge')}
          </span>
          <span className="text-xs text-muted-foreground">{t('subtitle')}</span>
        </div>
        <h2 id="model-search-title" className="mt-2 text-xl font-extrabold text-foreground sm:text-2xl">{t('title')}</h2>
        <div role="tablist" className="mt-4 flex border-b border-border">
          <SearchTab active={tab === 'text'} onClick={() => setTab('text')} icon={<Search className="size-4" />}>{t('tabText')}</SearchTab>
          <SearchTab active={tab === 'image'} onClick={() => setTab('image')} icon={<ImageIcon className="size-4" />}>{t('tabImage')}</SearchTab>
        </div>
      </div>
      <ModelSearchPanel tab={tab} onTabChange={setTab} initialQuery={initialQuery} onNavigate={onClose} />
    </SearchModalShell>
  );
}
