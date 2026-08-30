import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { DEV_ACTOR_ID } from '../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../lib/auth/require-admin';
import { quoteInputSchema } from '../../../domain/schemas';
import { createQuote } from '../../../services/quote.service';

export async function POST(request: Request) { try { requireAdmin(); return NextResponse.json(await createQuote(quoteInputSchema.parse(await request.json()), DEV_ACTOR_ID), { status: 201 }); } catch (error) { return apiError(error); } }
