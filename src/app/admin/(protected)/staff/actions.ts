'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/require-admin';
import { staffCreateInputSchema } from '@/domain/schemas';
import { createStaffAccount, setStaffActive } from '@/services/staff.service';

export async function createStaffAction(formData: FormData) {
  const { actorId } = await requireOwner();
  const input = staffCreateInputSchema.parse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
  });
  await createStaffAccount(input, actorId);
  revalidatePath('/admin/staff');
}

export async function setStaffActiveAction(staffId: string, isActive: boolean) {
  const { actorId } = await requireOwner();
  await setStaffActive(staffId, isActive, actorId);
  revalidatePath('/admin/staff');
}
