import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/api';
import { buildGoogle3dSearchUrl } from '@/lib/search/meta-engines';

const inputSchema = z.object({
  imageBase64: z.string().min(10).max(10 * 1024 * 1024).optional(),
  mimeType: z.string().default('image/jpeg'),
  queryHint: z.string().max(200).optional(),
});

interface VisualAnalysisResult {
  objectName: string;
  keywordsEn: string[];
  keywordsZh: string[];
  googleLensUrl: string;
  category: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = inputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'INVALID_INPUT', message: 'Dữ liệu ảnh không hợp lệ.' },
        { status: 400 }
      );
    }

    const { imageBase64, mimeType, queryHint } = parsed.data;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    let result: VisualAnalysisResult = {
      objectName: queryHint || '3D Printed Model',
      keywordsEn: [queryHint || '3d print articulated model', 'print in place toy', 'desk organizer stl'],
      keywordsZh: ['3D打印', '桌面好物'],
      googleLensUrl: buildGoogle3dSearchUrl(queryHint || '3d printed item'),
      category: 'Tổng hợp',
    };

    if (apiKey && imageBase64) {
      try {
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);

        const prompt = `Analyze this 3D-printed item or object. Extract concise search terms suitable for finding its 3D model (STL/3MF) on repositories like MakerWorld, Thingiverse, and Printables.
Return strictly valid JSON only:
{
  "objectName": "Short descriptive name (1-3 words in English)",
  "keywordsEn": ["specific keyword 1", "specific keyword 2", "specific keyword 3"],
  "keywordsZh": ["Chinese search keyword 1", "Chinese search keyword 2"],
  "category": "One of: Desk Organizer, Fidget Toy, Tool, Mechanical, Decor, Gadget"
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
            const aiParsed = JSON.parse(rawText) as {
              objectName?: string;
              keywordsEn?: string[];
              keywordsZh?: string[];
              category?: string;
            };

            if (aiParsed.keywordsEn && aiParsed.keywordsEn.length > 0) {
              result = {
                objectName: aiParsed.objectName || result.objectName,
                keywordsEn: aiParsed.keywordsEn.slice(0, 4),
                keywordsZh: aiParsed.keywordsZh ? aiParsed.keywordsZh.slice(0, 3) : result.keywordsZh,
                googleLensUrl: buildGoogle3dSearchUrl(aiParsed.objectName || aiParsed.keywordsEn[0]),
                category: aiParsed.category || result.category,
              };
            }
          }
        }
      } catch (aiErr) {
        console.warn('[VISUAL_SEARCH_AI_FAILED]', aiErr);
      }
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return apiError(error);
  }
}
