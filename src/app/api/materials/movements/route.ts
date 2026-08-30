import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { materialMovementInputSchema } from '../../../../domain/schemas';
import { recordMaterialMovement } from '../../../../services/inventory.service';

export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await recordMaterialMovement(materialMovementInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
