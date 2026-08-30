import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { DomainError } from '../../../../../lib/domain-error';
import { requireAdmin } from '../../../../../lib/auth/require-admin';
import { uuidSchema } from '../../../../../domain/schemas';
import { listProductImages, uploadProductImage } from '../../../../../services/product.service';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const id = uuidSchema.parse((await params).id); return NextResponse.json(await listProductImages(id)); } catch (error) { return apiError(error); } }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actorId } = await requireAdmin();
    const productId = uuidSchema.parse((await params).id);
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob)) throw new DomainError('FILE_REQUIRED', 'A "file" field is required.', 400);
    const variantId = formData.get('variantId');
    const altText = formData.get('altText');
    const sortOrder = formData.get('sortOrder');
    return NextResponse.json(
      await uploadProductImage({
        productId,
        variantId: typeof variantId === 'string' && variantId ? uuidSchema.parse(variantId) : null,
        file,
        fileName: file instanceof File ? file.name : 'upload',
        altText: typeof altText === 'string' && altText ? altText : null,
        sortOrder: typeof sortOrder === 'string' && sortOrder ? Number(sortOrder) : 0,
      }, actorId),
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
