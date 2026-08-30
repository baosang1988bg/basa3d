import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { requireAdmin, requireOwner } from '../../../../../lib/auth/require-admin';
import { uuidSchema, variantUpdateInputSchema } from '../../../../../domain/schemas';
import { deleteVariant, updateVariant } from '../../../../../services/product.service';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { actorId } = await requireAdmin(); const id = uuidSchema.parse((await params).id); const patch = variantUpdateInputSchema.parse(await request.json()); return NextResponse.json(await updateVariant(id, patch, actorId)); } catch (error) { return apiError(error); } }
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { actorId } = await requireOwner(); const id = uuidSchema.parse((await params).id); return NextResponse.json(await deleteVariant(id, actorId)); } catch (error) { return apiError(error); } }
