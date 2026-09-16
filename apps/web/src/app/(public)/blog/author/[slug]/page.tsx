import { permanentRedirect } from 'next/navigation';
import { PUBLIC_BLOG_AUTHOR_HREF } from '@/lib/blog/publicAuthor';

export default async function LegacyAuthorRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(slug ? `/blogs/author/${encodeURIComponent(slug)}` : PUBLIC_BLOG_AUTHOR_HREF);
}
