import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiError } from '@/lib/api';
import { query } from '@/lib/db';
import { UNCATEGORIZED_SLUG } from '@/services/product-onboarding.service';
import {
  productAiSuggestInputSchema,
  suggestProductMetadataFromImage,
} from '@/services/catalog-ai.service';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as unknown;
    const parsed = productAiSuggestInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'INVALID_INPUT',
          message: 'Dữ liệu phân tích ảnh không hợp lệ.',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    let categories = parsed.data.categories;
    if (!categories || categories.length === 0) {
      try {
        const catRows = await query<{ id: string; name: string }>(
          'select id, name from categories where is_active = true and slug <> $1 order by sort_order, name',
          [UNCATEGORIZED_SLUG]
        );
        categories = catRows.rows;
      } catch {
        categories = [];
      }
    }

    const suggestion = await suggestProductMetadataFromImage({
      ...parsed.data,
      categories,
    });

    return NextResponse.json({ ok: true, data: suggestion });
  } catch (error) {
    return apiError(error);
  }
}
