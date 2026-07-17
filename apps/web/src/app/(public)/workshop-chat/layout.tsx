import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Workshop Chat', '/workshop-chat');
}

export default function WorkshopChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
