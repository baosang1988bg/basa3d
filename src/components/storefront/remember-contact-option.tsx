'use client';

import { useId } from 'react';

type Props = {
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  /** True when this device already holds saved details — shows the "forget" action. */
  hasSaved: boolean;
  onClear: () => void;
  className?: string;
};

/** "Remember my details on this device" toggle shared by the public order/quote forms. */
export function RememberContactOption({ remember, onRememberChange, hasSaved, onClear, className }: Props) {
  const id = useId();
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground ${className ?? ''}`}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={remember}
          onChange={(event) => onRememberChange(event.target.checked)}
          className="size-4 shrink-0 accent-primary"
        />
        <span>Ghi nhớ thông tin liên hệ trên thiết bị này cho lần sau</span>
      </label>
      {hasSaved ? (
        <button type="button" onClick={onClear} className="font-medium text-primary hover:underline">
          Xoá thông tin đã lưu
        </button>
      ) : null}
    </div>
  );
}
