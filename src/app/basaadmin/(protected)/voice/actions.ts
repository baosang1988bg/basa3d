'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { query } from '@/lib/db';
import { createTtsJobSchema } from '@/domain/tts';
import { createTtsJob, deleteTtsJob } from '@/services/tts.service';

export async function createTtsJobAction(formData: FormData) {
  const { actorId } = await requireAdmin();

  // Get staff name for display in jobs
  const staffRes = await query<{ full_name: string }>(
    `select coalesce(full_name, 'Staff') as full_name from public.staff_profiles where id = $1`,
    [actorId],
  );
  const staffName = staffRes.rows[0]?.full_name || 'Staff';

  const textPrompt = formData.get('textPrompt');
  const voiceProfile = formData.get('voiceProfile') || 'default';
  const speed = formData.get('speed') ? Number(formData.get('speed')) : 1.0;

  const parsed = createTtsJobSchema.parse({
    textPrompt: typeof textPrompt === 'string' ? textPrompt : '',
    voiceProfile: typeof voiceProfile === 'string' ? voiceProfile : 'default',
    speed,
  });

  await createTtsJob({
    staffId: actorId,
    staffName,
    input: parsed,
  });

  revalidatePath('/basaadmin/voice');
}

export async function deleteTtsJobAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get('id');
  if (typeof id === 'string' && id) {
    await deleteTtsJob(id);
    revalidatePath('/basaadmin/voice');
  }
}
