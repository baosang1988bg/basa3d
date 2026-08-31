// VND has no minor unit (ADR-0010) — format as a thousands-grouped integer with the đ suffix.
export function formatVnd(amount: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}
