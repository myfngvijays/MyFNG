import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Roadside Assistance Landing', '/rsa_landing');
}

export default function RsaLandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
