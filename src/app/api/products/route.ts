import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { paginationQuerySchema, productInputSchema } from '../../../domain/schemas';
import { createProduct, listProducts } from '../../../services/product.service';

// Public catalog listing (no auth) — always forces status=ACTIVE, ignoring any client-supplied
// status, so DRAFT/ARCHIVED products are never reachable through this unauthenticated route.
// The admin UI reads product.service.listProducts() directly (server-side), not through this route.
export async function GET(request: Request) { try { const params = Object.fromEntries(new URL(request.url).searchParams); return NextResponse.json(await listProducts({ ...paginationQuerySchema.parse(params), status: 'ACTIVE' })); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await createProduct(productInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
