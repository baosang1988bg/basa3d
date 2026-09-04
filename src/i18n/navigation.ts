import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware Link/usePathname/useRouter — used by LanguageSwitcher and any storefront
// component that needs to build a link to the *other* locale without hand-rolling the
// `as-needed` prefix logic (phase-18.md decision #6).
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
