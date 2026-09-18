import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowRight, Calendar, Clock, User } from 'lucide-react';
import { formatDateDMY } from '@/lib/utils';
import { normalizeBlogMediaUrl } from '@/lib/blog/normalizeBlogMedia';
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import {
  isLegacyBlogAuthorSlug,
  isPublicBlogAuthorSlug,
  PUBLIC_BLOG_AUTHOR,
  PUBLIC_BLOG_AUTHOR_HREF,
} from '@/lib/blog/publicAuthor';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (isLegacyBlogAuthorSlug(slug)) {
    return { alternates: { canonical: `https://myfng.in${PUBLIC_BLOG_AUTHOR_HREF}` } };
  }
  if (!isPublicBlogAuthorSlug(slug)) return { title: 'Author' };
  return {
    title: `${PUBLIC_BLOG_AUTHOR} | MyFNG Blogs`,
    description: `All car service articles by ${PUBLIC_BLOG_AUTHOR}.`,
    alternates: { canonical: `https://myfng.in${PUBLIC_BLOG_AUTHOR_HREF}` },
  };
}

export default async function BlogAuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isLegacyBlogAuthorSlug(slug)) permanentRedirect(PUBLIC_BLOG_AUTHOR_HREF);
  if (!isPublicBlogAuthorSlug(slug)) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) notFound();

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: blogs } = await supabase
    .from('blogs')
    .select('id, slug, title, excerpt, featured_image, published_at, created_at, content, category:blog_categories(name)')
    .ilike('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(80);

  const posts = (blogs || []).map((blog: any) => ({
    ...blog,
    read_time: computeReadTimeFromHtml(String(blog.content || '')).minutes,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <section className="pt-28 pb-10" style={{ background: 'linear-gradient(135deg,#023D95 0%,#0a4ea3 100%)' }}>
        <div className="container mx-auto px-4 max-w-6xl">
          <p className="text-sm mb-3" style={{ color: '#dbeafe' }}>
            <Link href="/blogs" className="hover:underline" style={{ color: '#dbeafe' }}>
              Blogs
            </Link>
            <span className="mx-2">/</span>
            Author
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <User className="h-8 w-8 text-[#023D95]" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold" style={{ color: '#ffffff' }}>
                {PUBLIC_BLOG_AUTHOR}
              </h1>
              <p className="mt-1 text-sm sm:text-base" style={{ color: '#e2e8f0' }}>
                Automotive guides from MyFNG — pickup & drop workshop service across Mumbai, Thane and Pune.
              </p>
              <p className="mt-2 text-sm" style={{ color: '#bfdbfe' }}>
                {posts.length} published articles
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {posts.length === 0 ? (
            <p className="text-center text-gray-500">No blogs yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {posts.map((blog: any) => (
                <article key={blog.id} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all group">
                  <Link href={`/blogs/${blog.slug}`} className="block">
                    <div className="aspect-video relative overflow-hidden bg-gray-200">
                      {blog.featured_image ? (
                        <Image
                          src={normalizeBlogMediaUrl(blog.featured_image) || blog.featured_image}
                          alt={blog.title}
                          fill
                          className="object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#023D95] to-blue-600">
                          <span className="text-white text-4xl font-bold">{String(blog.title || 'M').charAt(0)}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                      {blog.published_at || blog.created_at ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDateDMY(blog.published_at || blog.created_at)}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {blog.read_time} min read
                      </span>
                    </div>
                    <Link href={`/blogs/${blog.slug}`}>
                      <h2 className="text-lg font-bold text-slate-900 group-hover:text-[#0a4ea3] line-clamp-2">
                        {blog.title}
                      </h2>
                    </Link>
                    {blog.excerpt ? (
                      <p className="mt-2 text-sm text-gray-600 line-clamp-3">{blog.excerpt}</p>
                    ) : null}
                    <Link
                      href={`/blogs/${blog.slug}`}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0a4ea3]"
                    >
                      Read More <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}
