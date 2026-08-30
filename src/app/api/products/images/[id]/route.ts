import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { requireAdmin } from '../../../../../lib/auth/require-admin';
import { uuidSchema } from '../../../../../domain/schemas';
import { deleteProductImage } from '../../../../../services/product.service';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const { actorId } = await requireAdmin(); const id = uuidSchema.parse((await params).id); return NextResponse.json(await deleteProductImage(id, actorId)); } catch (error) { return apiError(error); } }
