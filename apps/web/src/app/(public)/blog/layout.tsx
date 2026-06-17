import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Car Service Blogs - Tips, Guides & Maintenance | MyFNG',
  description:
    'Read expert car service blogs, maintenance tips, repair guides and local SEO articles from MYFNG workshops across Mumbai, Pune & Thane.',
  keywords: [
    'car service blog',
    'car maintenance tips',
    'car repair guide',
    'MYFNG blog',
  ],
  keyphrase: 'car service blog',
  canonicalPath: '/blogs',
  city: 'Mumbai',
});

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
