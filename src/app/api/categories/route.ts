import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { DEV_ACTOR_ID } from '../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { categoryInputSchema, paginationQuerySchema } from '../../../domain/schemas';
import { createCategory, listCategories } from '../../../services/product.service';

export async function GET(request: Request) { try { return NextResponse.json(await listCategories(paginationQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { requireAdmin(); return NextResponse.json(await createCategory(categoryInputSchema.parse(await request.json()), DEV_ACTOR_ID), { status: 201 }); } catch (error) { return apiError(error); } }
