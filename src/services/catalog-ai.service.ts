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

const DICT_KEYWORDS = [
  { en: ['dragon'], base: 'Rồng Khớp Nối Flexi' },
  { en: ['cat', 'kitten', 'feline'], base: 'Mèo Khớp Cử Động' },
  { en: ['dog', 'puppy', 'canine'], base: 'Chú Chó Trang Trí' },
  { en: ['frog'], base: 'Ếch Cử Động Flexi' },
  { en: ['skull'], base: 'Đầu Lâu Nghệ Thuật' },
  { en: ['vase', 'planter', 'pot'], base: 'Bình Hoa / Chậu Cây Decor' },
  { en: ['phone stand', 'holder', 'stand'], base: 'Giá Đỡ Điện Thoại Để Bàn' },
  { en: ['keychain', 'key ring', 'keyring'], base: 'Móc Khoá Cá Tính' },
  { en: ['fidget', 'spinner'], base: 'Đồ Chơi Fidget Xả Stress' },
  { en: ['sword', 'katana', 'blade'], base: 'Kiếm Katana Thu Gọn' },
  { en: ['box', 'container', 'case'], base: 'Hộp Đựng Mini Đa Năng' },
  { en: ['logo', 'sign', 'text', 'lettering', 'brand'], base: 'Biển Logo Để Bàn' },
  { en: ['figure', 'character', 'statue', 'action figure'], base: 'Mô Hình Nhân Vật' },
  { en: ['gear', 'mechanical', 'clockwork'], base: 'Khối Cơ Khí Bánh Răng' },
  { en: ['octopus'], base: 'Bạch Tuộc Cử Động' },
];

export function extractSubjectFromDescription(desc: string, hint?: string): string | null {
  const cleanHint = hint?.trim();
  if (cleanHint) return cleanHint;
  const lower = desc.toLowerCase();
  for (const item of DICT_KEYWORDS) {
    if (item.en.some((k) => lower.includes(k))) {
      return item.base;
    }
  }
  return null;
}

export function generateSmartNames(subject: string | null): string[] {
  if (subject) {
    return [
      `Mô hình ${subject} In 3D`,
      `${subject} Trang Trí Để Bàn Độc Đáo`,
      `${subject} (Bản Xưởng BaSa3D)`,
    ];
  }
  return [
    'Mẫu In 3D Thiết Kế Sáng Tạo',
    'Mô Hình Để Bàn Tinh Xảo',
    'Phụ Kiện In 3D Tiện Dụng',
  ];
}

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
  const names = generateSmartNames(cleanHint || null);

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
 * Dual-stage pipeline using local Ollama on RTX 4060:
 * Stage 1: Fast & factual visual feature extraction in English (LLaVA / Moondream).
 * Stage 2: High-accuracy Vietnamese commercial naming & categorization (Qwen 2.5 / DeepSeek).
 */
