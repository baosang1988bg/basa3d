'use client';

import { useState, useTransition } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createQuickTestCustomRequestAction } from '@/app/admin/(protected)/custom-requests/actions';

export function CustomRequestHeaderActions({ isOwner }: { isOwner: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOwner) return null;

  function handleCreateQuickTest() {
    setError(null);
    startTransition(async () => {
      const res = await createQuickTestCustomRequestAction();
      if (res.error) {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCreateQuickTest}
        disabled={isPending}
        className="border-dashed hover:border-primary hover:text-primary"
        title="Tạo nhanh 1 yêu cầu mẫu [TEST] để thử nghiệm tính năng hoặc kiểm thử hệ thống"
      >
        {isPending ? (
          <Loader2 className="size-3.5 mr-1.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5 mr-1.5 text-accent" />
        )}
        + Tạo mẫu test
      </Button>
    </div>
  );
}
