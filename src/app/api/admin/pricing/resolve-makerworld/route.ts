import { NextResponse } from 'next/server';
import { apiError } from '../../../../../lib/api';
import { requireAdmin } from '../../../../../lib/auth/require-admin';
import {
  MakerWorldBlockedOrTimeoutError,
  MakerWorldNotFoundError,
  MakerWorldProfileNotFoundError,
  MakerWorldResolverError,
  resolveMakerWorldUrl,
} from '../../../../../lib/parsers/makerworld-resolver';

// STAFF/OWNER only — never public (same convention as parse-3mf). Wraps the SSRF-safe resolver and
// maps its 3 documented error classes (phase-13.md decision #1) to distinct HTTP statuses/messages
// so the UI can show the right guidance instead of one generic "gõ tay đi" fallback.
export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    if (!body || typeof body.url !== 'string' || !body.url.trim()) {
      return NextResponse.json({ code: 'URL_REQUIRED', message: 'Vui lòng dán link MakerWorld.' }, { status: 400 });
    }
    const resolution = await resolveMakerWorldUrl(body.url);
    // Measure how often the server-side resolver actually works from our datacenter IP before
    // investing in a public (Phase B) flow — see makerworld-profile-verification plan.
    console.info('[MAKERWORLD_RESOLVER]', { outcome: 'OK', profiles: resolution.profiles.length });
    return NextResponse.json({ data: resolution });
  } catch (error) {
    if (error instanceof MakerWorldResolverError) console.info('[MAKERWORLD_RESOLVER]', { outcome: error.kind });
    if (error instanceof MakerWorldBlockedOrTimeoutError) {
      return NextResponse.json({ code: 'MAKERWORLD_BLOCKED_OR_TIMEOUT', message: error.message }, { status: 504 });
    }
    if (error instanceof MakerWorldNotFoundError) {
      return NextResponse.json({ code: 'MAKERWORLD_NOT_FOUND', message: error.message }, { status: 404 });
    }
    if (error instanceof MakerWorldProfileNotFoundError) {
      return NextResponse.json({ code: 'MAKERWORLD_PROFILE_NOT_FOUND', message: error.message }, { status: 422 });
    }
    return apiError(error);
  }
}
