'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ASSEMBLY_TIERS, type AssemblyTier } from '@/lib/pricing/assembly-tiers';

export type ProfileVerificationCardProps = {
  profileTitle: string;
  modelTitle?: string | null;
  /** Must already be sanitized (sanitizeMakerWorldImageUrl / snapshot schema) — rendered as-is. */
  imageUrl?: string | null;
  printerTarget?: string | null;
  printMinutes: number;
  platesCount: number;
  netWeightGrams: number;
  amsRequired?: boolean | null;
  dataSource?: 'RESOLVER' | 'MANUAL';
  tier?: AssemblyTier | null;
  verified?: boolean;
};

function formatHours(minutes: number): string {
  return `${Math.round((minutes / 60) * 10) / 10}h`;
}

function SpecBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'amber' }) {
  const toneClass = tone === 'green'
    ? 'border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
    : tone === 'amber'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-border bg-muted/40 text-foreground';
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass}`}>{children}</span>;
}

/**
 * Shared admin + public "verified print profile" card (makerworld-profile-verification plan §1.2):
 * profile-specific thumbnail + title + printer/time/plates/grams/AMS badges so staff (and later the
 * customer) can compare against the MakerWorld page before a price is committed. Purely
 * presentational — no fetching. The image uses `referrerPolicy="no-referrer"` and falls back to a
 * placeholder when the hotlinked CDN URL dies before the quote's valid_until.
 */
export function ProfileVerificationCard(props: ProfileVerificationCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(props.imageUrl) && !imageFailed;
  return (
    <div className="flex items-start gap-3 rounded-lg border-2 border-emerald-600/70 bg-background p-3">
      {showImage ? (
        <Image
          src={props.imageUrl as string}
          alt={props.profileTitle}
          width={96}
          height={96}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="size-24 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex size-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-center text-[10px] text-muted-foreground">
          Không có ảnh profile
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5 text-sm">
        {props.modelTitle ? <p className="truncate text-xs text-muted-foreground">{props.modelTitle}</p> : null}
        <p className="font-semibold text-foreground break-words">{props.profileTitle}</p>
        <div className="flex flex-wrap gap-1.5">
          {props.printerTarget ? <SpecBadge>{props.printerTarget}</SpecBadge> : null}
          {/* 0 is never a real value (it means "not known", e.g. a screenshot that missed it). */}
          {props.printMinutes > 0 ? <SpecBadge>{formatHours(props.printMinutes)}</SpecBadge> : null}
          {props.platesCount > 0 ? <SpecBadge>{props.platesCount} plates</SpecBadge> : null}
          {props.netWeightGrams > 0 ? <SpecBadge>{Math.round(props.netWeightGrams * 10) / 10}g</SpecBadge> : null}
          {props.amsRequired === false ? <SpecBadge tone="amber">NO AMS</SpecBadge> : null}
          {props.amsRequired === true ? <SpecBadge>AMS</SpecBadge> : null}
          {props.tier ? <SpecBadge tone="green">{ASSEMBLY_TIERS[props.tier].label}</SpecBadge> : null}
        </div>
        {props.dataSource === 'MANUAL' ? <p className="text-xs text-muted-foreground">Thông số do BaSa3D nhập</p> : null}
        {props.verified ? <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">✓ Đã xác nhận đúng profile yêu cầu</p> : null}
      </div>
    </div>
  );
}
