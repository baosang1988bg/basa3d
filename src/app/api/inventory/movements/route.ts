import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireAdmin } from '../../../../lib/auth/require-admin';
import { inventoryMovementInputSchema } from '../../../../domain/schemas';
import { recordInventoryMovement } from '../../../../services/inventory.service';

export async function POST(request: Request) { try { const { actorId } = await requireAdmin(); return NextResponse.json(await recordInventoryMovement(inventoryMovementInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
