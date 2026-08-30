import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { DEV_ACTOR_ID } from '../../../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../../../lib/auth/require-admin';
import { uuidSchema, variantPriceUpdateSchema } from '../../../../../domain/schemas';
import { updateVariantPrice } from '../../../../../services/product.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireAdmin(); const id = uuidSchema.parse((await params).id); const { price } = variantPriceUpdateSchema.parse(await request.json()); return NextResponse.json(await updateVariantPrice(id, price, DEV_ACTOR_ID)); } catch (error) { return apiError(error); } }
