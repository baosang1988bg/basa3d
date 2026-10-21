import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type StorefrontButtonVariant = 'primary' | 'accent' | 'secondary';

// Phase 43: the tactile variants behave like a keycap — hover lifts 1px while the hard shadow grows
// to 4px, pressing pushes the button 2px into its shadow. `[&:not(:disabled)]` (not `enabled:`) so
// the same classes also work on <Link>/<a>, which never match `:enabled`. motion-reduce keeps the
// shadow change but drops the movement.
const TACTILE_MOTION =
  '[&:not(:disabled):hover]:-translate-x-px [&:not(:disabled):hover]:-translate-y-px [&:not(:disabled):active]:translate-x-0.5 [&:not(:disabled):active]:translate-y-0.5 motion-reduce:!translate-x-0 motion-reduce:!translate-y-0';

const VARIANT_CLASSES: Record<StorefrontButtonVariant, string> = {
  accent: cn(
    'bg-[#D97706] text-white hover:bg-[#B45309] shadow-tactile-accent dark:bg-[#F59E0B] dark:text-[#0F172A] dark:hover:bg-[#D97706]',
    '[&:not(:disabled):hover]:shadow-tactile-accent-lift [&:not(:disabled):active]:shadow-tactile-accent-press',
    TACTILE_MOTION,
  ),
  primary: cn(
    'bg-[#0F766E] text-white hover:bg-[#115E59] shadow-tactile dark:bg-[#2DD4BF] dark:text-[#042F2E] dark:hover:bg-[#14B8A6]',
    '[&:not(:disabled):hover]:shadow-tactile-lift [&:not(:disabled):active]:shadow-tactile-press',
    TACTILE_MOTION,
  ),
  secondary: 'border border-border bg-card text-foreground hover:bg-secondary active:translate-y-px motion-reduce:active:translate-y-0',
};

const BASE_CLASSES =
  'inline-flex cursor-pointer items-center justify-center rounded-lg px-5 py-2.5 font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

// Shared so a navigational CTA can render as a plain <Link> with identical styling instead of
// nesting a real <button> inside an <a> (invalid HTML, and ambiguous for assistive tech).
export function storefrontButtonClasses(variant: StorefrontButtonVariant = 'primary', className?: string): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], className);
}

export function StorefrontButton({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: StorefrontButtonVariant }) {
  return <button type="button" className={storefrontButtonClasses(variant, className)} {...props} />;
}
