import { NextResponse } from 'next/server';
import { apiError } from '../../../../lib/api';
import { requireOwner } from '../../../../lib/auth/require-admin';
import { inventoryMovementInputSchema } from '../../../../domain/schemas';
import { recordInventoryMovement } from '../../../../services/inventory.service';

// Phase 52 P4: raw movements (any type, any sign) are OWNER-only; staff use the quick-restock actions.
export async function POST(request: Request) { try { const { actorId } = await requireOwner(); return NextResponse.json(await recordInventoryMovement(inventoryMovementInputSchema.parse(await request.json()), actorId), { status: 201 }); } catch (error) { return apiError(error); } }
