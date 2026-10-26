import { HANDBOOK_TOLERANCES } from '@/data/handbook/tolerances';

const mm = ([min, max]: [number, number]) => `${min.toFixed(2)}–${max.toFixed(2)} mm`;

/** Server component — static reference table, no client JS. */
export function ToleranceTable() {
  return (
    <div className="not-prose overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <caption className="sr-only">Khe hở CAD khuyến nghị cho mỗi bên, đầu phun 0.4 mm</caption>
        <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="sticky left-0 bg-muted px-3 py-2">Kiểu lắp</th>
            <th scope="col" className="px-3 py-2">Khe mỗi bên</th>
            <th scope="col" className="px-3 py-2">Ví dụ</th>
            <th scope="col" className="px-3 py-2">Lưu ý</th>
          </tr>
        </thead>
        <tbody>
          {HANDBOOK_TOLERANCES.map((row) => (
            <tr key={row.id} className="border-t border-border align-top">
              <th scope="row" className="sticky left-0 bg-card px-3 py-2 font-semibold">{row.fit}</th>
              <td className="px-3 py-2 font-medium tabular-nums whitespace-nowrap text-primary">{mm(row.clearanceMm)}</td>
              <td className="px-3 py-2">{row.example}</td>
              <td className="min-w-[14rem] px-3 py-2 text-muted-foreground">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
