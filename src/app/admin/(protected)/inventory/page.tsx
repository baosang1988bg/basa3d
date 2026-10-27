import Link from 'next/link';
import { Boxes, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { AdminPagination } from '@/components/admin/admin-pagination';
import { BatchRestockButton } from '@/components/admin/batch-restock-dialog';
import { MOVEMENT_TYPE_LABELS, REFERENCE_TYPE_LABELS, movementLabel } from '@/lib/inventory/movement-labels';
import { inventoryMovementTypeSchema, uuidSchema } from '@/domain/schemas';
import { listAllVariantsWithProductName } from '@/services/product.service';
import { listInventoryActors, listInventoryLedger, listWarehouses } from '@/services/inventory.service';
import { listStockTrackedVariants } from '@/services/quick-restock.service';
import { recordMovementAction } from './actions';
import { requireAdmin } from '@/lib/auth/require-admin';

export const metadata = { title: 'Sổ kho | BaSa3D Admin' };

type SearchParams = { q?: string; type?: string; actor?: string; from?: string; to?: string; page?: string };

const TONE_CLASS = {
  in: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  out: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400',
  neutral: 'border-border bg-muted text-muted-foreground',
} as const;

const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

// Phase 52 P4 (docs/exec-plans/active/phase-52-admin-catalog-restock-ux.md): this page is now the
// read-only ledger. Day-to-day stock changes go through "Nhập kho nhanh" / "Nhập theo mẻ"; the raw
// movement form (TRANSFER_*, RETURN_IN…) stays for OWNER under "Nâng cao".
export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { role } = await requireAdmin();
  const params = await searchParams;
  const movementType = inventoryMovementTypeSchema.safeParse(params.type).success ? params.type : undefined;
  const actorId = uuidSchema.safeParse(params.actor).success ? params.actor : undefined;
  const filters = { q: params.q?.trim() || undefined, type: movementType, actor: actorId, from: params.from || undefined, to: params.to || undefined };

  const [ledger, actors, warehouses, batchVariants, manualVariants] = await Promise.all([
    listInventoryLedger({ search: filters.q, movementType, actorId, from: filters.from, to: filters.to, page: Number(params.page) }),
    listInventoryActors(),
    listWarehouses(),
    listStockTrackedVariants(),
    role === 'OWNER' ? listAllVariantsWithProductName() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sổ kho</h1>
          <p className="text-sm text-muted-foreground">Mọi lần nhập/xuất thành phẩm, không sửa/xoá được. Nhập kho hằng ngày dùng nút bên phải hoặc nút “Nhập kho” ở từng sản phẩm.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BatchRestockButton variants={batchVariants} warehouses={warehouses} />
          <Link href="/admin/product-inventory" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Boxes className="mr-1.5 size-4" /> Tồn kho theo sản phẩm
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="flex flex-col gap-1.5 lg:col-span-2">
              <Label htmlFor="ledger-q">Sản phẩm / SKU</Label>
              <Input id="ledger-q" name="q" defaultValue={filters.q} placeholder="Tìm…" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-type">Loại</Label>
              <select id="ledger-type" name="type" defaultValue={movementType ?? ''} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-actor">Người ghi</Label>
              <select id="ledger-actor" name="actor" defaultValue={actorId ?? ''} className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-from">Từ ngày</Label>
              <Input id="ledger-from" name="from" type="date" defaultValue={filters.from} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-to">Đến ngày</Label>
              <Input id="ledger-to" name="to" type="date" defaultValue={filters.to} />
            </div>
            <div className="flex gap-2 lg:col-span-6">
              <Button type="submit" size="sm">Lọc</Button>
              <Link href="/admin/inventory" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Xoá lọc</Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lịch sử biến động</CardTitle></CardHeader>
        <CardContent>
          {ledger.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Kho</TableHead>
                  <TableHead>Người ghi</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.items.map((row) => {
                  const tone = MOVEMENT_TYPE_LABELS[row.movementType]?.tone ?? 'neutral';
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs tabular-nums">{dateTimeFormat.format(new Date(row.createdAt))}</TableCell>
                      <TableCell>
                        <Link href={`/admin/products/${row.productId}`} className="font-medium hover:underline">{row.productName}</Link>
                        <div className="font-mono text-[11px] text-muted-foreground">{row.variantName} · {row.sku}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={TONE_CLASS[tone]}>{movementLabel(row.movementType)}</Badge>
                        {row.referenceType ? <div className="mt-0.5 text-[11px] text-muted-foreground">{REFERENCE_TYPE_LABELS[row.referenceType] ?? row.referenceType}</div> : null}
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${row.quantity > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                        {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
                        {row.unitCost !== null ? <div className="text-[11px] font-normal text-muted-foreground">{row.unitCost.toLocaleString('vi-VN')}đ/món</div> : null}
                      </TableCell>
                      <TableCell className="text-xs">{row.warehouseCode}</TableCell>
                      <TableCell className="text-xs">{row.actorName ?? (row.actorId ? 'Nhân viên cũ' : 'Hệ thống')}</TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">{row.note ?? '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : <p className="py-6 text-center text-sm text-muted-foreground">Không có biến động nào khớp bộ lọc.</p>}
          <AdminPagination basePath="/admin/inventory" page={ledger.page} hasNext={ledger.hasNext} filters={filters} />
        </CardContent>
      </Card>

      {role === 'OWNER' ? (
        <details className="group rounded-xl border border-border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Nâng cao (OWNER): ghi biến động thủ công — chuyển kho, khách trả hàng…
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <form action={recordMovementAction} className="grid grid-cols-1 gap-4 border-t border-border p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productVariantId">Biến thể sản phẩm</Label>
              <select id="productVariantId" name="productVariantId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="">— Chọn biến thể —</option>
                {manualVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>{variant.productName} — {variant.sku}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warehouseId">Kho</Label>
              <select id="warehouseId" name="warehouseId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="">— Chọn kho —</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="movementType">Loại biến động</Label>
              <select id="movementType" name="movementType" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, { label }]) => <option key={value} value={value}>{label} ({value})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng (dương = nhập, âm = xuất)</Label>
              <Input id="quantity" name="quantity" type="number" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitCost">Đơn giá (VND, tuỳ chọn)</Label>
              <Input id="unitCost" name="unitCost" type="number" min={0} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="note">Ghi chú (bắt buộc với kiểm kê)</Label>
              <Textarea id="note" name="note" placeholder="Lý do, tham chiếu…" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Ghi nhận biến động</Button>
            </div>
          </form>
        </details>
      ) : null}
    </div>
  );
}
