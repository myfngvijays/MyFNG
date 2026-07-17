import { listBlogSeoSummaries } from '@/lib/blog/seo';
import { SITE_URL } from '@/lib/seo/metadata';

export const revalidate = 3600;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const blogs = (await listBlogSeoSummaries()).filter((blog) => blog.indexable).slice(0, 50);
  const items = blogs
    .map((blog) => {
      const link = `${SITE_URL}/blogs/${blog.slug}`;
      const pubDate = blog.published_at || blog.updated_at || new Date().toISOString();
      return `    <item>
      <title>${escapeXml(blog.title || blog.page_label)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${escapeXml(blog.description || '')}</description>
      <pubDate>${new Date(pubDate).toUTCString()}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>MYFNG Car Care Blog</title>
    <link>${SITE_URL}/blogs</link>
    <description>Car service tips, maintenance guides and MYFNG updates.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
