import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { updateSession } from './lib/supabase/middleware';
import { routing } from './i18n/routing';

// Next.js only runs a single middleware file per project, so the pre-existing admin-auth
// middleware (Supabase session refresh + login redirect) and next-intl's locale routing have to
// live in the same function. `/admin/*` keeps its original Supabase behavior; storefront pages
// use next-intl. This file lives beside src/app so Next.js includes it in the middleware manifest.
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) return updateSession(request);
  return intlMiddleware(request);
}

export const config = {
  // `/api`, Next internals, and requests for files with extensions bypass locale routing.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
