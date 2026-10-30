'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { triggerDailyNewsSyncAction } from '@/app/admin/(protected)/blog/actions';

export function BlogSyncNewsButton() {
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const handleSync = () => {
    setStatusMessage(null);
    startTransition(async () => {
      const res = await triggerDailyNewsSyncAction();
      if (res.success) {
        setStatusMessage({ text: res.message });
      } else {
        setStatusMessage({ text: `Lỗi: ${res.message}`, isError: true });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={handleSync}
        className="cursor-pointer gap-2 border-primary/30 text-primary hover:bg-primary/10"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>Đang cào & tổng hợp AI...</span>
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            <span>Quét tin tức hôm nay</span>
          </>
        )}
      </Button>
      {statusMessage && (
        <span className={`text-xs ${statusMessage.isError ? 'text-destructive font-medium' : 'text-emerald-600'}`}>
          {statusMessage.text}
        </span>
      )}
    </div>
  );
}
