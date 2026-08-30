import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { orderStatusUpdateSchema, uuidSchema } from '../../../../domain/schemas';
import { updateOrderStatus } from '../../../../services/order.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { actorId } = await requireAdmin(); const id = uuidSchema.parse((await params).id); const { status } = orderStatusUpdateSchema.parse(await request.json()); return NextResponse.json(await updateOrderStatus(id, status, actorId)); } catch (error) { return apiError(error); } }
