import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireOwner } from '@/lib/auth/require-admin';
import { getCurrentPricingConfig, listPricingConfigs } from '@/services/pricing-config.service';
import { createPricingConfigAction } from './actions';

// OWNER-only page (system pricing parameters — phase-9.md decision #3). requireOwner() enforces
// this even if a STAFF account navigates here directly by URL.
export default async function PricingSettingsPage() {
  await requireOwner();
  const [current, history] = await Promise.all([getCurrentPricingConfig(), listPricingConfigs(20)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Cấu hình giá</h1>
      <p className="text-sm text-muted-foreground">
        Tham số đầu vào cho công cụ tính giá đề xuất (docs/product/catalog-spec.md §4). Mỗi lần lưu
        tạo một bản ghi mới — không sửa lại bản cũ, để mọi Báo giá/Sản phẩm đã tạo trước đó vẫn tra
        ngược đúng cấu hình đã dùng để tính giá tại thời điểm đó.
      </p>

      <Card>
        <CardHeader><CardTitle>Tạo cấu hình mới</CardTitle></CardHeader>
        <CardContent>
          <form action={createPricingConfigAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="electricityVndPerKwh">Giá điện (VND/kWh)</Label>
              <Input id="electricityVndPerKwh" name="electricityVndPerKwh" type="number" min={0} step="1" defaultValue={current?.electricityVndPerKwh ?? 3500} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="printerPowerKw">Công suất máy in (kW)</Label>
              <Input id="printerPowerKw" name="printerPowerKw" type="number" min={0} step="0.01" defaultValue={current?.printerPowerKw ?? 0.2} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="machinePriceVnd">Giá máy in (VND)</Label>
              <Input id="machinePriceVnd" name="machinePriceVnd" type="number" min={0} step="1" defaultValue={current?.machinePriceVnd ?? 15_000_000} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="machineLifetimeHours">Tuổi thọ máy (giờ)</Label>
              <Input id="machineLifetimeHours" name="machineLifetimeHours" type="number" min={1} step="1" defaultValue={current?.machineLifetimeHours ?? 10_000} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="laborVndPerHour">Đơn giá nhân công (VND/giờ)</Label>
              <Input id="laborVndPerHour" name="laborVndPerHour" type="number" min={0} step="1" defaultValue={current?.laborVndPerHour ?? 35_000} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="packagingFeeVnd">Chi phí đóng gói cố định (VND)</Label>
              <Input id="packagingFeeVnd" name="packagingFeeVnd" type="number" min={0} step="1" defaultValue={current?.packagingFeeVnd ?? 5_000} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="failureBufferPct">% lỗi in dự phòng</Label>
              <Input id="failureBufferPct" name="failureBufferPct" type="number" min={0} max={99.99} step="0.01" defaultValue={current?.failureBufferPct ?? 10} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marginPct">% margin mong muốn</Label>
              <Input id="marginPct" name="marginPct" type="number" min={0} max={99.99} step="0.01" defaultValue={current?.marginPct ?? 40} required />
            </div>
            <div className="col-span-2"><Button type="submit">Lưu cấu hình mới</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lịch sử cấu hình ({history.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hiệu lực từ</TableHead>
                <TableHead>Điện</TableHead>
                <TableHead>Nhân công</TableHead>
                <TableHead>% lỗi in</TableHead>
                <TableHead>% margin</TableHead>
                <TableHead className="text-right">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((config) => (
                <TableRow key={config.id}>
                  <TableCell>{new Date(config.effectiveFrom).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>{Number(config.electricityVndPerKwh).toLocaleString('vi-VN')}đ/kWh</TableCell>
                  <TableCell>{Number(config.laborVndPerHour).toLocaleString('vi-VN')}đ/giờ</TableCell>
                  <TableCell>{config.failureBufferPct}%</TableCell>
                  <TableCell>{config.marginPct}%</TableCell>
                  <TableCell className="text-right">
                    {current?.id === config.id ? <Badge>Đang áp dụng</Badge> : <Badge variant="secondary">Lịch sử</Badge>}
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
