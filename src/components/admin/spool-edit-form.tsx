'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function SpoolEditForm({ spool, action }: {
  spool: { spoolCode: string; hasSpool: boolean; note: string | null };
  action: (previous: { error?: string; saved?: boolean }, form: FormData) => Promise<{ error?: string; saved?: boolean }>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="flex flex-col gap-4">
    <div className="flex flex-col gap-1.5"><Label htmlFor="editSpoolCode">Mã cuộn</Label><Input id="editSpoolCode" name="spoolCode" required maxLength={60} defaultValue={spool.spoolCode} /></div>
    <div className="flex items-center gap-2"><input id="editHasSpool" name="hasSpool" type="checkbox" defaultChecked={spool.hasSpool} /><Label htmlFor="editHasSpool">Có lõi</Label></div>
    <div className="flex flex-col gap-1.5"><Label htmlFor="editSpoolNote">Ghi chú</Label><Textarea id="editSpoolNote" name="note" maxLength={2000} defaultValue={spool.note ?? ''} /></div>
    <p className="text-sm text-muted-foreground">Nếu nhập sai khối lượng còn lại, dùng mục Điều chỉnh tồn kho bên dưới.</p>
    {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
    {state.saved ? <p role="status">Đã lưu thông tin cuộn nhựa.</p> : null}
    <div><Button type="submit" disabled={pending}>{pending ? 'Đang lưu…' : 'Lưu thay đổi'}</Button></div>
  </form>;
}
