import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { uuidSchema } from '../../../../domain/schemas';
import { getStockLevel } from '../../../../services/inventory.service';

export async function GET(_request: Request, { params }: { params: Promise<{ variantId: string }> }) { try { const variantId = uuidSchema.parse((await params).variantId); return NextResponse.json(await getStockLevel(variantId)); } catch (error) { return apiError(error); } }
