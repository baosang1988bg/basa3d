import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { quoteInputSchema } from '../../../domain/schemas';
import { createQuote } from '../../../services/quote.service';

export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await createQuote(quoteInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
