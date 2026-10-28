import type { Metadata } from 'next';
import { Info } from 'lucide-react';
import { Breadcrumb } from '@/components/storefront/breadcrumb';
import { HandbookBlocks } from '@/components/storefront/handbook/handbook-blocks';
import { HandbookToc } from '@/components/storefront/handbook/handbook-toc';
import { UntranslatedNotice } from '@/components/storefront/untranslated-notice';
import { isBaoGiaEnabled } from '@/config/bao-gia';
import { SITE_CONFIG } from '@/config/site';
import { HANDBOOK_PUBLISHED_AT, HANDBOOK_SECTIONS, HANDBOOK_TOC, HANDBOOK_UPDATED_AT } from '@/data/handbook/sections';
import { applyRequestLocale, type LocaleParams } from '@/i18n/request-locale';
import { localeAlternates } from '@/i18n/seo';
import { serializeJsonLd } from '@/lib/json-ld';

// Phase 50 — Cẩm nang in 3D. Fully static (SSG via [locale]/layout's generateStaticParams): content
// is code in src/data/handbook, no DB/API. Both the page and generateMetadata call
// applyRequestLocale (ADR-0045) — without it next-intl reads the request header and the route turns
// dynamic. Never add `dynamic`, cookies() or headers() here (guarded in tests/phase-50-handbook).

const PATH = '/cam-nang';
const TITLE = 'Cẩm nang in 3D FDM — BaSa3D';
const DESCRIPTION = 'Cẩm nang in 3D FDM tiếng Việt: vật liệu, slicer, dung sai lắp ghép và cách sửa 8 lỗi in thường gặp như cong vênh, kéo tơ, z-banding, lệch lớp.';

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  await applyRequestLocale(params);
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: localeAlternates(PATH),
    openGraph: { title: TITLE, description: DESCRIPTION, type: 'article', url: PATH, modifiedTime: HANDBOOK_UPDATED_AT },
  };
}

export default async function HandbookPage({ params }: { params: LocaleParams }) {
  await applyRequestLocale(params);
  const baoGiaEnabled = isBaoGiaEnabled();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://basa3d.example.com').replace(/\/+$/, '');

  // TechArticle + BreadcrumbList only: HowTo rich results were retired by Google in 2023 and the
  // page has no visible FAQ block, so FAQPage would be invalid markup.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: 'Cẩm nang in 3D FDM',
        description: DESCRIPTION,
        inLanguage: 'vi',
        url: `${siteUrl}${PATH}`,
        datePublished: HANDBOOK_PUBLISHED_AT,
        dateModified: HANDBOOK_UPDATED_AT,
        proficiencyLevel: 'Beginner',
        articleSection: HANDBOOK_SECTIONS.map((section) => section.title),
        author: { '@type': 'Organization', name: SITE_CONFIG.name },
        publisher: { '@type': 'Organization', name: SITE_CONFIG.name },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${siteUrl}/home` },
          { '@type': 'ListItem', position: 2, name: 'Cẩm nang in 3D', item: `${siteUrl}${PATH}` },
        ],
      },
    ],
  };

  return (
    <>
      <UntranslatedNotice />
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
        <Breadcrumb items={[{ label: 'Trang chủ', href: '/home' }, { label: 'Cẩm nang in 3D' }]} />

        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Cẩm nang BaSa3D</p>
          <h1 className="font-heading mt-2 text-3xl font-extrabold md:text-4xl">Cẩm nang in 3D FDM</h1>
          <p className="mt-3 text-muted-foreground">
            9 chương thực chiến từ xưởng in: chọn vật liệu, thiết kế cho in, cài slicer, xử lý lỗi và hoàn thiện — kèm bảng tra cứu và checklist trước khi in.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Cập nhật <time dateTime={HANDBOOK_UPDATED_AT}>{HANDBOOK_UPDATED_AT.split('-').reverse().join('/')}</time>
          </p>
        </header>

        <div role="note" className="mt-6 mb-8 flex max-w-3xl gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
          <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Mọi con số là điểm khởi đầu để hiệu chỉnh trên từng máy và cuộn nhựa cụ thể, không phải kết quả đo đơn nhất. Khi khác với nhãn của nhà sản xuất nhựa, hãy ưu tiên nhãn.
          </p>
        </div>

        <HandbookToc items={HANDBOOK_TOC}>
          <div className="space-y-14">
            {HANDBOOK_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28 lg:scroll-mt-24">
                <p className="text-sm font-semibold tabular-nums text-primary">Chương {section.number}</p>
                <h2 id={`${section.id}-title`} className="font-heading mt-1 text-2xl font-extrabold">{section.title}</h2>
                <p className="mt-2 mb-5 text-muted-foreground">{section.summary}</p>
                <HandbookBlocks blocks={section.blocks} baoGiaEnabled={baoGiaEnabled} />
              </section>
            ))}
          </div>
        </HandbookToc>
      </div>
    </>
  );
}