export async function tryOllamaVision(
  cleanBase64: string,
  categories: { id: string; name: string }[],
  hint?: string
): Promise<ProductAiSuggestion | null> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    // 1. Discover available Ollama models
    let visionModel = 'llava';
    let textModel: string | null = null;

    try {
      const tagsRes = await fetch(`${ollamaUrl}/api/tags`, { signal: controller.signal });
      if (tagsRes.ok) {
        const tagsData = (await tagsRes.json()) as { models?: { name: string }[] };
        const modelNames = (tagsData.models || []).map((m) => m.name.toLowerCase());

        // Check vision model
        if (modelNames.some((m) => m.startsWith('llava'))) visionModel = 'llava';
        else if (modelNames.some((m) => m.startsWith('moondream'))) visionModel = 'moondream';

        // Check smart multilingual text model
        if (modelNames.some((m) => m.startsWith('qwen2.5:7b'))) textModel = 'qwen2.5:7b';
        else if (modelNames.some((m) => m.startsWith('qwen2.5:14b'))) textModel = 'qwen2.5:14b';
        else if (modelNames.some((m) => m.startsWith('qwen2.5'))) textModel = modelNames.find((m) => m.startsWith('qwen2.5')) || null;
        else if (modelNames.some((m) => m.startsWith('deepseek-r1'))) textModel = modelNames.find((m) => m.startsWith('deepseek-r1')) || null;
      }
    } catch {
      // Tags probe failed, try default llava
    }

    // Stage 1: Visual Extraction in English (LLaVA / Moondream excels at this)
    const visionPrompt = `Describe the primary 3D printed object, animal, character, tool, or logo in this image concisely in 1-2 factual sentences. What is the specific subject, shape, color, and function?`;

    const visionRes = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: visionModel,
        prompt: visionPrompt,
        images: [cleanBase64],
        stream: false,
        options: { temperature: 0.1 },
      }),
      signal: controller.signal,
    });

    if (!visionRes.ok) {
      clearTimeout(timeout);
      return null;
    }

    const visionData = (await visionRes.json()) as { response?: string };
    const visualDescription = visionData.response?.trim() || '';
    if (!visualDescription) {
      clearTimeout(timeout);
      return null;
    }

    // Stage 2: Vietnamese Naming with Text Model (Qwen2.5) if available
    const categoriesPrompt =
      categories.length > 0
        ? categories.map((c) => `- ID: "${c.id}", Tên: "${c.name}"`).join('\n')
        : 'Chưa có danh mục cụ thể';

    if (textModel) {
      const qwenPrompt = `Bạn là trợ lý cho xưởng in 3D BaSa3D tại Việt Nam.
Một mẫu in 3D được quan sát thấy có đặc điểm: "${visualDescription}".
Gợi ý từ nhân viên xưởng (nếu có): "${hint || 'không'}".

Danh mục của shop:
${categoriesPrompt}

Hãy đặt đúng 3 tên sản phẩm tiếng Việt KHÁC NHAU, chuẩn thương mại, bám sát vật thể được nhận diện ở trên (tuyệt đối không đặt tên chung chung như "Sản phẩm in 3D", "Mẫu in nhựa"):
1. Tên trực diện: đúng tên vật thể/nhân vật (VD: "Mô Hình Rồng Khớp Nối In 3D", "Giá Đỡ Điện Thoại Hình Mèo")
2. Tên quà tặng / trang trí / công năng
3. Tên ngắn gọn / độc đáo

Trả về ĐÚNG cấu trúc JSON sau:
{
  "suggestedNames": ["Tên 1", "Tên 2", "Tên 3"],
  "suggestedCategoryId": "id_phù_hợp_nhất_hoặc_null",
  "suggestedShortDescription": "Mô tả ngắn 1-2 câu tiếng Việt (20-35 từ)...",
  "keywords": ["kw1", "kw2"]
}`;

      try {
        const textRes = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: textModel,
            prompt: qwenPrompt,
            format: 'json',
            stream: false,
            options: { temperature: 0.3 },
          }),
          signal: controller.signal,
        });

        if (textRes.ok) {
          const textData = (await textRes.json()) as { response?: string };
          if (textData.response) {
            const parsed = JSON.parse(textData.response) as {
              suggestedNames?: string[];
              suggestedCategoryId?: string | null;
              suggestedShortDescription?: string | null;
              keywords?: string[];
            };

            const validNames = Array.isArray(parsed.suggestedNames)
              ? parsed.suggestedNames
                  .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
                  .map((n) => n.trim())
                  .slice(0, 3)
              : [];

            if (validNames.length > 0) {
              // Deduplicate names
              const uniqueNames = Array.from(new Set(validNames));
              const smartSubject = extractSubjectFromDescription(visualDescription, hint);
              const smartFallbacks = generateSmartNames(smartSubject);
              for (const fb of smartFallbacks) {
                if (uniqueNames.length >= 3) break;
                if (!uniqueNames.includes(fb)) uniqueNames.push(fb);
              }

              let finalCategoryId: string | null = null;
              let finalCategoryName: string | null = null;
              if (parsed.suggestedCategoryId) {
                const found = categories.find((c) => c.id === parsed.suggestedCategoryId);
                if (found) {
                  finalCategoryId = found.id;
                  finalCategoryName = found.name;
                }
              }

              clearTimeout(timeout);
              return {
                suggestedNames: uniqueNames,
                suggestedCategoryId: finalCategoryId,
                suggestedCategoryName: finalCategoryName,
                suggestedShortDescription:
                  parsed.suggestedShortDescription?.trim() || DEFAULT_FALLBACK_DESCRIPTION,
                keywords: Array.isArray(parsed.keywords)
                  ? parsed.keywords.filter((k): k is string => typeof k === 'string').slice(0, 5)
                  : [],
                source: 'local_ollama',
              };
            }
          }
        }
      } catch {
        // Fall through to domain keyword mapping
      }
    }

    clearTimeout(timeout);

    // Stage 3: Direct smart mapping if text model was not used or failed
    const subject = extractSubjectFromDescription(visualDescription, hint);
    const names = generateSmartNames(subject);

    let matchedCategoryId: string | null = null;
    let matchedCategoryName: string | null = null;
    if (subject && categories.length > 0) {
      const lower = subject.toLowerCase();
      const matched = categories.find(
        (c) => lower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(lower)
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
      suggestedShortDescription: subject
        ? `Mẫu ${subject} in 3D sắc nét, bề mặt hoàn thiện tinh xảo, thích hợp để bàn làm việc hoặc làm quà tặng độc đáo.`
        : DEFAULT_FALLBACK_DESCRIPTION,
      keywords: subject ? [subject, '3d print'] : ['3d print'],
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
                  .map((n) => n.trim())
                  .slice(0, 3)
              : [];

            if (validNames.length > 0) {
              const uniqueNames = Array.from(new Set(validNames));
              const smartSubject = cleanBase64 ? extractSubjectFromDescription(rawText, hint) : hint;
              const smartFallbacks = generateSmartNames(smartSubject || null);
              for (const fb of smartFallbacks) {
                if (uniqueNames.length >= 3) break;
                if (!uniqueNames.includes(fb)) uniqueNames.push(fb);
              }

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
                suggestedNames: uniqueNames,
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
