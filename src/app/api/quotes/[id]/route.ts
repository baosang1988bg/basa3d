import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { DEV_ACTOR_ID } from '../../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { quoteAcceptSchema, uuidSchema } from '../../../../domain/schemas';
import { acceptQuote } from '../../../../services/quote.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { requireAdmin(); const id = uuidSchema.parse((await params).id); quoteAcceptSchema.parse(await request.json()); return NextResponse.json(await acceptQuote(id, DEV_ACTOR_ID)); } catch (error) { return apiError(error); } }
