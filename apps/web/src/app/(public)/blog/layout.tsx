import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { collectionPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { listBlogListingSchemaItems } from '@/lib/blog/seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/blogs');
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const items = await listBlogListingSchemaItems(8);

  return (
    <>
      {items.length ? (
        <JsonLd
          data={collectionPageSchema({
            name: 'MyFNG Car Service Blogs',
            description: 'Car maintenance tips, service guides and local automotive articles from MYFNG.',
            url: `${SITE_URL}/blogs`,
            items,
          })}
        />
      ) : null}
      {children}
    </>
  );
}
