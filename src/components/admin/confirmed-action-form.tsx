'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ConfirmedActionForm({ action, label, confirmation }: {
  action: () => Promise<{ error?: string }>;
  label: string;
  confirmation: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  return (
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (pending || !window.confirm(confirmation)) return;
      setPending(true);
      setError('');
      try { const result = await action(); setError(result.error ?? ''); }
      catch { setError('Không thể lưu thay đổi. Vui lòng thử lại.'); }
      finally { setPending(false); }
    }}>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>{pending ? 'Đang lưu…' : label}</Button>
      {error ? <p role="alert" className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
