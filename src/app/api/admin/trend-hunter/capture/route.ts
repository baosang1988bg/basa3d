import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { apiError } from '@/lib/api';
import { captureModelFromUrl } from '@/services/trend-hunter.service';

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;

    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json(
        { code: 'URL_REQUIRED', message: 'Vui lòng cung cấp liên kết mẫu 3D.' },
        { status: 400 }
      );
    }

    const draft = await captureModelFromUrl(body.url);
    return NextResponse.json({ data: draft });
  } catch (error) {
    return apiError(error);
  }
}
