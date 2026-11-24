import { NextResponse } from 'next/server';
import { requireAdmin, requireOwner } from '@/lib/auth/require-admin';
import { apiError } from '@/lib/api';
import {
  listTrendWatchItems,
  saveTrendWatchItem,
  updateTrendWatchItemStatus,
  deleteTrendWatchItem,
  trendWatchInputSchema,
  TREND_WATCH_STATUSES,
} from '@/services/trend-hunter.service';
import { z } from 'zod';

export async function GET() {
  try {
    await requireAdmin();
    const items = await listTrendWatchItems();
    return NextResponse.json({ data: items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = trendWatchInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_FAILED', message: 'Dữ liệu không hợp lệ.', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await saveTrendWatchItem(parsed.data, admin.actorId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(TREND_WATCH_STATUSES),
});

const idSchema = z.string().uuid();

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { code: 'VALIDATION_FAILED', message: 'Dữ liệu cập nhật không hợp lệ.' },
        { status: 400 }
      );
    }

    await updateTrendWatchItemStatus(parsed.data.id, parsed.data.status, admin.actorId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    // ADR-0011 boundary #3: hard delete is OWNER-only. Staff archive instead (PATCH → ARCHIVED).
    const owner = await requireOwner();
    const { searchParams } = new URL(request.url);
    const id = idSchema.safeParse(searchParams.get('id'));

    if (!id.success) {
      return NextResponse.json({ code: 'ID_REQUIRED', message: 'Thiếu hoặc sai ID mẫu.' }, { status: 400 });
    }

    await deleteTrendWatchItem(id.data, owner.actorId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
