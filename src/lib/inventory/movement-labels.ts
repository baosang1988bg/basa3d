// Phase 52 P4: Vietnamese labels for the ledger — staff never have to read the enum names.
export const MOVEMENT_TYPE_LABELS: Record<string, { label: string; tone: 'in' | 'out' | 'neutral' }> = {
  PRODUCTION_IN: { label: 'In xong nhập kho', tone: 'in' },
  PURCHASE: { label: 'Nhập hàng ngoài', tone: 'in' },
  RETURN_IN: { label: 'Khách trả / huỷ đơn', tone: 'in' },
  ADJUSTMENT_IN: { label: 'Kiểm kê (+)', tone: 'in' },
  TRANSFER_IN: { label: 'Chuyển kho đến', tone: 'neutral' },
  SALE_OUT: { label: 'Xuất bán', tone: 'out' },
  DAMAGE_OUT: { label: 'Hàng hỏng', tone: 'out' },
  ADJUSTMENT_OUT: { label: 'Kiểm kê (−)', tone: 'out' },
  TRANSFER_OUT: { label: 'Chuyển kho đi', tone: 'neutral' },
};

export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  quick_restock: 'Nhập kho nhanh',
  order: 'Đơn hàng',
};

export function movementLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type]?.label ?? type;
}
