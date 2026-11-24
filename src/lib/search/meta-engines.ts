/**
 * Meta Search Engines & 3D Model Ecosystems Registry
 * Provides deep-link generators, keyword optimization, and multi-engine query formatting.
 */

export interface ModelEngine {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  category: 'meta' | 'ecosystem' | 'chinese' | 'commercial';
  description: string;
  homeUrl: string;
  buildSearchUrl: (query: string) => string;
  iconName: string;
  featured?: boolean;
}

export const MODEL_ENGINES: ModelEngine[] = [
  {
    id: 'makerworld-cn',
    name: 'MakerWorld China (Bambu Lab)',
    shortName: 'MW China',
    badge: '🇨🇳 Nội địa TQ - Hot Trend',
    category: 'chinese',
    description: 'Kho mẫu thị trường Trung Quốc, nhiều mẫu gia dụng, đồ chơi cơ cấu hot trend Douyin/Xiaohongshu.',
    homeUrl: 'https://makerworld.com.cn',
    buildSearchUrl: (q) => `https://makerworld.com.cn/zh/search/models?keyword=${encodeURIComponent(q)}`,
    iconName: 'Globe',
    featured: true,
  },
  {
    id: 'makerworld-global',
    name: 'MakerWorld Global',
    shortName: 'MakerWorld',
    badge: '🌐 Đa màu AMS - Tối ưu Bambu',
    category: 'ecosystem',
    description: 'Cộng đồng quốc tế lớn nhất hiện nay của Bambu Lab. File 3MF tối ưu sẵn thông số in và đa màu.',
    homeUrl: 'https://makerworld.com',
    buildSearchUrl: (q) => `https://makerworld.com/en/search/models?keyword=${encodeURIComponent(q)}`,
    iconName: 'Sparkles',
    featured: true,
  },
  {
    id: 'yeggi',
    name: 'Yeggi 3D Search',
    shortName: 'Yeggi',
    badge: '🔍 Meta Search #1',
    category: 'meta',
    description: 'Công cụ tìm kiếm tổng hợp quét qua toàn bộ các web 3D trên thế giới, lọc được mẫu Free và Paid.',
    homeUrl: 'https://www.yeggi.com',
    buildSearchUrl: (q) => `https://www.yeggi.com/q/${encodeURIComponent(q)}/`,
    iconName: 'Search',
    featured: true,
  },
  {
    id: 'thangs',
    name: 'Thangs 3D',
    shortName: 'Thangs',
    badge: '⚡ Tìm kiếm Hình học & AR',
    category: 'meta',
    description: 'Công cụ tìm kiếm thông minh quét đa nền tảng, hỗ trợ tìm kiếm theo hình khối và preview 3D.',
    homeUrl: 'https://thangs.com',
    buildSearchUrl: (q) => `https://thangs.com/search/${encodeURIComponent(q)}?scope=all`,
    iconName: 'Layers',
    featured: true,
  },
  {
    id: 'printables',
    name: 'Printables (Prusa)',
    shortName: 'Printables',
    badge: '🛠️ Cơ khí & Đồ kỹ thuật',
    category: 'ecosystem',
    description: 'Thư viện của Prusa Research, nổi tiếng với các thiết kế cơ khí chính xác, mod máy và đồ tiện ích.',
    homeUrl: 'https://www.printables.com',
    buildSearchUrl: (q) => `https://www.printables.com/search/models?q=${encodeURIComponent(q)}`,
    iconName: 'Wrench',
  },
  {
    id: 'thingiverse',
    name: 'Thingiverse (UltiMaker)',
    shortName: 'Thingiverse',
    badge: '📦 Kho 2M+ Mẫu miễn phí',
    category: 'ecosystem',
    description: 'Thư viện mở lâu đời nhất thế giới với hơn 2 triệu mẫu STL miễn phí từ cộng đồng Maker.',
    homeUrl: 'https://www.thingiverse.com',
    buildSearchUrl: (q) => `https://www.thingiverse.com/search?q=${encodeURIComponent(q)}`,
    iconName: 'Box',
  },
  {
    id: 'cults3d',
    name: 'Cults3D',
    shortName: 'Cults3D',
    badge: '💎 Decor & Nghệ thuật',
    category: 'commercial',
    description: 'Sàn thiết kế 3D cao cấp về tượng, đèn nghệ thuật, đồ chơi print-in-place.',
    homeUrl: 'https://cults3d.com',
    buildSearchUrl: (q) => `https://cults3d.com/en/search?q=${encodeURIComponent(q)}`,
    iconName: 'Gem',
  },
];

