import { XMLParser } from 'fast-xml-parser';
import { query } from '../lib/db';
import { DomainError } from '../lib/domain-error';
import { createBlogCategory, createBlogPost } from './blog.service';

export interface RawRssItem {
  title: string;
  link: string;
  pubDate?: string;
  snippet?: string;
}

export interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export const DEFAULT_RSS_FEEDS = [
  'https://all3dp.com/feed/',
  'https://3dprintingindustry.com/feed/',
  'https://hackaday.com/blog/category/3d-printer-hacks/feed/',
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

function stripHtml(input: string): string {
  return input
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses raw RSS 2.0 or Atom XML content into a structured list of RawRssItem.
 */
export function parseRssXml(xmlText: string): RawRssItem[] {
  try {
    const parsed = parser.parse(xmlText);
    const items: RawRssItem[] = [];

    // RSS 2.0 channel.item
    const channelItems = parsed?.rss?.channel?.item;
    if (channelItems) {
      const rawList = Array.isArray(channelItems) ? channelItems : [channelItems];
      for (const item of rawList) {
        if (!item?.title) continue;
        const link = typeof item.link === 'string' ? item.link : item.link?.['#text'] ?? '';
        const snippet = item.description || item['content:encoded'] || '';
        items.push({
          title: stripHtml(String(item.title)),
          link: String(link).trim(),
          pubDate: item.pubDate ? String(item.pubDate) : undefined,
          snippet: stripHtml(String(snippet)).slice(0, 500),
        });
      }
      return items;
    }

    // Atom feed.entry
    const entries = parsed?.feed?.entry;
    if (entries) {
      const rawList = Array.isArray(entries) ? entries : [entries];
      for (const entry of rawList) {
        if (!entry?.title) continue;
        const link = typeof entry.link === 'string'
          ? entry.link
          : entry.link?.['@_href'] || entry.link?.['#text'] || '';
        const snippet = entry.summary || entry.content || '';
        items.push({
          title: stripHtml(typeof entry.title === 'string' ? entry.title : entry.title?.['#text'] ?? ''),
          link: String(link).trim(),
          pubDate: entry.published || entry.updated ? String(entry.published || entry.updated) : undefined,
          snippet: stripHtml(String(snippet)).slice(0, 500),
        });
      }
      return items;
    }

    return items;
  } catch (err) {
    console.error('[AI_NEWS_RSS_PARSE_ERROR]', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Fetches and aggregates latest RSS items from multiple sources with a short timeout.
 */
export async function fetchRssFeeds(urls: string[] = DEFAULT_RSS_FEEDS, maxItems = 10): Promise<RawRssItem[]> {
  const aggregated: RawRssItem[] = [];

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'BaSa3D-NewsBot/1.0 (+https://basa3d.vn)' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return;
        const xml = await response.text();
        const items = parseRssXml(xml);
        aggregated.push(...items.slice(0, 5));
      } catch (err) {
        console.warn(`[AI_NEWS_FEED_FETCH_FAILED] ${url}`, err instanceof Error ? err.message : err);
      }
    }),
  );

  return aggregated.slice(0, maxItems);
}

/**
 * Calls Google Gemini REST API to summarize and synthesize news items into a single high-quality Vietnamese article.
 */
export async function generateNewsArticleWithGemini(
  items: RawRssItem[],
  options: { apiKey?: string; dateStr?: string } = {},
): Promise<GeneratedArticle> {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new DomainError('GEMINI_NOT_CONFIGURED', 'GEMINI_API_KEY is not configured on the server.', 422);
  }

  if (items.length === 0) {
    throw new DomainError('NO_NEWS_ITEMS', 'No news items available to synthesize.', 400);
  }

  const promptItemsText = items
    .map((item, idx) => `[${idx + 1}] Tiêu đề: ${item.title}\nLink: ${item.link}\nNội dung tóm tắt: ${item.snippet}`)
    .join('\n\n');

  const systemInstruction = `Bạn là Trưởng ban biên tập kỹ thuật của Xưởng in 3D BaSa3D (Việt Nam).
Nhiệm vụ của bạn là tổng hợp các tin tức in 3D quốc tế gần nhất thành 1 bài viết điểm tin hấp dẫn, chuẩn SEO bằng tiếng Việt.
Phong cách viết: Chuyên nghiệp, thực tế, nhấn mạnh vào giá trị ứng dụng, kỹ thuật in FDM/SLA, vật liệu và xu hướng thị trường.

Yêu cầu định dạng đầu ra bắt buộc là JSON thuần tuý (JSON object hợp lệ) với cấu trúc sau:
{
  "title": "Tiêu đề bài viết hấp dẫn (khoảng 60-90 ký tự, có từ khoá in 3D, xu hướng hoặc công nghệ)",
  "excerpt": "Đoạn tóm tắt mở đầu 1-2 câu ngắn gọn, súc tích (dưới 400 ký tự)",
  "content": "Nội dung bài viết đầy đủ bằng cú pháp Markdown (gồm các đề mục ## 1., ## 2., nhận định 'Góc nhìn xưởng BaSa3D' và cuối bài có lời kêu gọi tham khảo Báo giá in 3D / Cẩm nang kỹ thuật của BaSa3D)",
  "tags": ["tin-tuc", "in-3d", "xu-huong", "cong-nghe"],
  "seoTitle": "Tiêu đề SEO (dưới 70 ký tự)",
  "seoDescription": "Mô tả SEO hấp dẫn (khoảng 140-160 ký tự)"
}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${systemInstruction}\n\nDanh sách tin tức thô thu thập được hôm nay (${options.dateStr || 'mới nhất'}):\n\n${promptItemsText}\n\nHãy chọn ra 2-4 tin nổi bật và giá trị nhất để viết thành một bài điểm tin hoàn chỉnh. Chỉ trả về duy nhất chuỗi JSON hợp lệ, không bọc trong markdown code block (không dùng \`\`\`json).`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  };

  const candidateModels = process.env.GEMINI_NEWS_MODEL
    ? [process.env.GEMINI_NEWS_MODEL]
    : ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash'];

  let lastError: Error | null = null;
  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        console.warn(`[GEMINI_API_RETRY] model=${model} status=${res.status}: ${errorBody.slice(0, 150)}`);
        lastError = new DomainError('GEMINI_API_ERROR', `Gemini API (${model}) returned status ${res.status}: ${errorBody.slice(0, 200)}`, 502);
        continue;
      }

      const data = await res.json();
      const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        lastError = new DomainError('GEMINI_EMPTY_RESPONSE', `Gemini (${model}) returned empty response.`, 502);
        continue;
      }

      const parsed = JSON.parse(textResponse) as GeneratedArticle;
      if (!parsed.title || !parsed.content) {
        throw new Error('Missing required fields in generated article.');
      }
      return {
        title: parsed.title.trim(),
        excerpt: parsed.excerpt?.trim() || '',
        content: parsed.content.trim(),
        tags: Array.isArray(parsed.tags) && parsed.tags.length > 0 ? parsed.tags : ['tin-tuc', 'in-3d', 'xu-huong'],
        seoTitle: parsed.seoTitle?.trim() || parsed.title.trim(),
        seoDescription: parsed.seoDescription?.trim() || parsed.excerpt?.trim() || '',
      };
    } catch (err) {
      if (err instanceof DomainError) {
        lastError = err;
      } else {
        lastError = new DomainError('GEMINI_API_ERROR', err instanceof Error ? err.message : String(err), 502);
      }
    }
  }

  throw lastError || new DomainError('GEMINI_ALL_MODELS_FAILED', 'All candidate Gemini models failed.', 502);
}

