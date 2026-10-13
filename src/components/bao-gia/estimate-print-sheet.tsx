import { formatVnd } from '@/components/storefront/format';
import { SITE_CONFIG } from '@/config/site';

export type PrintLine = {
  name: string;
  materialType: string;
  infillPct: number;
  scalePct: number;
  quantity: number;
  line:
    | { status: 'OK'; grams: number; printMinutes: number; sizeMm: { x: number; y: number; z: number }; unitPriceVnd: number; lineSubtotalVnd: number; vatVnd: number; lineTotalVnd: number }
    | { status: string; sizeMm: { x: number; y: number; z: number } }
    | null;
};

/**
 * Phase 33 S6 (T13): printable estimate — plain HTML + @media print + window.print(), browser fonts
 * render Vietnamese correctly, no PDF library. Hidden on screen; when printing, only this sheet is
 * visible (the rest of the page, header and footer included, is hidden by the style below).
 */
export function EstimatePrintSheet({ lines, totals, vat, requestNumber }: {
  lines: PrintLine[];
  totals: { subtotalVnd: number; vatVnd: number; totalVnd: number } | null;
  vat?: { enabled: boolean; rateBps: number };
  requestNumber: string | null;
}) {
  return (
    <>
      <style>{'@media print { body * { visibility: hidden !important; } #bao-gia-print, #bao-gia-print * { visibility: visible !important; } #bao-gia-print { position: absolute; inset: 0 auto auto 0; width: 100%; } }'}</style>
      <section id="bao-gia-print" className="hidden text-black print:block" aria-hidden="true">
        <h1 className="text-xl font-bold">BẢNG ƯỚC TÍNH — không phải báo giá chính thức</h1>
        <p className="mt-1 text-sm">
          {SITE_CONFIG.name} · Zalo/Hotline {SITE_CONFIG.hotline} · {SITE_CONFIG.email} · {SITE_CONFIG.address}
        </p>
        <p className="text-sm" suppressHydrationWarning>In lúc {new Date().toLocaleString('vi-VN')}{requestNumber ? ` · Mã yêu cầu ${requestNumber}` : ''}</p>
        <table className="mt-4 w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 pr-2">#</th><th className="py-1 pr-2">File</th><th className="py-1 pr-2">Kích thước</th>
              <th className="py-1 pr-2">Vật liệu</th><th className="py-1 pr-2">SL</th><th className="py-1 pr-2">Gram · giờ in</th>
              <th className="py-1 pr-2 text-right">Đơn giá</th><th className="py-1 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((row, index) => {
              const ok = row.line && row.line.status === 'OK' && 'unitPriceVnd' in row.line ? row.line : null;
              const size = row.line?.sizeMm;
              return (
                <tr key={`${row.name}-${index}`} className="border-b border-black/30 align-top">
                  <td className="py-1 pr-2">{index + 1}</td>
                  <td className="py-1 pr-2">{row.name}</td>
                  <td className="py-1 pr-2">{size ? `${size.x}×${size.y}×${size.z} mm (${row.scalePct}%)` : '—'}</td>
                  <td className="py-1 pr-2">{row.materialType} · {row.infillPct}%</td>
                  <td className="py-1 pr-2">{row.quantity}</td>
                  <td className="py-1 pr-2">{ok ? `~${ok.grams}g · ~${Math.round((ok.printMinutes / 60) * 10) / 10}h` : '—'}</td>
                  <td className="py-1 pr-2 text-right">{ok ? `~${formatVnd(ok.unitPriceVnd)}` : 'Xưởng báo giá'}</td>
                  <td className="py-1 text-right">{ok ? `~${formatVnd(ok.lineSubtotalVnd)}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totals ? (
          <div className="mt-3 text-right text-sm">
            <p>Tạm tính: ~{formatVnd(totals.subtotalVnd)}</p>
            {vat?.enabled ? <p>VAT {vat.rateBps / 100}%: ~{formatVnd(totals.vatVnd)}</p> : null}
            <p className="text-base font-bold">Tổng ước tính: ~{formatVnd(totals.totalVnd)}</p>
          </div>
        ) : null}
        <p className="mt-4 text-xs">Giá ước tính sơ bộ từ hình học, chưa phải giá chính thức. Xưởng xác nhận giá chính xác cho từng món sau khi kiểm tra file.</p>
      </section>
    </>
  );
}
