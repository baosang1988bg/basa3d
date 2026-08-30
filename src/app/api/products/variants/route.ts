import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { paginationQuerySchema, productVariantInputSchema } from '../../../../domain/schemas';
import { createVariant, listVariants } from '../../../../services/product.service';

export async function GET(request: Request) { try { return NextResponse.json(await listVariants(paginationQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await createVariant(productVariantInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
