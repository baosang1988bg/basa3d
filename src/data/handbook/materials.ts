import type { HandbookMaterial, MaterialTag } from './types';

// Typical starting ranges for a 0.4 mm brass/hardened nozzle on a well-calibrated printer.
// OWNER REVIEW REQUIRED before production: every number here must be signed off by the workshop
// (phase-50-handbook.md "Rủi ro"). Always prefer the filament maker's label when it disagrees.
export const HANDBOOK_MATERIALS: HandbookMaterial[] = [
  {
    id: 'pla',
    name: 'PLA / PLA+',
    nozzleC: [195, 220],
    bedC: [50, 60],
    dryingC: [45, 50],
    dryingHours: [4, 6],
    fanPercent: [80, 100],
    enclosure: 'none',
    tags: ['beginner'],
    note: 'Dễ in nhất, ít cong vênh. Mềm ra từ khoảng 55–60 °C — không để trong ô tô nắng.',
  },
  {
    id: 'petg',
    name: 'PETG',
    nozzleC: [230, 250],
    bedC: [70, 85],
    dryingC: [60, 65],
    dryingHours: [4, 6],
    fanPercent: [30, 60],
    enclosure: 'none',
    tags: ['beginner'],
    note: 'Dai, chịu nước tốt. Dễ kéo tơ; bám quá chặt trên mặt PEI nhẵn — nên dùng keo/lớp lót.',
  },
  {
    id: 'abs',
    name: 'ABS',
    nozzleC: [240, 260],
    bedC: [95, 110],
    dryingC: [65, 80],
    dryingHours: [4, 6],
    fanPercent: [0, 20],
    enclosure: 'required',
    tags: ['enclosure', 'engineering'],
    note: 'Chịu nhiệt ~90–100 °C, xử lý bề mặt bằng hơi acetone được. Có mùi — cần buồng kín và thông gió.',
  },
  {
    id: 'asa',
    name: 'ASA',
    nozzleC: [240, 260],
    bedC: [95, 110],
    dryingC: [65, 80],
    dryingHours: [4, 6],
    fanPercent: [0, 30],
    enclosure: 'required',
    tags: ['enclosure', 'engineering'],
    note: 'Tương tự ABS nhưng bền tia UV — lựa chọn số một cho chi tiết ngoài trời.',
  },
  {
    id: 'tpu',
    name: 'TPU 95A',
    nozzleC: [220, 240],
    bedC: [40, 60],
    dryingC: [50, 55],
    dryingHours: [4, 8],
    fanPercent: [50, 100],
    enclosure: 'none',
    tags: ['flexible'],
    note: 'Dẻo, đàn hồi. In chậm (20–40 mm/s), giảm hoặc tắt rút nhựa; đường nạp nhựa phải ngắn, kín.',
  },
  {
    id: 'pa',
    name: 'PA (Nylon)',
    nozzleC: [250, 280],
    bedC: [70, 90],
    dryingC: [70, 80],
    dryingHours: [8, 12],
    fanPercent: [0, 30],
    enclosure: 'required',
    tags: ['enclosure', 'engineering'],
    note: 'Rất dai, chịu mài mòn. Hút ẩm cực nhanh — sấy kỹ và in thẳng từ hộp sấy.',
  },
  {
    id: 'pc',
    name: 'PC (Polycarbonate)',
    nozzleC: [260, 300],
    bedC: [100, 120],
    dryingC: [70, 80],
    dryingHours: [6, 8],
    fanPercent: [0, 20],
    enclosure: 'required',
    tags: ['enclosure', 'engineering'],
    note: 'Cứng, chịu nhiệt cao (~110 °C). Co ngót mạnh — cần buồng kín ấm và bàn in nóng ổn định.',
  },
];

export const MATERIAL_TAG_LABELS: Record<MaterialTag, string> = {
  beginner: 'Dễ in',
  enclosure: 'Cần buồng kín',
  flexible: 'Dẻo',
  engineering: 'Kỹ thuật',
};

export const ENCLOSURE_LABELS: Record<HandbookMaterial['enclosure'], string> = {
  none: 'Không cần',
  recommended: 'Nên có',
  required: 'Bắt buộc',
};
