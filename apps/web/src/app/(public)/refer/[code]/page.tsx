import type { Metadata } from 'next';
import ReferInviteClient from './ReferInviteClient';

type PageProps = {
  params: Promise<{ code: string }> | { code: string };
};

function normalizeCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await Promise.resolve(params);
  const code = normalizeCode(resolved.code);
  return {
    title: code ? `Join MyFNG with ${code}` : 'Join MyFNG — Refer & Rise',
    description:
      'Your friend invited you to MyFNG. Open the app or download it and enter their referral code for wallet rewards.',
    robots: { index: false, follow: false },
  };
}

export default async function ReferInvitePage({ params }: PageProps) {
  const resolved = await Promise.resolve(params);
  const code = normalizeCode(resolved.code);

  return <ReferInviteClient code={code} />;
}
