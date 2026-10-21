'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { trackContactClick } from '@/lib/analytics';
import { formatPhoneNumber } from './format';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  channel: 'zalo' | 'hotline' | 'messenger' | 'email';
  placement: string;
  children: ReactNode;
};

export function ContactLink({ channel, placement, onClick, children, ...props }: Props) {
  const content = typeof children === 'string' ? formatPhoneNumber(children) : children;
  return <a {...props} onClick={(event) => { trackContactClick(channel, placement); onClick?.(event); }}>{content}</a>;
}
