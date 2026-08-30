import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireOwner } from '../../../../lib/auth/require-admin';
import { staffUpdateInputSchema, uuidSchema } from '../../../../domain/schemas';
import { setStaffActive } from '../../../../services/staff.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { actorId } = await requireOwner(); const id = uuidSchema.parse((await params).id); const { isActive } = staffUpdateInputSchema.parse(await request.json()); return NextResponse.json(await setStaffActive(id, isActive, actorId)); } catch (error) { return apiError(error); } }