/**
 * Returns today's formatted date string (YYYY-MM-DD) in Asia/Ho_Chi_Minh timezone.
 */
export function getTodayDateString(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Finds or creates the default "Tin tức" category for blog posts.
 */
async function ensureNewsCategory(actorId: string): Promise<string> {
  const existing = await query<{ id: string }>('select id from blog_categories where slug = $1 limit 1', ['tin-tuc']);
  if (existing.rowCount && existing.rows[0]) {
    return existing.rows[0].id;
  }
  const created = await createBlogCategory({ name: 'Tin tức', slug: 'tin-tuc' }, actorId);
  return created.id;
}

export interface SyncDailyNewsResult {
  status: 'CREATED' | 'SKIPPED_ALREADY_EXISTS' | 'FAILED';
  slug: string;
  postId?: string;
  title?: string;
  message?: string;
}

/**
 * Main orchestration:
 * 1. Checks idempotency: if slug `diem-tin-in-3d-YYYY-MM-DD` already exists, skip (unless force=true).
 * 2. Fetches RSS feeds.
 * 3. Generates article with Gemini API.
 * 4. Ensures "Tin tức" category exists.
 * 5. Saves post to DB with status DRAFT (or PUBLISHED if autoPublish=true).
 */
export async function syncDaily3DNews(options: {
  force?: boolean;
  autoPublish?: boolean;
  actorId?: string;
  customDate?: string;
} = {}): Promise<SyncDailyNewsResult> {
  const actorId = options.actorId || '00000000-0000-4000-8000-0000000000aa';
  const dateStr = options.customDate || getTodayDateString();
  const slug = `diem-tin-in-3d-${dateStr}`;

  // 1. Idempotency check
  const existing = await query<{ id: string; title: string }>('select id, title from blog_posts where slug = $1 limit 1', [slug]);
  if (existing.rowCount && existing.rows[0] && !options.force) {
    return {
      status: 'SKIPPED_ALREADY_EXISTS',
      slug,
      postId: existing.rows[0].id,
      title: existing.rows[0].title,
      message: `Bài viết cho ngày ${dateStr} đã tồn tại (ID: ${existing.rows[0].id}).`,
    };
  }

  // 2. Fetch feeds
  const items = await fetchRssFeeds();
  if (items.length === 0) {
    throw new DomainError('NO_NEWS_FETCHED', 'Không tìm thấy tin tức mới từ các nguồn RSS.', 502);
  }

  // 3. Generate article with Gemini
  const article = await generateNewsArticleWithGemini(items, { dateStr });

  // 4. Ensure category
  const categoryId = await ensureNewsCategory(actorId);

  // 5. Save post
  const autoPublish = options.autoPublish ?? process.env.AUTO_PUBLISH_DAILY_NEWS === 'true';
  const postStatus = autoPublish ? 'PUBLISHED' : 'DRAFT';

  const created = await createBlogPost(
    {
      categoryId,
      title: article.title,
      slug,
      excerpt: article.excerpt,
      content: article.content,
      tags: article.tags,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      status: postStatus,
    },
    actorId,
  );

  return {
    status: 'CREATED',
    slug,
    postId: created.id,
    title: article.title,
    message: `Đã tạo bài viết điểm tin thành công (${postStatus}).`,
  };
}
