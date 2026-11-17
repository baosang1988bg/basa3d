import { ActionForm } from '@/components/admin/action-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/auth/require-admin';
import { ASSEMBLY_TIERS } from '@/lib/pricing/assembly-tiers';
import { listPricePresets } from '@/services/makerworld-price-preset.service';
import { setPricePresetActiveAction } from './actions';

function formatVnd(value: number | null) {
  return value === null ? '—' : `${value.toLocaleString('vi-VN')}đ`;
}

// Phase B Tầng 1 (makerworld-phase-b-storefront-estimate.md §5): the verified MakerWorld prices the
// storefront shows. "Giá hiện tại" is recomputed with today's pricing config + material costs —
// exactly what a customer sees now.
export default async function MakerWorldPricesPage() {
  const session = await requireAdmin();
  const presets = await listPricePresets();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Giá MakerWorld trên Storefront</h1>
      <p className="text-sm text-muted-foreground">
        Mỗi dòng là một profile + phương án đã được phân tích trong panel MakerWorld (trang Custom request → &quot;Lưu làm giá Storefront&quot;).
        Khách dán link mẫu này ở /custom-print sẽ thấy giá ở cột &quot;Giá hiện tại&quot; — tự cập nhật khi đổi cấu hình giá hoặc giá nhựa.
      </p>
      <Card>
        <CardHeader><CardTitle>Danh sách ({presets.filter((p) => p.isActive).length} đang bật)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mẫu / profile</TableHead>
                <TableHead>Phương án</TableHead>
                <TableHead>Giá lúc lưu</TableHead>
                <TableHead>Giá hiện tại</TableHead>
                <TableHead>Cập nhật</TableHead>
                <TableHead className="text-right">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {presets.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-sm text-muted-foreground">Chưa có giá nào. Vào một Custom request, phân tích link MakerWorld rồi bấm &quot;Lưu làm giá Storefront&quot;.</TableCell></TableRow>
              ) : presets.map((preset) => (
                <TableRow key={preset.id} className={preset.isActive ? '' : 'opacity-60'}>
                  <TableCell>
                    <a href={preset.sourceUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{preset.modelTitle}</a>
                    <p className="text-xs text-muted-foreground">{preset.profileTitle} · #{preset.profileId}</p>
                  </TableCell>
                  <TableCell>{ASSEMBLY_TIERS[preset.tier].label}</TableCell>
                  <TableCell>{formatVnd(preset.finalPriceVndAtSave)}</TableCell>
                  <TableCell>
                    {preset.isActive && preset.currentPriceVnd === null
                      ? <span className="text-xs text-destructive">Không tính được (thiếu cấu hình/đơn giá)</span>
                      : formatVnd(preset.currentPriceVnd)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(preset.updatedAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant={preset.isActive ? 'default' : 'secondary'}>{preset.isActive ? 'Đang bật' : 'Đã tắt'}</Badge>
                      {session.role === 'OWNER' ? (
                        <ActionForm action={setPricePresetActiveAction.bind(null, preset.id, !preset.isActive)}>
                          <Button type="submit" size="sm" variant="outline">{preset.isActive ? 'Tắt' : 'Bật'}</Button>
                        </ActionForm>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
