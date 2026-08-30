import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from './domain-error';

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', issues: error.issues }, { status: 400 });
  if (error instanceof DomainError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
  if (error instanceof Error && error.message === 'Admin auth not implemented — see Phase 3') {
    return NextResponse.json({ code: 'ADMIN_AUTH_UNAVAILABLE', message: error.message }, { status: 503 });
  }
  console.error(error);
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }, { status: 500 });
}
