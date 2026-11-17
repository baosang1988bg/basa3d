'use client';

import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';

// Phase 55 follow-up: a submit button that asks first. For irreversible server actions (hard delete)
// that are plain <form action> / formAction submits — cancelling the dialog cancels the submit.
export function ConfirmSubmitButton({ confirmation, onClick, ...props }: ComponentProps<typeof Button> & { confirmation: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmation)) { event.preventDefault(); return; }
        onClick?.(event);
      }}
    />
  );
}
