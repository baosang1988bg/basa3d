import type { HandbookTolerance } from './types';

// Clearance per side for FDM with a 0.4 mm nozzle after flow/XY calibration. Print a tolerance
// test on the target printer before committing to a design. OWNER REVIEW REQUIRED (see materials.ts).
export const HANDBOOK_TOLERANCES: HandbookTolerance[] = [
  {
    id: 'press-fit',
    fit: 'Ép chặt',
    clearanceMm: [0.05, 0.15],
    example: 'Chốt định vị, nam châm ép vào lỗ',
    note: 'Cần lực tay hoặc vồ cao su. Nhựa giòn (PLA) dễ nứt nếu khe quá nhỏ.',
  },
  {
    id: 'pin-in-hole',
    fit: 'Then / chốt xoay',
    clearanceMm: [0.15, 0.25],
    example: 'Trục xoay, chốt bản lề lắp sau',
    note: 'Lỗ đứng (theo trục Z) tròn và chính xác hơn lỗ nằm ngang.',
  },
  {
    id: 'sliding',
    fit: 'Trượt',
    clearanceMm: [0.2, 0.3],
    example: 'Nắp hộp trượt, ngăn kéo',
    note: 'Thêm vát mép 0.4–0.6 mm ở đầu ray để dễ lắp.',
  },
  {
    id: 'clearance',
    fit: 'Lắp lỏng, tháo dễ',
    clearanceMm: [0.3, 0.4],
    example: 'Nắp đậy, khay xếp chồng',
    note: 'Dùng khi chi tiết in bằng hai vật liệu hoặc hai máy khác nhau.',
  },
  {
    id: 'print-in-place',
    fit: 'Khớp in liền (print-in-place)',
    clearanceMm: [0.3, 0.5],
    example: 'Bản lề hộp, xích khớp, đồ chơi khớp động',
    note: 'Khe giữa hai phần không được dính lớp đầu — kiểm tra lát cắt trong slicer.',
  },
  {
    id: 'bolt-hole',
    fit: 'Lỗ bu lông xuyên',
    clearanceMm: [0.2, 0.3],
    example: 'Bu lông M3 → thiết kế lỗ Ø3.4–3.6 mm',
    note: 'Lỗ nằm ngang nên vẽ dạng giọt nước để in không cần support.',
  },
];
