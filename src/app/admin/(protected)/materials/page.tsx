import { AdminPagination } from '@/components/admin/admin-pagination';
import { ConfirmedActionForm } from '@/components/admin/confirmed-action-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { listMaterials, listWarehouses } from '@/services/inventory.service';
import {
  getFilamentInventoryStats,
  listFilamentSpools,
  type FilamentWarningTier,
} from '@/services/filament.service';
import { createFilamentSpoolAction, setFilamentSpoolStatusAction } from './actions';

const WARNING_LABEL: Record<FilamentWarningTier, string> = {
  CON_NHIEU: 'Còn nhiều',
  CAN_THEO_DOI: 'Cần theo dõi',
  SAP_HET: 'Sắp hết',
  DA_HET: 'Đã hết',
};

const WARNING_BADGE_VARIANT: Record<FilamentWarningTier, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CON_NHIEU: 'secondary',
  CAN_THEO_DOI: 'outline',
  SAP_HET: 'default',
  DA_HET: 'destructive',
};

function formatVnd(value: number | null) {
  if (value === null) return '—';
  return `${value.toLocaleString('vi-VN')}đ`;
}

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ materialType?: string; color?: string; warningTier?: string; status?: string; page?: string }> }) {
  const params = await searchParams;
  const session = await requireAdmin();
  const status = params.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
  const [materials, warehouses, stats, { items: spools, page, hasNext }] = await Promise.all([
    listMaterials(),
    listWarehouses(),
    getFilamentInventoryStats(),
    listFilamentSpools({ status, materialType: params.materialType || undefined, color: params.color || undefined, warningTier: params.warningTier || undefined, page: Number(params.page) }, session.role),
  ]);

  const materialTypes = Array.from(new Set(materials.map((m) => m.materialType))).sort();
  const colors = Array.from(new Set(materials.map((m) => m.color).filter((c): c is string => Boolean(c)))).sort();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Kho nhựa theo cuộn</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Tổng số cuộn</p><p className="text-2xl font-semibold">{stats.totalSpools}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Tổng kg tồn</p><p className="text-2xl font-semibold">{(stats.totalInitialWeightGrams / 1000).toFixed(1)}kg</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Còn lại</p><p className="text-2xl font-semibold">{(stats.totalRemainingWeightGrams / 1000).toFixed(1)}kg</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Cần theo dõi (≤50%)</p><p className="text-2xl font-semibold">{stats.watchCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Sắp hết / đã hết</p><p className="text-2xl font-semibold">{stats.lowStockCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Bộ lọc</CardTitle></CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-4" method="get">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spoolStatus">Hiển thị</Label>
              <select id="spoolStatus" name="status" defaultValue={status} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"><option value="ACTIVE">Đang sử dụng</option><option value="ARCHIVED">Đã lưu trữ</option></select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="materialType">Dòng nhựa</Label>
              <select id="materialType" name="materialType" defaultValue={params.materialType ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {materialTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="color">Màu sắc</Label>
              <select id="color" name="color" defaultValue={params.color ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {colors.map((color) => <option key={color} value={color}>{color}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warningTier">Trạng thái tồn</Label>
              <select id="warningTier" name="warningTier" defaultValue={params.warningTier ?? ''} className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="">Tất cả</option>
                {(Object.keys(WARNING_LABEL) as FilamentWarningTier[]).map((tier) => <option key={tier} value={tier}>{WARNING_LABEL[tier]}</option>)}
              </select>
            </div>
            <Button type="submit" size="sm" className="cursor-pointer">Lọc</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Thêm cuộn nhựa mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createFilamentSpoolAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="spoolCode">Mã cuộn</Label>
              <Input id="spoolCode" name="spoolCode" placeholder="PLA-L-L-028" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="materialId">Vật liệu</Label>
              <select id="materialId" name="materialId" required className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>Chọn vật liệu</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="warehouseId">Kho</Label>
              <select id="warehouseId" name="warehouseId" required className="h-9 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-sm">
                <option value="" disabled>Chọn kho</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="initialWeightGrams">Khối lượng ban đầu (g)</Label>
              <Input id="initialWeightGrams" name="initialWeightGrams" type="number" min={1} defaultValue={1000} required />
            </div>
            {session.role === 'OWNER' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="purchaseCost">Giá mua (VND)</Label>
                <Input id="purchaseCost" name="purchaseCost" type="number" min={0} />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input id="hasSpool" name="hasSpool" type="checkbox" defaultChecked className="size-4" />
              <Label htmlFor="hasSpool">Có lõi</Label>
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea id="note" name="note" />
            </div>
            <div className="col-span-2">
              <Button type="submit" className="cursor-pointer">Thêm cuộn</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Danh sách cuộn nhựa ({spools.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã cuộn</TableHead>
                <TableHead>Loại nhựa</TableHead>
                <TableHead>Màu</TableHead>
                <TableHead>Lõi</TableHead>
                <TableHead>Khối lượng</TableHead>
                <TableHead>% còn lại</TableHead>
                <TableHead>Trạng thái</TableHead>
                {session.role === 'OWNER' ? <TableHead className="text-right">Giá mua</TableHead> : null}
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spools.map((spool) => (
                <TableRow key={spool.id}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/materials/${spool.id}`} className="hover:underline">{spool.spoolCode}</Link>
                  </TableCell>
                  <TableCell>{spool.materialType}</TableCell>
                  <TableCell>{spool.color ?? '—'}</TableCell>
                  <TableCell><Badge variant="outline">{spool.hasSpool ? 'Có lõi' : 'Không lõi'}</Badge></TableCell>
                  <TableCell className="text-xs">{spool.usedWeightGrams}g / {spool.initialWeightGrams}g</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(0, Math.min(100, spool.remainingPct))}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums">{Math.round(spool.remainingPct)}%</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={WARNING_BADGE_VARIANT[spool.warningTier]}>{WARNING_LABEL[spool.warningTier]}</Badge></TableCell>
                  {session.role === 'OWNER' ? <TableCell className="text-right">{formatVnd(spool.purchaseCost)}</TableCell> : null}
                  <TableCell><div className="flex items-center gap-3">
                    <Link href={`/admin/materials/${spool.id}`} className="text-sm underline">Sửa / Kiểm kê</Link>
                    <ConfirmedActionForm action={setFilamentSpoolStatusAction.bind(null, spool.id, status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE')} label={status === 'ACTIVE' ? 'Lưu trữ' : 'Khôi phục'} confirmation={`${status === 'ACTIVE' ? 'Lưu trữ' : 'Khôi phục'} cuộn ${spool.spoolCode}? ${status === 'ACTIVE' ? 'Cuộn sẽ không còn trong danh sách đang dùng. Bạn có thể khôi phục ở mục Đã lưu trữ.' : ''}`} />
                  </div></TableCell>
                </TableRow>
              ))}
              {!spools.length ? (
                <TableRow><TableCell colSpan={session.role === 'OWNER' ? 9 : 8} className="text-center text-muted-foreground">Chưa có cuộn nhựa nào khớp bộ lọc</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
          <AdminPagination basePath="/admin/materials" page={page} hasNext={hasNext} filters={{ status, materialType: params.materialType, color: params.color, warningTier: params.warningTier }} />
        </CardContent>
      </Card>
    </div>
  );
}
