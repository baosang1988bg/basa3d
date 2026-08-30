import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { checkoutOrderInputSchema } from '../../../domain/schemas';
import { createOrder } from '../../../services/order.service';

export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await createOrder(checkoutOrderInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
