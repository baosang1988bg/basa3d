import type { HandbookChecklistItem } from './types';

// Ids are persisted in localStorage (`basa3d_preflight_checklist:v1`). Rewording a step is fine;
// changing what a step *means* needs a new id (old ticks are then dropped by parseChecklistState).
export const HANDBOOK_CHECKLIST: HandbookChecklistItem[] = [
  { id: 'clean-bed', title: 'Vệ sinh bàn in', detail: 'Lau cồn IPA hoặc rửa nước rửa chén, để khô. Không chạm tay vào mặt in.' },
  { id: 'dry-filament', title: 'Kiểm tra nhựa khô', detail: 'Nhựa để ngoài trời ẩm trên 1–2 ngày (PETG, TPU, PA) nên sấy theo bảng vật liệu.' },
  { id: 'nozzle', title: 'Đầu phun sạch, đúng cỡ', detail: 'Không còn nhựa cháy bám ngoài; cỡ đầu phun khớp với cài đặt trong slicer.' },
  { id: 'profile', title: 'Đúng profile vật liệu', detail: 'Nhiệt đầu phun, nhiệt bàn và quạt khớp với loại nhựa đang lắp trên máy.' },
  { id: 'preview', title: 'Xem preview lát cắt', detail: 'Soát lớp đầu, support, phần nhô và khe khớp in liền trước khi gửi lệnh in.' },
  { id: 'enough-filament', title: 'Đủ nhựa cho bài in', detail: 'So khối lượng slicer báo với phần nhựa còn lại trên cuộn (cộng dư 10%).' },
  { id: 'watch-first-layer', title: 'Theo dõi lớp đầu tiên', detail: 'Đứng xem 1–2 lớp đầu: đường nhựa phải dẹt đều, bám chắc, không kéo theo đầu phun.' },
];