/**
 * 3D Printing Domain Term Mappings (Vietnamese -> English & Chinese)
 * Helps translate Vietnamese common search intents into optimized model keywords.
 */
export const PRINT_DOMAIN_DICTIONARY: Record<string, { en: string; zh: string }> = {
  'tai nghe': { en: 'headphone stand', zh: '耳机支架' },
  'gia do tai nghe': { en: 'headphone stand hanger', zh: '耳机挂架' },
  'dien thoai': { en: 'phone stand holder', zh: '手机支架' },
  'gia do dien thoai': { en: 'phone stand adjustable', zh: '折叠手机支架' },
  'hop': { en: 'storage box organizer', zh: '收纳盒' },
  'hop dung': { en: 'storage box with lid', zh: '带盖收纳盒' },
  'ngan keo': { en: 'drawer organizer modular', zh: '抽屉收纳' },
  'ke': { en: 'shelf bracket mount', zh: '置物架' },
  'do choi': { en: 'fidget toy articulated', zh: '解压玩具' },
  'do choi xa stress': { en: 'fidget clicker toy', zh: '解压按压玩具' },
  'khop noi': { en: 'articulated print in place', zh: '一体打印可动关节' },
  'rong': { en: 'articulated dragon print in place', zh: '可动关节龙' },
  'con rong': { en: 'articulated dragon', zh: '关节龙' },
  'khang': { en: 'mechanical switch clicker', zh: '按键解压玩具' },
  'ban lam viec': { en: 'desk organizer setup', zh: '桌面收纳' },
  'day cap': { en: 'cable organizer clip management', zh: '理线器' },
  'kep day': { en: 'cable clip organizer', zh: '固线夹' },
  'chau cay': { en: 'succulent planter pot', zh: '多肉花盆' },
  'den': { en: 'lamp shade lithophane', zh: '台灯罩' },
  'den ngu': { en: 'night light lamp desk', zh: '小夜灯' },
  'moc khoa': { en: 'keychain articulated', zh: '钥匙扣' },
  'dong ho': { en: 'clock stand desk', zh: '桌面时钟' },
  'co cau': { en: 'gear mechanism print in place', zh: '机械结构玩具' },
  'banh rang': { en: 'planetary gear bearing', zh: '行星齿轮' },
  'quat': { en: 'fan duct mount cooler', zh: '风道导风罩' },
  'van phong': { en: 'office desk pen holder', zh: '办公笔筒' },
  'kem': { en: 'plier stand tool holder', zh: '钳子收纳架' },
  'dao': { en: 'hobby knife utility cutter', zh: '美工刀架' },
};

/**
 * Optimizes user input keyword: checks dictionary and suggests bilingual keywords.
 */
export function optimizeSearchKeywords(input: string): {
  normalized: string;
  suggestedEn?: string;
  suggestedZh?: string;
} {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return { normalized: '' };

  // Remove accents for simple matching
  const nonAccent = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  for (const [key, val] of Object.entries(PRINT_DOMAIN_DICTIONARY)) {
    if (nonAccent.includes(key)) {
      return {
        normalized,
        suggestedEn: val.en,
        suggestedZh: val.zh,
      };
    }
  }

  return { normalized };
}

/**
 * Builds Google Lens / Reverse Search query URL with 3D site restriction filters.
 */
export function buildGoogle3dSearchUrl(query: string): string {
  const dork = `${query} (site:makerworld.com OR site:makerworld.com.cn OR site:thingiverse.com OR site:printables.com) (filetype:stl OR filetype:3mf OR "download")`;
  return `https://www.google.com/search?q=${encodeURIComponent(dork)}`;
}

/**
 * Direct Links to Curated Trend Feeds for Owner/Admin
 */
export interface TrendFeedLink {
  id: string;
  title: string;
  source: string;
  category: 'ranking' | 'contest' | 'social';
  url: string;
  description: string;
  badge: string;
}

