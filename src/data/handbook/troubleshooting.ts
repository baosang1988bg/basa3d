import type { HandbookDefect } from './types';

// Classic defects. Fixes are ordered cheapest/most-likely first: clean & dry → mechanics →
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
    name: 'Cong vênh góc (warping)',
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
    name: 'Kéo tơ / mạng nhện (stringing)',
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
    name: 'Thiếu nhựa / tắc đầu phun (under-extrusion)',
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
    name: 'Lệch lớp (layer shift)',
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
    name: 'Chân voi (elephant foot)',
    symptom: 'Vài lớp dưới cùng phình ra, chi tiết lắp ghép bị kẹt.',
    fixes: [
      'Nâng Z-offset một chút — lớp đầu đang bị ép quá mức.',
      'Giảm nhiệt bàn 5 °C sau lớp đầu.',
      'Dùng tuỳ chọn bù chân voi (elephant foot compensation) 0.1–0.2 mm.',
      'Vát mép 0.4 mm ở cạnh đáy trong thiết kế.',
    ],
  },
  {
    id: 'z-banding',
    name: 'Gợn sóng theo tầng (Z-banding)',
    symptom: 'Các đường sọc ngang lồi lõm xuất hiện lặp lại đều đặn hoặc ngẫu nhiên dọc theo chiều cao trục Z.',
    fixes: [
      'Vệ sinh ren trục vít me Z và bôi mỡ chuyên dụng; kiểm tra khớp nối mềm giữa động cơ và trục không bị lệch.',
      'Kiểm tra con lăn hoặc thanh trượt trục Z chạy êm, không quá chặt gây sượng hoặc quá lỏng gây rơ.',
      'Chạy cân chỉnh PID cho đầu phun và bàn in để nhiệt độ không dao động phập phù khi đùn.',
      'Chọn chiều cao lớp là bội số của bước ren trục Z (magic numbers, ví dụ 0.16 mm hoặc 0.20 mm).',
    ],
  },
  {
    id: 'pillowing',
    name: 'Nổi nốt sần / rách nóc (Pillowing)',
    symptom: 'Bề mặt phẳng trên cùng bị phồng rộp, lồi lõm hoặc thủng lỗ hở lộ khung infill bên dưới.',
    fixes: [
      'Tăng tốc độ quạt làm mát cho lớp trên cùng để sợi nhựa bắc cầu qua ô infill đóng rắn nhanh, không bị võng.',
      'Tăng số lớp mặt trên (top solid layers) lên ít nhất 4–6 lớp (độ dày nóc ≥ 0.8–1.0 mm).',
      'Tăng mật độ infill lên 15–20% hoặc đổi sang dạng infill đỡ nóc tốt hơn (như gyroid, cubic).',
      'Hạ nhiệt độ đầu phun 5–10 °C nếu nhựa quá nóng làm chảy sụp các đường bắc cầu qua ô rỗng.',
    ],
  },
];
