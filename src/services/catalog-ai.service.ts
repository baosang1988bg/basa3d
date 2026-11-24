import { z } from 'zod';

export const productAiSuggestInputSchema = z.object({
  imageBase64: z.string().min(10).max(10 * 1024 * 1024).optional(),
  mimeType: z.string().optional().default('image/jpeg'),
  categories: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    )
    .optional(),
  hint: z.string().max(200).optional(),
});

export type ProductAiSuggestInput = z.input<typeof productAiSuggestInputSchema>;

export interface ProductAiSuggestion {
  suggestedNames: string[];
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  suggestedShortDescription: string;
  keywords: string[];
  source: 'local_ollama' | 'ai_vision' | 'fallback';
}

const DEFAULT_FALLBACK_NAMES = [
  'Mẫu in 3D Trang Trí Để Bàn',
  'Móc Khoá In 3D Sáng Tạo',
  'Mô Hình Khớp Nối Fidget Độc Đáo',
];

const DEFAULT_FALLBACK_DESCRIPTION =
  'Sản phẩm in 3D chất lượng cao, bề mặt hoàn thiện sắc nét, thiết kế tối ưu, thích hợp làm đồ trang trí bàn làm việc hoặc quà tặng độc đáo.';

/**
 * Builds standard fallback suggestions if AI vision is unavailable, times out, or produces unexpected output.
 */
export function buildFallbackSuggestion(
  hint?: string,
  categories?: { id: string; name: string }[]
): ProductAiSuggestion {
  const cleanHint = hint?.trim();
  const names = cleanHint
    ? [
        `${cleanHint} in 3D`,
        `Mô hình ${cleanHint} trang trí`,
        `Phụ kiện ${cleanHint} tiện ích`,
      ]
    : DEFAULT_FALLBACK_NAMES;

  let matchedCategoryId: string | null = null;
  let matchedCategoryName: string | null = null;

  if (cleanHint && categories && categories.length > 0) {
    const lowerHint = cleanHint.toLowerCase();
    const matched = categories.find(
      (c) =>
        lowerHint.includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(lowerHint)
    );
    if (matched) {
      matchedCategoryId = matched.id;
      matchedCategoryName = matched.name;
    }
  }

  return {
    suggestedNames: names,
    suggestedCategoryId: matchedCategoryId,
    suggestedCategoryName: matchedCategoryName,
    suggestedShortDescription: cleanHint
      ? `Mẫu ${cleanHint} được in 3D tỉ mỉ, độ bền cao, màu sắc tươi sáng, phù hợp sử dụng hàng ngày hoặc trang trí.`
      : DEFAULT_FALLBACK_DESCRIPTION,
    keywords: cleanHint ? [cleanHint, '3d print', 'decor'] : ['3d print', 'decor', 'gadget'],
    source: 'fallback',
  };
}

/**
 * Tries local Ollama Vision (e.g. LLaVA) on the machine's GPU (RTX 4060).
 * Returns null if Ollama is offline or fails, allowing automatic fallback to Gemini Cloud.
 */
export async function tryOllamaVision(
  cleanBase64: string,
  categories: { id: string; name: string }[],
  hint?: string
): Promise<ProductAiSuggestion | null> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);

    const categoriesPrompt =
      categories.length > 0
        ? categories.map((c) => `- ID: "${c.id}", Tên: "${c.name}"`).join('\n')
        : 'Chưa có danh mục cụ thể';

    const prompt = `Bạn là trợ lý cho xưởng in 3D BaSa3D tại Việt Nam.
Hãy quan sát ảnh mẫu in 3D này (gợi ý nếu có: "${hint || 'không'}").
Đặt 3 tên sản phẩm tiếng Việt chuẩn thương mại, ngắn gọn, hấp dẫn.
Danh mục của shop:
${categoriesPrompt}

Trả về đúng JSON theo mẫu sau, không giải thích gì thêm:
{
  "suggestedNames": ["Tên tiếng Việt 1", "Tên tiếng Việt 2", "Tên tiếng Việt 3"],
  "suggestedCategoryId": "id_khớp_hoặc_null",
  "suggestedShortDescription": "Mô tả ngắn tiếng Việt 1-2 câu...",
  "keywords": ["kw1", "kw2"]
}`;

    const res = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llava',
        prompt,
        format: 'json',
        images: [cleanBase64],
        stream: false,
        options: {
          temperature: 0.3,
        },
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) return null;

    const data = (await res.json()) as { response?: string };
    if (!data.response) return null;

    const parsed = JSON.parse(data.response) as {
      suggestedNames?: string[];
      suggestedCategoryId?: string | null;
      suggestedShortDescription?: string | null;
      keywords?: string[];
    };

    const validNames = Array.isArray(parsed.suggestedNames)
      ? parsed.suggestedNames
          .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
          .slice(0, 3)
      : [];

    if (validNames.length === 0) return null;

    let finalCategoryId: string | null = null;
    let finalCategoryName: string | null = null;
    if (parsed.suggestedCategoryId) {
      const found = categories.find((c) => c.id === parsed.suggestedCategoryId);
      if (found) {
        finalCategoryId = found.id;
        finalCategoryName = found.name;
      }
    }

    return {
      suggestedNames: validNames,
      suggestedCategoryId: finalCategoryId,
      suggestedCategoryName: finalCategoryName,
      suggestedShortDescription:
        parsed.suggestedShortDescription?.trim() || DEFAULT_FALLBACK_DESCRIPTION,
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((k): k is string => typeof k === 'string').slice(0, 5)
        : [],
      source: 'local_ollama',
    };
  } catch {
    return null;
  }
}

