// Public URL of an object in the public `product-images` bucket. Pure string building (no service-role
// client), safe for server pages; returns null when the path or NEXT_PUBLIC_SUPABASE_URL is missing.
export function productImagePublicUrl(storagePath: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!storagePath || !base) return null;
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/product-images/${storagePath.split('/').map(encodeURIComponent).join('/')}`;
}
