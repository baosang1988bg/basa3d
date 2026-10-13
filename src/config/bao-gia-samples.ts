// Phase 33 S6 (plan §7 "Giá tham khảo", O5): reference prices on /bao-gia are COMPUTED by the
// same engine as live estimates from these fixed metrics, so they can never drift from real
// prices. Shapes are simple solids approximating typical parts; the Owner can replace them.
import type { MeshMetrics } from '@/lib/pricing/mesh-metrics';

export type BaoGiaSample = {
  key: string;
  title: string;
  description: string;
  metrics: MeshMetrics;
  materialType: 'PLA' | 'PETG';
  infillPct: 15 | 20;
};

const box = (x: number, y: number, z: number): MeshMetrics => ({
  volumeMm3: x * y * z, surfaceMm2: 2 * (x * y + y * z + x * z), sizeMm: { x, y, z }, triangles: 12,
});

/** Open-top box with 2 mm walls and floor. */
function openBox(x: number, y: number, z: number, wall = 2): MeshMetrics {
  const ix = x - 2 * wall; const iy = y - 2 * wall; const iz = z - wall;
  const outer = 2 * (x * y + y * z + x * z) - x * y;
  const inner = ix * iy + 2 * (ix * iz + iy * iz);
  return { volumeMm3: x * y * z - ix * iy * iz, surfaceMm2: outer + inner + (x * y - ix * iy), sizeMm: { x, y, z }, triangles: 30 };
}

export const BAO_GIA_SAMPLES: BaoGiaSample[] = [
  { key: 'keychain', title: 'Móc khoá tên', description: '50 × 25 × 4 mm, PLA', metrics: box(50, 25, 4), materialType: 'PLA', infillPct: 15 },
  { key: 'box', title: 'Hộp đựng nhỏ', description: '80 × 60 × 40 mm, thành 2 mm, PLA', metrics: openBox(80, 60, 40), materialType: 'PLA', infillPct: 15 },
  { key: 'stand', title: 'Giá đỡ điện thoại', description: '80 × 70 × 90 mm, PETG', metrics: { volumeMm3: 60_000, surfaceMm2: 30_000, sizeMm: { x: 80, y: 70, z: 90 }, triangles: 5_000 }, materialType: 'PETG', infillPct: 20 },
  { key: 'figure', title: 'Mô hình cao', description: '40 × 40 × 150 mm, PLA', metrics: { volumeMm3: 55_000, surfaceMm2: 16_000, sizeMm: { x: 40, y: 40, z: 150 }, triangles: 200_000 }, materialType: 'PLA', infillPct: 15 },
];

/** O5 draft — written for BaSa3D (not copied); the Owner edits the wording. */
export const BAO_GIA_FAQ: Array<{ q: string; a: string }> = [
  { q: 'Giá trên trang này đã là giá chốt chưa?', a: 'Chưa. Đây là giá ước tính sơ bộ tính từ hình khối của file. Sau khi bạn gửi yêu cầu, xưởng kiểm tra file và gửi báo giá chính thức cho từng món qua Zalo/SĐT.' },
  { q: 'Tôi có cần tải file lên để xem giá không?', a: 'Không. File được phân tích ngay trên trình duyệt của bạn. File chỉ được tải lên (lưu riêng tư) khi bạn bấm gửi yêu cầu.' },
  { q: 'Trang này nhận những loại file nào?', a: 'File .stl và .obj, tối đa 10 file mỗi lần. File .3mf (Bambu Studio/Orca, MakerWorld) vui lòng gửi ở trang Đặt in theo yêu cầu — file .3mf đã slice cho giá chính xác theo slicer.' },
  { q: 'Vì sao có "giá tối thiểu cho mỗi món"?', a: 'Mỗi lần in đều có chi phí cố định (chuẩn bị máy, dọn bàn in, đóng gói), nên món rất nhỏ được tính theo mức tối thiểu. Mức này áp cho cả dòng (món × số lượng), không nhân theo từng cái.' },
  { q: 'Mô hình của tôi to hơn bàn in thì sao?', a: 'Món vượt khổ máy (256 mm mỗi chiều) sẽ hiện "Cần xưởng báo giá" — xưởng sẽ tư vấn chia nhỏ hoặc phương án khác.' },
  { q: 'File của tôi có được bảo mật không?', a: 'Có. File lưu ở kho riêng tư, chỉ nhân viên xử lý yêu cầu mở được. Xem thêm Chính sách bảo mật file thiết kế.' },
];
