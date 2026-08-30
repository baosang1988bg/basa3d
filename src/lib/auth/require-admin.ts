export function requireAdmin(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Admin auth not implemented — see Phase 3');
  }
}
