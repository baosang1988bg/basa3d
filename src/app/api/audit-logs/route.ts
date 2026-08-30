import { NextResponse } from 'next/server';
import { apiError } from '../../../lib/api';
import { requireOwner } from '../../../lib/auth/require-admin';
import { paginationQuerySchema } from '../../../domain/schemas';
import { listAuditLogs } from '../../../services/audit.service';

export async function GET(request: Request) { try { await requireOwner(); const params = Object.fromEntries(new URL(request.url).searchParams); return NextResponse.json(await listAuditLogs(paginationQuerySchema.parse(params))); } catch (error) { return apiError(error); } }
