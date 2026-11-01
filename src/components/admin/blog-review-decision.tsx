'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReviewDecisionResult } from '@/app/admin/(protected)/blog/review/actions';

export function BlogReviewDecision({ title, approve, reject }: {
  title: string;
  approve: () => Promise<ReviewDecisionResult>;
  reject: () => Promise<ReviewDecisionResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<'approve' | 'reject' | null>(null);
  const [result, setResult] = useState<ReviewDecisionResult | null>(null);

  const run = (kind: 'approve' | 'reject') => {
    const question = kind === 'approve'
      ? `Đăng bài "${title}" lên trang Blog công khai?`
      : `Từ chối và XOÁ bản nháp "${title}"? Thao tác này không hoàn tác được.`;
    if (!window.confirm(question)) return;
    setResult(null);
    setRunning(kind);
    startTransition(async () => {
      const outcome = await (kind === 'approve' ? approve() : reject());
      setResult(outcome);
      setRunning(null);
      if (outcome.ok) router.replace('/admin/blog/review');
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run('reject')} className="cursor-pointer gap-1.5 text-destructive hover:bg-destructive/10">
          {running === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          Từ chối &amp; xoá
        </Button>
        <Button type="button" size="sm" disabled={pending} onClick={() => run('approve')} className="cursor-pointer gap-1.5">
          {running === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Duyệt &amp; đăng
        </Button>
      </div>
      {result && (
        <p role="status" className={`text-sm ${result.ok ? 'text-emerald-600' : 'text-destructive'}`}>
          {result.ok ? result.message : result.error}
          {result.ok && result.slug ? (
            <> · <Link href={`/blog/${result.slug}`} target="_blank" className="underline">Xem bài đã đăng ↗</Link></>
          ) : null}
        </p>
      )}
    </div>
  );
}
