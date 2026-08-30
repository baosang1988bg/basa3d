import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { customRequestInputSchema, paginationQuerySchema } from '../../../domain/schemas';
import { createCustomRequest, listCustomRequests } from '../../../services/custom-request.service';

export async function GET(request: Request) { try { await requireAdmin(); const params = Object.fromEntries(new URL(request.url).searchParams); return NextResponse.json(await listCustomRequests(paginationQuerySchema.parse(params))); } catch (error) { return apiError(error); } }
export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await createCustomRequest(customRequestInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
