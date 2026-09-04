import { redirect } from '@/i18n/navigation';

export default async function LegacyKeychainToolPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/tools/keychain-generator', locale });
}
