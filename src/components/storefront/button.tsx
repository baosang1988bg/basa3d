import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StorefrontButtonVariant = 'primary' | 'accent' | 'secondary';

const VARIANT_CLASSES: Record<StorefrontButtonVariant, string> = {
  accent: 'bg-[#D97706] text-white hover:bg-[#B45309] shadow-tactile-accent dark:bg-[#F59E0B] dark:text-[#0F172A] dark:hover:bg-[#D97706]',
  primary: 'bg-[#0F766E] text-white hover:bg-[#115E59] shadow-tactile dark:bg-[#2DD4BF] dark:text-[#042F2E] dark:hover:bg-[#14B8A6]',
  secondary: 'border border-border bg-card text-foreground hover:bg-secondary',
};

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-all duration-150 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0';

// Shared so a navigational CTA can render as a plain <Link> with identical styling instead of
// nesting a real <button> inside an <a> (invalid HTML, and ambiguous for assistive tech).
export function storefrontButtonClasses(variant: StorefrontButtonVariant = 'primary', className?: string): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], className);
}

export function StorefrontButton({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: StorefrontButtonVariant }) {
  return <button type="button" className={storefrontButtonClasses(variant, className)} {...props} />;
}
