import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { DEV_ACTOR_ID } from '../../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { orderStatusUpdateSchema, uuidSchema } from '../../../../domain/schemas';
import { updateOrderStatus } from '../../../../services/order.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireAdmin(); const id = uuidSchema.parse((await params).id); const { status } = orderStatusUpdateSchema.parse(await request.json()); return NextResponse.json(await updateOrderStatus(id, status, DEV_ACTOR_ID)); } catch (error) { return apiError(error); } }