export const CURATED_TREND_FEEDS: TrendFeedLink[] = [
  {
    id: 'mw-cn-downloads',
    title: 'Top Tải Nhiều Nhất — MakerWorld CN',
    source: 'MakerWorld China',
    category: 'ranking',
    url: 'https://makerworld.com.cn/zh/models/rank/download',
    description: 'Bảng xếp hạng tải nhiều nhất tại Trung Quốc. Các mẫu đã được cộng đồng kiểm chứng, in nhiều.',
    badge: '🔥 Top 1 Download TQ',
  },
  {
    id: 'mw-cn-hot',
    title: 'Thịnh Hành Mới Nhất — MakerWorld CN',
    source: 'MakerWorld China',
    category: 'ranking',
    url: 'https://makerworld.com.cn/zh/search/models?keyword=&orderBy=hotScore',
    description: 'Các mẫu vừa ra mắt đang có tốc độ tăng trưởng tải và like cao nhất tuần.',
    badge: '⚡ Đang Hot',
  },
  {
    id: 'mw-cn-home',
    title: 'Gia Dụng & Đời Sống (家居生活) — MW CN',
    source: 'MakerWorld China',
    category: 'ranking',
    url: 'https://makerworld.com.cn/zh/categories/home-improvement',
    description: 'Các mẫu hộp kệ, giá treo, phụ kiện bếp/phòng tắm siêu thực dụng và dễ bán.',
    badge: '🏠 Dễ Bán',
  },
  {
    id: 'mw-global-contests',
    title: 'Cuộc Thi Thiết Kế — MakerWorld Global',
    source: 'MakerWorld Global',
    category: 'contest',
    url: 'https://makerworld.com/en/contests',
    description: 'Các giải đấu thiết kế hàng tuần của Bambu Lab. Nơi quy tụ các ý tưởng độc lạ và tinh xảo nhất.',
    badge: '🏆 Cuộc Thi Tuần',
  },
  {
    id: 'mw-global-trending',
    title: 'Trending Toàn Cầu — MakerWorld Global',
    source: 'MakerWorld Global',
    category: 'ranking',
    url: 'https://makerworld.com/en/search/models?keyword=&orderBy=hotScore',
    description: 'Bảng xếp hạng xu hướng quốc tế (Mỹ, Châu Âu), mạnh về decor cao cấp và mô hình nghệ thuật.',
    badge: '🌐 Toàn Cầu',
  },
  {
    id: 'douyin-3dprint',
    title: 'Video Hot Douyin: #3D打印',
    source: 'Douyin (TikTok Trung Quốc)',
    category: 'social',
    url: 'https://www.douyin.com/search/3D%E6%89%93%E5%8D%B0',
    description: 'Khám phá video in 3D triệu view trên Douyin. Chụp lại ảnh mẫu để search ngược ra file in!',
    badge: '📱 Video Triệu View',
  },
  {
    id: 'douyin-fidget',
    title: 'Video Đồ Chơi Xả Stress: #解压玩具 3D',
    source: 'Douyin (TikTok Trung Quốc)',
    category: 'social',
    url: 'https://www.douyin.com/search/%E8%A7%A3%E5%8E%8B%E7%8E%A9%E5%85%B7%203D%E6%89%93%E5%8D%B0',
    description: 'Các dòng đồ chơi vô cực, clicker, dao trọng lực mini luôn tạo cơn sốt trong giới trẻ.',
    badge: '🎲 Trend Đồ Chơi',
  },
  {
    id: 'printables-weekly',
    title: 'Top Tuần Printables (Prusa)',
    source: 'Printables',
    category: 'ranking',
    url: 'https://www.printables.com/model?period=week&order=trending',
    description: 'Tuyển tập các mẫu cơ khí, dụng cụ xưởng, đồ công nghệ được tải nhiều nhất 7 ngày qua.',
    badge: '⚙️ Đồ Cơ Khí',
  },
  {
    id: 'thangs-leaderboard',
    title: 'Bảng Xếp Hạng Designer — Thangs',
    source: 'Thangs',
    category: 'ranking',
    url: 'https://thangs.com/designer-leaderboard',
    description: 'Theo dõi các nhà thiết kế 3D hàng đầu thế giới (Zou3D, Cinderwing, Zack Freedman,...).',
    badge: '⭐ Top Designers',
  },
];
