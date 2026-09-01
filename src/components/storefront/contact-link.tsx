'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { trackContactClick } from '@/lib/analytics';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  channel: 'zalo' | 'hotline' | 'messenger' | 'email';
  placement: string;
  children: ReactNode;
};

export function ContactLink({ channel, placement, onClick, ...props }: Props) {
  return <a {...props} onClick={(event) => { trackContactClick(channel, placement); onClick?.(event); }} />;
}
