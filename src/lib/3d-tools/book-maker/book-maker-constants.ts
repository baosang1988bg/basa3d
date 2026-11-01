import type { BookFormatInfo } from './book-maker-types';

export const BOOK_PALETTE = [
  { id: 'pink', label: 'Hồng phấn (Pink)', hex: '#F28DB2' },
  { id: 'black', label: 'Đen (Black)', hex: '#1E1E20' },
  { id: 'charcoal', label: 'Than chì (Charcoal)', hex: '#36373B' },
  { id: 'white', label: 'Trắng sữa (White)', hex: '#F3F2EE' },
  { id: 'blue', label: 'Xanh dương (Blue)', hex: '#4A90E2' },
  { id: 'green', label: 'Xanh ngọc (Sage Green)', hex: '#7BC47F' },
  { id: 'orange', label: 'Cam san hô (Coral)', hex: '#E07A5F' },
  { id: 'yellow', label: 'Vàng kem (Pastel Yellow)', hex: '#F4D35E' },
  { id: 'purple', label: 'Tím lavender (Lavender)', hex: '#9B5DE5' },
];

export const BOOK_FORMATS: BookFormatInfo[] = [
  { id: 'V-MINI', orient: 'V', code: 'MINI', label: 'Instax Mini (Dọc)', folder: 'INSTAX MINI', photo: [54, 86], P: 54.4, Lov: 10, Lh: 49.144, Dr: 0, pageDx: -2.9, dat: 'V-MINI.dat', datKB: 988 },
  { id: 'V-SQUARE', orient: 'V', code: 'SQUARE', label: 'Instax Square (Dọc)', folder: 'INSTAX SQUARE', photo: [72, 86], P: 72.4, Lov: 10, Lh: 49.144, Dr: 18, pageDx: 6.1, dat: 'V-SQUARE.dat', datKB: 981 },
  { id: 'V-WIDE', orient: 'V', code: 'WIDE', label: 'Instax Wide (Dọc)', folder: 'INSTAX WIDE', photo: [108, 86], P: 108.4, Lov: 10, Lh: 49.144, Dr: 54, pageDx: 24.1, dat: 'V-WIDE.dat', datKB: 965 },
  { id: 'V-GO', orient: 'V', code: 'GO', label: 'Polaroid Go (Dọc)', folder: 'POLAROID GO', photo: [53.9, 66.6], P: 54.3, Lov: 10, Lh: 39.444, Dr: -0.1, pageDx: -2.95, dat: 'V-GO.dat', datKB: 942 },
  { id: 'V-600', orient: 'V', code: '600', label: 'Polaroid (Dọc)', folder: 'POLAROID 600 or i-Type or SX-70', photo: [88.5, 107.5], P: 88.9, Lov: 11.5, Lh: 59.894, Dr: 36, pageDx: 14.35, dat: 'V-600.dat', datKB: 975 },
  { id: 'V-PB', orient: 'V', code: 'PB', label: 'Photobox (Dọc)', folder: 'PHOTOBOX', photo: [35.1, 50.8], P: 35.5, Lov: 10, Lh: 31.544, Dr: -18.9, pageDx: -12.35, dat: 'V-PB.dat', datKB: 949 },
  { id: 'V-69', orient: 'V', code: '69', label: '6 × 9 cm (Dọc)', folder: '6x9', photo: [63.5, 88.9], P: 63.9, Lov: 10, Lh: 50.594, Dr: 9.5, pageDx: 1.85, dat: 'V-69.dat', datKB: 979 },
  { id: 'V-913', orient: 'V', code: '913', label: '9 × 13 cm (Dọc)', folder: '9x13', photo: [89, 127], P: 89.4, Lov: 13.5, Lh: 69.644, Dr: 38.5, pageDx: 14.6, dat: 'V-913.dat', datKB: 1250 },
  { id: 'V-1015', orient: 'V', code: '1015', label: '10 × 15 cm (Dọc)', folder: '10x15', photo: [102, 152], P: 102.4, Lov: 15, Lh: 82.144, Dr: 53, pageDx: 21.1, dat: 'V-1015.dat', datKB: 1233 },
  { id: 'H-MINI', orient: 'H', code: 'MINI', label: 'Instax Mini (Ngang)', folder: 'INSTAX MINI', photo: [86, 54], P: 86.4, Lov: 10, Lh: 33.144, Dr: 32, pageDx: 13.1, dat: 'H-MINI.dat', datKB: 1414 },
  { id: 'H-SQUARE', orient: 'H', code: 'SQUARE', label: 'Instax Square (Ngang)', folder: 'INSTAX SQUARE', photo: [86, 72], P: 86.4, Lov: 10, Lh: 42.144, Dr: 32, pageDx: 13.1, dat: 'H-SQUARE.dat', datKB: 1455 },
  { id: 'H-WIDE', orient: 'H', code: 'WIDE', label: 'Instax Wide (Ngang)', folder: 'INSTAX WIDE', photo: [86, 108], P: 86.4, Lov: 11.5, Lh: 60.144, Dr: 33.5, pageDx: 13.1, dat: 'H-WIDE.dat', datKB: 1536 },
  { id: 'H-GO', orient: 'H', code: 'GO', label: 'Polaroid Go (Ngang)', folder: 'POLAROID GO', photo: [66.6, 53.9], P: 67, Lov: 10, Lh: 33.094, Dr: 12.6, pageDx: 3.4, dat: 'H-GO.dat', datKB: 1385 },
  { id: 'H-600', orient: 'H', code: '600', label: 'Polaroid (Ngang)', folder: 'POLAROID 600 or i-Type or SX-70', photo: [107.5, 88.5], P: 107.9, Lov: 10, Lh: 50.394, Dr: 53.5, pageDx: 23.85, dat: 'H-600.dat', datKB: 1410 },
  { id: 'H-69', orient: 'H', code: '69', label: '6 × 9 cm (Ngang)', folder: '6x9', photo: [88.9, 63.5], P: 89.3, Lov: 10, Lh: 37.894, Dr: 34.9, pageDx: 14.55, dat: 'H-69.dat', datKB: 1386 },
  { id: 'H-913', orient: 'H', code: '913', label: '9 × 13 cm (Ngang)', folder: '9x13', photo: [127, 89], P: 127.4, Lov: 13.5, Lh: 50.644, Dr: 76.5, pageDx: 33.6, dat: 'H-913.dat', datKB: 1395 },
  { id: 'H-1015', orient: 'H', code: '1015', label: '10 × 15 cm (Ngang)', folder: '10x15', photo: [152, 102], P: 152.4, Lov: 22.5, Lh: 57.144, Dr: 110.5, pageDx: 46.1, dat: 'H-1015.dat', datKB: 1479 },
];

export const DEFAULT_BOOK_CONFIG = {
  formatId: 'V-MINI',
  pages: 10,
  frontCoverType: 'blank' as const,
  hingeType: 'snap' as const,
  coverColor: '#F28DB2',
  pageColor: '#F3F2EE',
  foldProgress: 0.0,
};

export const MIN_PAGES = 2;
export const MAX_PAGES = 20;

export const PITCH = 3.689;
export const AXIS_X = -35.2;
