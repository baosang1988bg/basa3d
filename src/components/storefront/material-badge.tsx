import { cn } from '@/lib/utils';

type Material = 'PLA' | 'PETG' | 'ABS' | 'RESIN' | 'TPU';

const MATERIAL_CLASSES: Record<Material, string> = {
  PLA: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  PETG: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  ABS: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  RESIN: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  TPU: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
};

const MATERIAL_LABEL: Record<Material, string> = { PLA: 'PLA', PETG: 'PETG', ABS: 'ABS', RESIN: 'Resin', TPU: 'TPU (dẻo)' };

export function MaterialBadge({ material, className }: { material: Material; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold', MATERIAL_CLASSES[material], className)}>
      {MATERIAL_LABEL[material]}
    </span>
  );
}
