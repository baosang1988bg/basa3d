import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { DEV_ACTOR_ID } from '../../../../lib/auth/dev-actor';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { materialMovementInputSchema } from '../../../../domain/schemas';
import { recordMaterialMovement } from '../../../../services/inventory.service';

export async function POST(request: Request) { try { requireAdmin(); return NextResponse.json(await recordMaterialMovement(materialMovementInputSchema.parse(await request.json()), DEV_ACTOR_ID), { status: 201 }); } catch (error) { return apiError(error); } }
