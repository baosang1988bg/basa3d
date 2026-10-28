import { Download, Sliders } from 'lucide-react';
import { HANDBOOK_PRESETS } from '@/data/handbook/presets';

const SLICER_INSTRUCTIONS = [
  {
    name: 'Bambu Studio',
    step: 'Vào File → Import → Import Configs... (hoặc kéo thả file JSON vào cửa sổ cài đặt).',
  },
  {
    name: 'OrcaSlicer',
    step: 'Vào File → Import → Import Configs... rồi chọn file profile vừa tải về.',
  },
  {
    name: 'PrusaSlicer',
    step: 'Vào File → Import → Import Config... (hoặc phím tắt Ctrl+L / Cmd+L).',
  },
];

/**
 * Server component — Slicer preset downloads (Phase 53, S5).
 * Renders verified Filament and Process presets calibrated by BaSa3D workshop.
 * Hidden automatically when no presets are published in the manifest.
 */
export function SlicerPresets() {
  if (HANDBOOK_PRESETS.length === 0) return null;

  return (
    <div className="not-prose mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2.5">
        <Sliders className="size-5 text-primary" aria-hidden="true" />
        <h3 className="font-heading text-lg font-bold">Profile Slicer mẫu chuẩn xưởng</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Các profile thông số nhựa (Filament) và tiến trình in (Process) được hiệu chỉnh thực tế trên máy in tại BaSa3D.
        Tất cả file chỉ chứa thông số in, không chứa mã lệnh máy (G-code) nên an toàn 100% cho mọi dòng máy.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {HANDBOOK_PRESETS.map((preset) => (
          <div key={preset.id} className="flex flex-col justify-between rounded-lg border border-border bg-background p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{preset.material}</span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                  {preset.kind === 'filament' ? 'Nhựa (Filament)' : 'Tiến trình (Process)'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Máy: {preset.printer} • Đầu phun: {preset.nozzleMm} mm • {preset.slicer} v{preset.slicerVersion}
              </p>
            </div>
            <div className="mt-3 pt-2">
              <a
                href={`/downloads/presets/${preset.file}`}
                download={preset.file}
                data-preset-id={preset.id}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 text-xs font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Tải profile ({preset.file.split('.').pop()?.toUpperCase()})
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg bg-muted/50 p-3.5 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Cách nạp profile vào Slicer:</p>
        <ul className="mt-1.5 space-y-1 list-disc pl-4">
          {SLICER_INSTRUCTIONS.map((item) => (
            <li key={item.name}>
              <strong className="text-foreground">{item.name}:</strong> {item.step}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
