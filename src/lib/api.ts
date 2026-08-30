import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from './domain-error';

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', issues: error.issues }, { status: 400 });
  if (error instanceof DomainError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
  console.error(error);
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }, { status: 500 });
}
