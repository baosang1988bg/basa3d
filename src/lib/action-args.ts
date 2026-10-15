import { z } from 'zod';
import { uuidSchema } from '../domain/schemas';
import { DomainError } from './domain-error';

// Phase 36 S5 (closes Phase 35 deferred item "Zod validation of server-action scalar args").
// A server action is a public POST endpoint: anyone holding a session can invoke it by its action ID
// with ANY serialized arguments, not just what the bound <form> would send. TypeScript parameter
// types are erased at runtime — `setStaffActiveAction(id, "false")` used to skip the last-OWNER guard
// (`!"false"` is false) while Postgres still read 'false' as boolean false. Every positional scalar
// argument is therefore parsed here, AFTER requireAdmin()/requireOwner() (auth first, so an
// unauthenticated caller learns nothing from validation errors).

function invalid(label: string): never {
  throw new DomainError('INVALID_ACTION_ARGUMENT', `Tham số "${label}" không hợp lệ.`, 400);
}

export function parseActionId(value: unknown, label = 'id'): string {
  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : invalid(label);
}

export function parseActionBoolean(value: unknown, label: string): boolean {
  return typeof value === 'boolean' ? value : invalid(label);
}

export function parseActionEnum<const T extends readonly [string, ...string[]]>(value: unknown, options: T, label: string): T[number] {
  const parsed = z.enum(options).safeParse(value);
  return parsed.success ? parsed.data : invalid(label);
}
