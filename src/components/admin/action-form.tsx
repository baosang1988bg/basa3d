'use client';

import { startTransition, useActionState, type ReactNode } from 'react';

export type AdminActionResult = { error?: string; saved?: boolean };

// Keep the existing domain-specific fields server-rendered. Dispatch explicitly so React
// does not reset uncontrolled inputs when a handled validation error resolves the action.
export function ActionForm({ action, children, className }: {
  action: (formData: FormData) => Promise<AdminActionResult>;
  children: ReactNode;
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(
    async (_previous: AdminActionResult, formData: FormData) => action(formData),
    {},
  );
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (pending) return;
      const data = new FormData(event.currentTarget);
      startTransition(() => dispatch(data));
    }} aria-busy={pending}>
      <fieldset disabled={pending} className={`m-0 min-w-0 border-0 p-0 ${className ?? ''}`}>
        {children}
      </fieldset>
      {pending ? <p role="status" className="mt-2 text-sm">Đang lưu…</p> : null}
      {state.error ? <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      {!pending && state.saved ? <p role="status" className="mt-2 text-sm">Đã lưu thay đổi.</p> : null}
    </form>
  );
}