/**
 * Suggests product name, category, and short description.
 * Priority: Local Ollama Vision (RTX 4060) -> Cloud Gemini API -> Heuristic Fallback.
 */
export async function suggestProductMetadataFromImage(
  input: ProductAiSuggestInput
): Promise<ProductAiSuggestion> {
  const { imageBase64, mimeType = 'image/jpeg', categories = [], hint } = input;
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    // 1. Prioritize Local Ollama Vision on local machine (Zero token, private, offline, RTX 4060)
    const localResult = await tryOllamaVision(cleanBase64, categories, hint);
    if (localResult) {
      return localResult;
    }

    // 2. Fall back to Cloud Gemini API if API key is configured
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const categoriesPrompt =
          categories.length > 0
            ? categories.map((c) => `- ID: "${c.id}", Tên: "${c.name}"`).join('\n')
            : 'Chưa có danh mục cụ thể';

        const prompt = `Bạn là trợ lý chuyên nghiệp cho xưởng in 3D BaSa3D tại Việt Nam.
Nhiệm vụ: Hãy quan sát kỹ hình ảnh mẫu in 3D đính kèm (và gợi ý nếu có: "${hint || 'không có'}") để giúp nhân viên đặt tên sản phẩm và phân loại siêu nhanh.

Yêu cầu chi tiết:
1. Đặt đúng 3 tên sản phẩm tiếng Việt khác nhau (không quá 70 ký tự mỗi tên, viết hoa chữ cái đầu các từ chính, hấp dẫn, dễ bán, chuẩn SEO):
   - Tên 1: Trực diện, nêu đúng vật thể (VD: "Móc Khoá Mèo Thần Tài Khớp Nối 3D")
   - Tên 2: Mang tính quà tặng / trang trí bàn làm việc (VD: "Tượng Mèo Cử Động Để Bàn May Mắn")
   - Tên 3: Ngắn gọn hoặc gắn liền công năng / dòng sản phẩm (VD: "Mèo Flexi Fidget In 3D")
   TUYỆT ĐỐI KHÔNG đặt tên chung chung vô nghĩa như "Sản phẩm in 3D", "Mẫu in nhựa", "Vật phẩm 3D".
2. Chọn danh mục phù hợp nhất từ danh sách danh mục hiện có của shop sau đây:
${categoriesPrompt}
   Gán "suggestedCategoryId" đúng với ID trong danh sách trên. Nếu không có danh mục nào khớp, trả về null.
3. Viết 1 đoạn mô tả ngắn (suggestedShortDescription) 1-2 câu tiếng Việt (khoảng 25-45 từ) tóm tắt điểm nổi bật (khớp cử động linh hoạt / độ sắc nét / tính ứng dụng để bàn, decor, làm quà).
4. Keywords: 3 từ khoá tiếng Anh ngắn (1-3 từ) để tìm lại file gốc trên MakerWorld/Printables (VD: ["articulated cat", "flexi kitten", "desk toy"]).

Trả về ĐÚNG cấu trúc JSON hợp lệ sau, không kèm bất kỳ giải thích nào khác ngoài JSON:
{
  "suggestedNames": ["Tên 1", "Tên 2", "Tên 3"],
  "suggestedCategoryId": "id_hoặc_null",
  "suggestedCategoryName": "tên_danh_mục_hoặc_null",
  "suggestedShortDescription": "Mô tả ngắn tiếng Việt...",
  "keywords": ["kw1", "kw2", "kw3"]
}`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: prompt },
                    {
                      inline_data: {
                        mime_type: mimeType,
                        data: cleanBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                response_mime_type: 'application/json',
              },
            }),
            signal: controller.signal,
          }
        ).finally(() => clearTimeout(timeout));

        if (res.ok) {
          const geminiData = (await res.json().catch(() => null)) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

          if (rawText) {
            const parsed = JSON.parse(rawText) as {
              suggestedNames?: string[];
              suggestedCategoryId?: string | null;
              suggestedCategoryName?: string | null;
              suggestedShortDescription?: string | null;
              keywords?: string[];
            };

            const validNames = Array.isArray(parsed.suggestedNames)
              ? parsed.suggestedNames
                  .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
                  .slice(0, 3)
              : [];

            if (validNames.length > 0) {
              let finalCategoryId: string | null = null;
              let finalCategoryName: string | null = null;
              if (parsed.suggestedCategoryId) {
                const found = categories.find((c) => c.id === parsed.suggestedCategoryId);
                if (found) {
                  finalCategoryId = found.id;
                  finalCategoryName = found.name;
                }
              }

              return {
                suggestedNames: validNames,
                suggestedCategoryId: finalCategoryId,
                suggestedCategoryName: finalCategoryName || parsed.suggestedCategoryName || null,
                suggestedShortDescription:
                  parsed.suggestedShortDescription?.trim() || DEFAULT_FALLBACK_DESCRIPTION,
                keywords: Array.isArray(parsed.keywords)
                  ? parsed.keywords.filter((k): k is string => typeof k === 'string').slice(0, 5)
                  : [],
                source: 'ai_vision',
              };
            }
          }
        }
      } catch {
        // Fall back to heuristics
      }
    }
  }

  // 3. Fall back to smart heuristics
  return buildFallbackSuggestion(hint, categories);
}
