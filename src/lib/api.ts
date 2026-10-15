import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { DomainError } from './domain-error';

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) return NextResponse.json({ code: 'VALIDATION_ERROR', issues: error.issues }, { status: 400 });
  if (error instanceof DomainError) return NextResponse.json({ code: error.code, message: error.message }, { status: error.status });
  // Phase 36: log the shape, not the whole object — pg errors carry `detail` (e.g.
  // `Key (customer_phone)=(…)`) and `parameters`, which would put customer PII into server logs.
  console.error(describeError(error));
  return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }, { status: 500 });
}

function describeError(error: unknown) {
  if (!(error instanceof Error)) return { name: 'NonError', type: typeof error };
  const { code, constraint, table, routine } = error as Error & { code?: string; constraint?: string; table?: string; routine?: string };
  return { name: error.name, message: error.message, code, constraint, table, routine, stack: error.stack };
}
