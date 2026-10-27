'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/require-admin';
import { inventoryMovementInputSchema } from '@/domain/schemas';
import { recordInventoryMovement } from '@/services/inventory.service';

function readFormValue(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// Phase 52 P4: the raw movement form is OWNER-only ("Nâng cao"); staff use Nhập kho nhanh / Nhập theo mẻ.
export async function recordMovementAction(formData: FormData) {
  const { actorId } = await requireOwner();
  const input = inventoryMovementInputSchema.parse({
    warehouseId: formData.get('warehouseId'),
    productVariantId: formData.get('productVariantId'),
    movementType: formData.get('movementType'),
    quantity: Number(formData.get('quantity')),
    unitCost: readFormValue(formData, 'unitCost') ? Number(formData.get('unitCost')) : null,
    note: readFormValue(formData, 'note') ?? null,
  });
  await recordInventoryMovement(input, actorId);
  revalidatePath('/admin/inventory');
  revalidatePath('/admin/product-inventory');
}
