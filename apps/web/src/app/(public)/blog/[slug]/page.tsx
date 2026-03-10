import { permanentRedirect } from 'next/navigation';

export default async function LegacyBlogRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safeSlug = encodeURIComponent(String(slug || '').trim());
  permanentRedirect(`/blogs/${safeSlug}`);
}
