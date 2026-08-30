import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { listAllVariantsWithProductName } from '@/services/product.service';
import { getStockLevel, listInventoryMovements, listWarehouses } from '@/services/inventory.service';
import { recordMovementAction } from './actions';

const MOVEMENT_TYPES = [
  'PURCHASE',
  'PRODUCTION_IN',
  'SALE_OUT',
  'RETURN_IN',
  'DAMAGE_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'TRANSFER_IN',
  'TRANSFER_OUT',
];

export default async function InventoryPage() {
  const [variants, warehouses, { items: movements }] = await Promise.all([
    listAllVariantsWithProductName(),
    listWarehouses(),
    listInventoryMovements({ limit: 50 }),
  ]);

  const stockLevels = await Promise.all(
    variants.map(async (variant) => ({ variant, stock: await getStockLevel(variant.id) })),
  );

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const warehouseById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Tồn kho</h1>

      <Card>
        <CardHeader><CardTitle>Nhập kho / Điều chỉnh tồn kho</CardTitle></CardHeader>
        <CardContent>
          <form action={recordMovementAction} className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="productVariantId">Biến thể sản phẩm</Label>
              <select id="productVariantId" name="productVariantId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
                <option value="">— Chọn biến thể —</option>
                {variants.map((variant) => (
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
                {MOVEMENT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity">Số lượng</Label>
              <Input id="quantity" name="quantity" type="number" required />
              <p className="text-xs text-muted-foreground">
                Dương cho nhập kho (PURCHASE, PRODUCTION_IN, RETURN_IN, ADJUSTMENT_IN, TRANSFER_IN), âm cho xuất kho.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unitCost">Đơn giá (VND, tùy chọn)</Label>
              <Input id="unitCost" name="unitCost" type="number" min={0} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="note">Ghi chú (bắt buộc đối với điều chỉnh ADJUSTMENT_IN / ADJUSTMENT_OUT)</Label>
              <Textarea id="note" name="note" placeholder="Lý do điều chỉnh, tham chiếu..." />
            </div>
            <div className="col-span-2">
              <Button type="submit">Ghi nhận biến động</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tồn kho theo biến thể</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Thực tồn</TableHead>
                <TableHead className="text-right">Đã giữ</TableHead>
                <TableHead className="text-right">Khả dụng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockLevels.map(({ variant, stock }) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{variant.productName} — {variant.name}</TableCell>
                  <TableCell>{variant.sku}</TableCell>
                  <TableCell className="text-right">{stock.onHand}</TableCell>
                  <TableCell className="text-right">{stock.reserved}</TableCell>
                  <TableCell className="text-right">{stock.available}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Lịch sử biến động ({movements.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Biến thể</TableHead>
                <TableHead>Kho</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
                <TableHead>Ghi chú</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => {
                const variant = variantById.get(movement.productVariantId);
                const warehouse = warehouseById.get(movement.warehouseId);
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">
                      {variant ? `${variant.productName} — ${variant.sku}` : movement.productVariantId}
                    </TableCell>
                    <TableCell>{warehouse ? `${warehouse.name} (${warehouse.code})` : movement.warehouseId}</TableCell>
                    <TableCell><Badge variant="secondary">{movement.movementType}</Badge></TableCell>
                    <TableCell className="text-right">{movement.quantity}</TableCell>
                    <TableCell>{movement.note ?? '—'}</TableCell>
                    <TableCell>{new Date(movement.createdAt).toLocaleString('vi-VN')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
