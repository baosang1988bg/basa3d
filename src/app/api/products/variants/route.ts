import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { paginationQuerySchema } from '../../../../domain/schemas';
import { listVariants } from '../../../../services/product.service';

export async function GET(request: Request) { try { return NextResponse.json(await listVariants(paginationQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams)))); } catch (error) { return apiError(error); } }
