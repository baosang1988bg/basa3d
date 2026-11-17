import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { updateSession } from './lib/supabase/middleware';
import { isEnglishEnabled, routing } from './i18n/routing';

// Next.js only runs a single middleware file per project, so the pre-existing admin-auth
// middleware (Supabase session refresh + login redirect) and next-intl's locale routing have to
// live in the same function. `/basaadmin/*` keeps its original Supabase behavior; `/admin/*`
// is blocked with 404; storefront pages use next-intl.
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return new NextResponse(null, { status: 404 });
  }
  if (pathname === '/basaadmin' || pathname.startsWith('/basaadmin/')) {
    return updateSession(request);
  }

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }

  if (pathname === '/en' || pathname.startsWith('/en/')) {
    const url = request.nextUrl.clone();
    if (!isEnglishEnabled) {
      // EN is switched off: send old/bookmarked/indexed `/en/*` links to the VI page (permanent,
      // so search engines drop the EN URL) instead of letting next-intl 404 them.
      url.pathname = pathname === '/en' ? '/home' : pathname.slice('/en'.length);
      return NextResponse.redirect(url, 308);
    }
    if (pathname === '/en') {
      url.pathname = '/en/home';
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // `/api`, Next internals, and requests for files with extensions bypass locale routing.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
