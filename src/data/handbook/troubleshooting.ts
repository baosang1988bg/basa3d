import type { HandbookDefect } from './types';

// Six classic defects. Fixes are ordered cheapest/most-likely first: clean & dry → mechanics →
// slicer. Changing slicer settings before ruling out wet filament or a dirty bed wastes prints.
export const HANDBOOK_DEFECTS: HandbookDefect[] = [
  {
    id: 'bed-adhesion',
    name: 'Lớp đầu không bám bàn',
    symptom: 'Sợi nhựa lớp đầu bị kéo theo đầu phun, cuộn lại hoặc bong ở góc.',
    fixes: [
      'Rửa bàn in bằng nước rửa chén hoặc lau cồn IPA; không chạm tay lên mặt bàn.',
      'Chạy lại cân bàn và chỉnh Z-offset để lớp đầu hơi ép dẹt.',
      'Tăng nhiệt bàn 5 °C; giảm tốc độ lớp đầu xuống 20–30 mm/s.',
      'Thêm brim 3–5 mm hoặc dùng keo dán chuyên dụng cho vật liệu khó.',
    ],
  },
  {
    id: 'warping',
    name: 'Cong vênh góc',
    symptom: 'Góc chi tiết nhấc khỏi bàn khi in cao dần, đáy không phẳng.',
    fixes: [
      'Đóng cửa buồng in / chắn gió quạt trần, điều hoà.',
      'Kiểm tra bàn sạch và đủ nhiệt theo bảng vật liệu.',
      'Giảm quạt làm mát cho ABS/ASA/PA; thêm brim rộng hoặc mouse ears ở góc.',
      'Bo tròn góc nhọn trong thiết kế để giảm ứng suất co ngót.',
    ],
  },
  {
    id: 'stringing',
    name: 'Kéo tơ / mạng nhện',
    symptom: 'Sợi nhựa mảnh giăng giữa các trụ hoặc khoảng trống.',
    fixes: [
      'Sấy nhựa — nhựa ẩm là nguyên nhân phổ biến nhất (nghe tiếng lách tách khi in).',
      'Hạ nhiệt đầu phun 5–10 °C.',
      'Tăng khoảng/ tốc độ rút nhựa từng bước nhỏ (0.2 mm mỗi lần với direct drive).',
      'Bật tuỳ chọn tránh vượt qua vách ngoài (avoid crossing walls) trong slicer.',
    ],
  },
  {
    id: 'under-extrusion',
    name: 'Thiếu nhựa / tắc đầu phun',
    symptom: 'Vách mỏng, có lỗ hổng, lớp không liền; tiếng click ở bộ đùn.',
    fixes: [
      'Kiểm tra cuộn nhựa không bị rối, đường dẫn không bị kẹt.',
      'Vệ sinh hoặc thay đầu phun; làm cold pull để lấy cặn.',
      'Tăng nhiệt đầu phun 5–10 °C hoặc giảm tốc độ — máy có thể đang vượt giới hạn lưu lượng.',
      'Hiệu chỉnh flow ratio bằng mẫu thử của slicer.',
    ],
  },
  {
    id: 'layer-shift',
    name: 'Lệch lớp',
    symptom: 'Chi tiết bị "bậc thang" lệch ngang tại một độ cao.',
    fixes: [
      'Gỡ vật cản: chi tiết bong, support đổ, dây vướng đầu in.',
      'Kiểm tra độ căng dây đai và ốc puly trục X/Y.',
      'Giảm gia tốc và tốc độ di chuyển nếu máy rung mạnh.',
      'Bật Z-hop khi đầu in hay va vào phần đã in bị cong.',
    ],
  },
  {
    id: 'elephant-foot',
    name: 'Chân voi',
    symptom: 'Vài lớp dưới cùng phình ra, chi tiết lắp ghép bị kẹt.',
    fixes: [
      'Nâng Z-offset một chút — lớp đầu đang bị ép quá mức.',
      'Giảm nhiệt bàn 5 °C sau lớp đầu.',
      'Dùng tuỳ chọn bù chân voi (elephant foot compensation) 0.1–0.2 mm.',
      'Vát mép 0.4 mm ở cạnh đáy trong thiết kế.',
    ],
  },
];
