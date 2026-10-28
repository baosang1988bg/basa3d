import type { HandbookSection, HandbookTocItem } from './types';

// Phase 50 — nine chapters, written in-house (structure inspired by public FDM handbooks; no text
// copied or translated). Section ids are public anchors (`/cam-nang#vat-lieu`): do not rename.
// Bump HANDBOOK_UPDATED_AT whenever the content changes — it feeds JSON-LD `dateModified`.
export const HANDBOOK_UPDATED_AT = '2026-10-26';
export const HANDBOOK_PUBLISHED_AT = '2026-10-26';

export const HANDBOOK_SECTIONS: HandbookSection[] = [
  {
    id: 'nen-tang',
    number: '01',
    title: 'Nền tảng in FDM',
    summary: 'Máy in đùn nhựa hoạt động thế nào và những thuật ngữ bạn sẽ gặp mỗi ngày.',
    blocks: [
      {
        type: 'p',
        text: 'FDM (Fused Deposition Modeling) là công nghệ in 3D phổ biến nhất: sợi nhựa được đẩy vào đầu phun nóng chảy, rồi đắp thành từng lớp mỏng chồng lên nhau theo đường đi do phần mềm slicer tính sẵn. Mọi chất lượng của chi tiết — độ bền, độ mịn, độ chính xác — đều bắt nguồn từ ba yếu tố: nhựa, máy và cài đặt.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Slicer', definition: 'Phần mềm cắt mô hình 3D thành lớp và sinh G-code (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura…).' },
          { term: 'Layer height', definition: 'Chiều cao mỗi lớp. 0.2 mm là mức cân bằng; 0.12 mm mịn hơn nhưng lâu gần gấp đôi.' },
          { term: 'Wall / Perimeter', definition: 'Các vòng vách bao ngoài. Số vách quyết định độ bền nhiều hơn mật độ infill.' },
          { term: 'Infill', definition: 'Cấu trúc rỗng bên trong. 10–20% cho đồ trang trí, 30–50% cho chi tiết chịu lực.' },
          { term: 'Support', definition: 'Giàn đỡ tạm cho phần nhô ra; gỡ bỏ sau khi in.' },
          { term: 'Z-offset', definition: 'Khoảng cách đầu phun với bàn in ở lớp đầu — tinh chỉnh quan trọng nhất của máy.' },
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Chi tiết FDM không đồng đều theo mọi hướng',
        text: 'Liên kết giữa các lớp yếu hơn chính sợi nhựa. Hãy xoay chi tiết sao cho lực tác dụng chạy dọc theo lớp, không phải tách lớp ra.',
      },
    ],
  },
  {
    id: 'vat-lieu',
    number: '02',
    title: 'Vật liệu & bảo quản',
    summary: 'Chọn đúng nhựa cho công năng, và giữ nhựa khô để in ổn định.',
    blocks: [
      {
        type: 'p',
        text: 'Không có loại nhựa "tốt nhất", chỉ có loại hợp nhất với điều kiện sử dụng: nhiệt độ môi trường, tiếp xúc nước, tia UV, độ dẻo và khả năng của máy in. Bảng dưới là điểm khởi đầu — luôn đối chiếu với thông số in trên nhãn cuộn nhựa.',
      },
      { type: 'materials' },
      { type: 'h3', text: 'Độ ẩm — kẻ thù thầm lặng' },
      {
        type: 'p',
        text: 'Khí hậu Việt Nam thường có độ ẩm trên 70%. Nhựa hút ẩm gây kéo tơ, bề mặt sần, tiếng lách tách khi in và chi tiết giòn. PETG, TPU và PA hút ẩm nhanh nhất; PLA chịu được lâu hơn nhưng vẫn cần bảo quản.',
      },
      {
        type: 'list',
        items: [
          'Cất nhựa trong hộp kín hoặc túi zip có gói hút ẩm silica; thay/sấy lại gói hút ẩm khi đổi màu.',
          'Sấy bằng máy sấy nhựa chuyên dụng hoặc lò có nhiệt ổn định — không dùng lò vi sóng.',
          'Với PA và TPU, in thẳng từ hộp sấy để nhựa không hút ẩm lại trong lúc in.',
        ],
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Nhựa gia cường sợi (CF/GF)',
        text: 'Các loại PLA-CF, PETG-CF, PA-CF mài mòn đầu phun đồng rất nhanh. Dùng đầu phun thép tôi cứng (hardened steel) và cỡ ≥ 0.4 mm.',
      },
    ],
  },
  {
    id: 'thiet-ke-cho-in',
    number: '03',
    title: 'Chuẩn bị file & thiết kế cho in',
    summary: 'Những quy tắc thiết kế giúp chi tiết in được ngay lần đầu.',
    blocks: [
      {
        type: 'p',
        text: 'Một mô hình đẹp trên màn hình chưa chắc in được. Thiết kế cho in FDM (DfAM) là tuân theo giới hạn vật lý của việc đắp nhựa theo lớp.',
      },
      {
        type: 'list',
        items: [
          'Góc nhô: phần nghiêng dưới 45° so với phương thẳng đứng thường in được không cần support.',
          'Cầu nối (bridge): khoảng trống nằm ngang đến khoảng 20–30 mm có thể in vắt ngang nếu làm mát tốt.',
          'Độ dày vách tối thiểu: bằng 2 lần đường kính đầu phun (0.8 mm với đầu 0.4 mm); chi tiết chịu lực nên ≥ 1.6 mm.',
          'Chữ nổi/chìm: nét chữ ≥ 0.8 mm, độ cao/sâu ≥ 0.6 mm để đọc rõ.',
          'Mặt đáy phẳng, đủ rộng giúp bám bàn chắc và hạn chế support.',
        ],
      },
      { type: 'h3', text: 'Kiểm tra file trước khi gửi in' },
      {
        type: 'list',
        items: [
          'Định dạng: STL dùng được ở mọi nơi; 3MF giữ cả đơn vị, màu và cài đặt — ưu tiên 3MF khi có thể.',
          'Đơn vị: đảm bảo file xuất bằng milimét. Mô hình bé tí hoặc khổng lồ bất thường thường do sai đơn vị.',
          'Lưới kín (manifold): không có lỗ hở hoặc mặt đè lên nhau; slicer hiện đại tự sửa được lỗi nhỏ.',
        ],
      },
      {
        type: 'tool',
        toolId: 'bao-gia',
        title: 'Đã có file STL/3MF?',
        text: 'Tải file lên để xem kích thước, khối lượng và giá in dự kiến ngay trên trình duyệt — xưởng xác nhận lại trong giờ làm việc.',
        fallback: {
          title: 'Đã có file STL/3MF?',
          text: 'Gửi file cho xưởng để được kiểm tra khả năng in, gợi ý vật liệu và báo giá chi tiết.',
        },
      },
    ],
  },
  {
    id: 'slicer',
    number: '04',
    title: 'Slicer: thông số cốt lõi',
    summary: 'Năm nhóm cài đặt quyết định 90% chất lượng chi tiết.',
    blocks: [
      {
        type: 'p',
        text: 'Hãy bắt đầu từ profile chuẩn của hãng máy cho đúng loại nhựa, rồi chỉ thay đổi một thông số mỗi lần để biết chính xác điều gì tạo ra khác biệt.',
      },
      {
        type: 'terms',
        items: [
          { term: 'Chiều cao lớp', definition: '0.2 mm cho đa số chi tiết; 0.12–0.16 mm cho tượng, chữ nhỏ; 0.28 mm cho chi tiết thô cần nhanh.' },
          { term: 'Số vách', definition: '2 vách cho đồ trang trí; 3–4 vách cho chi tiết lắp ráp, chịu lực, có ren.' },
          { term: 'Infill', definition: 'Gyroid hoặc cubic cho độ bền đều mọi hướng; 15% là đủ cho phần lớn nhu cầu.' },
          { term: 'Support', definition: 'Tree/organic support dễ gỡ, ít vết hơn; dùng chặn support (blocker) cho vùng không cần.' },
          { term: 'Tốc độ & làm mát', definition: 'Tốc độ cao cần nhiệt cao hơn; phần nhô và cầu nối cần quạt mạnh (trừ ABS/ASA/PA).' },
        ],
      },
      {
        type: 'callout',
        tone: 'tip',
        title: 'Muốn chi tiết bền hơn?',
        text: 'Thêm vách hiệu quả hơn tăng infill. Từ 2 lên 4 vách thường tăng độ bền rõ rệt trong khi chỉ tốn thêm một ít nhựa.',
      },
      { type: 'presets' },
      { type: 'h3', text: 'Một chi tiết tự in tốn bao nhiêu?' },
      { type: 'cost-calculator' },
      {
        type: 'tool',
        toolId: 'organizer',
        title: 'Thực hành với Khay phân loại',
        text: 'Tạo khay chia ngăn theo kích thước ngăn kéo của bạn và tải về file in sẵn — ví dụ điển hình về vách mỏng, đáy phẳng, không cần support.',
      },
    ],
  },
  {
    id: 'lop-dau',
    number: '05',
    title: 'Bàn in, lớp đầu & checklist trước khi in',
    summary: 'Lớp đầu tốt là một nửa bài in thành công.',
    blocks: [
      {
        type: 'p',
        text: 'Phần lớn bài in hỏng bắt nguồn từ lớp đầu tiên: bám không chắc, ép quá dẹt hoặc quá cao. Dành vài phút kiểm tra trước khi in rẻ hơn rất nhiều so với một cuộn nhựa bị bỏ phí.',
      },
      {
        type: 'list',
        items: [
          'Lớp đầu đúng: đường nhựa dẹt nhẹ, các đường liền nhau, bề mặt mịn không có rãnh.',
          'Quá cao: sợi nhựa tròn, tách rời, dễ bị kéo bong.',
          'Quá thấp: bề mặt trong mờ, có gờ, đầu phun cào lên lớp nhựa.',
        ],
      },
      { type: 'h3', text: 'Checklist 7 bước trước khi bấm in' },
      { type: 'checklist' },
    ],
  },
  {
    id: 'nhieu-mau',
    number: '06',
    title: 'In nhiều màu & hoàn thiện bề mặt',
    summary: 'Đổi màu theo lớp, in đa màu với AMS và giảm lãng phí nhựa xả.',
    blocks: [
      {
        type: 'p',
        text: 'Có hai cách phổ biến: đổi màu theo độ cao lớp (máy một đầu phun, dừng in để thay nhựa) và in đa màu tự động bằng hệ thống nạp nhiều cuộn như AMS. Cách thứ hai linh hoạt hơn nhưng mỗi lần đổi màu đều phải xả bỏ một lượng nhựa.',
      },
      {
        type: 'list',
        items: [
          'Gom các vùng cùng màu vào cùng dải độ cao để giảm số lần đổi màu.',
          'Dùng tuỳ chọn "xả vào infill" hoặc "xả vào vật thể" để tận dụng nhựa xả.',
          'Chữ và logo nhiều màu nên đặt nằm ngang trên mặt trên — chỉ đổi màu ở vài lớp cuối.',
          'Bề mặt trên mịn hơn khi bật ironing (là phẳng); mặt dưới đẹp hơn khi in trên bàn PEI vân/nhẵn tuỳ hiệu ứng.',
        ],
      },
      {
        type: 'tool',
        toolId: 'keychain-blocks',
        title: 'Tự thiết kế móc khoá nhiều màu',
        text: 'Ghép khối, chọn màu và xuất file 3MF đã chia màu theo lớp — in được trên máy có AMS hoặc đổi màu thủ công.',
      },
    ],
  },
  {
    id: 'dung-sai',
    number: '07',
    title: 'Dung sai & lắp ghép',
    summary: 'Khe hở bao nhiêu là đủ để chi tiết lắp vừa, xoay trơn hoặc ép chặt.',
    blocks: [
      {
        type: 'p',
        text: 'Nhựa nóng chảy luôn phình ra một chút so với đường đi lý thuyết, nên hai chi tiết vẽ khít 0 mm sẽ không lắp được. Khe hở dưới đây tính cho mỗi bên, với đầu phun 0.4 mm đã hiệu chỉnh flow.',
      },
      { type: 'tolerances' },
      { type: 'fit-calculator' },
      {
        type: 'callout',
        tone: 'tip',
        title: 'In mẫu thử dung sai trước',
        text: 'Mỗi máy, mỗi cuộn nhựa cho kết quả khác nhau. Một mẫu thử nhỏ với các khe 0.1–0.5 mm tốn 15 phút nhưng tiết kiệm nhiều lần in lại.',
      },
      {
        type: 'tool',
        toolId: 'hinge-box',
        title: 'Hộp bản lề in liền',
        text: 'Nhập kích thước, công cụ tự tính khe khớp bản lề in-place và xuất file in một lần là dùng được.',
      },
    ],
  },
  {
    id: 'xu-ly-loi',
    number: '08',
    title: 'Xử lý lỗi in thường gặp',
    summary: 'Sáu lỗi kinh điển và thứ tự khắc phục từ rẻ đến tốn công.',
    blocks: [
      {
        type: 'p',
        text: 'Nguyên tắc vàng: vệ sinh và sấy nhựa trước, kiểm tra cơ khí sau, chỉnh slicer cuối cùng. Thay đổi cài đặt khi bàn in bẩn hoặc nhựa ẩm chỉ khiến bạn đi vòng.',
      },
      { type: 'troubleshooting' },
      {
        type: 'tool',
        toolId: 'bao-gia',
        title: 'Không muốn tự xử lý?',
        text: 'Gửi file để xưởng in bằng profile đã hiệu chỉnh cho từng loại nhựa — xem giá ngay khi tải file.',
        fallback: {
          title: 'Không muốn tự xử lý?',
          text: 'Gửi file để xưởng in bằng profile đã hiệu chỉnh cho từng loại nhựa và báo giá chi tiết.',
        },
      },
    ],
  },
  {
    id: 'hau-ky',
    number: '09',
    title: 'Hậu kỳ & khi nào nên thuê xưởng',
    summary: 'Gỡ support, chà nhám, sơn — và lúc nào nên giao việc cho xưởng.',
    blocks: [
      {
        type: 'list',
        items: [
          'Gỡ support khi chi tiết đã nguội hẳn; dùng kìm mũi nhọn và dao gọt cho vết nhỏ.',
          'Chà nhám ướt từ giấy 220 → 400 → 800; lót sơn primer để lấp vân lớp trước khi sơn màu.',
          'Gắn ốc cấy nhiệt (heat-set insert) bằng mỏ hàn cho ren chịu tháo lắp nhiều lần.',
          'ABS/ASA có thể làm bóng bằng hơi acetone — chỉ làm ở nơi thông gió, tránh lửa.',
        ],
      },
      { type: 'h3', text: 'Khi nào nên thuê xưởng in?' },
      {
        type: 'list',
        items: [
          'Cần vật liệu kỹ thuật (PA, PC, CF) mà máy ở nhà không có buồng kín hoặc đầu phun thép.',
          'Số lượng nhiều hoặc cần đồng đều màu, kích thước giữa các lô.',
          'Chi tiết lớn hơn khổ in của máy, hoặc cần hậu kỳ sơn/hoàn thiện.',
          'Thời gian gấp — chi phí thử sai cao hơn giá thuê in.',
        ],
      },
      {
        type: 'tool',
        toolId: 'custom-print',
        title: 'Gửi yêu cầu in riêng',
        text: 'Mô tả nhu cầu, đính kèm file hoặc ảnh mẫu — xưởng tư vấn vật liệu, phương án in và báo giá.',
      },
    ],
  },
];

/** The only handbook data a client island (the TOC) receives — passed as props, never imported. */
export const HANDBOOK_TOC: HandbookTocItem[] = HANDBOOK_SECTIONS.map(({ id, number, title }) => ({ id, number, title }));
