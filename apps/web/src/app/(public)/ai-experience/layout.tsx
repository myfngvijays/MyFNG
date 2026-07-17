import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('AI Experience', '/ai-experience');
}

export default function AiExperienceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
