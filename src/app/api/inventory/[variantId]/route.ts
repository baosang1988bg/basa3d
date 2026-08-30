import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { uuidSchema } from '../../../../domain/schemas';
import { getStockLevel } from '../../../../services/inventory.service';

// Exact on-hand/reserved counts are internal business data (not just an "in stock?" flag) —
// admin-only. A future public storefront should get a coarser availability signal, not this.
export async function GET(_request: Request, { params }: { params: Promise<{ variantId: string }> }) { try { await requireAdmin(); const variantId = uuidSchema.parse((await params).variantId); return NextResponse.json(await getStockLevel(variantId)); } catch (error) { return apiError(error); } }
