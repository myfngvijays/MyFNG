import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowLeft, Calendar, Clock, Share2, Tag } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";

export const dynamic = 'force-dynamic';

type BlogTag = { name: string; slug: string } | null;

type Blog = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  read_time?: number | null;
  featured_image?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  author?: { id: string; full_name: string | null; email: string | null } | null;
  tags?: BlogTag[];
};

function formatDate(dateString?: string | null) {
  if (!dateString) return '';
  const d = new Date(dateString);
  return formatDateDMY(d);
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) notFound();

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: blog, error } = await supabase
    .from('blogs')
    .select(
      `
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error || !blog) notFound();

  const transformed: Blog = {
    ...blog,
    tags: (blog as any)?.tags?.map((t: any) => t?.tag).filter(Boolean) || [],
  };

  const dateText = formatDate(transformed.published_at || transformed.created_at);
  const readTimeText = transformed.read_time ? `${transformed.read_time} min read` : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/blogs"
              className="inline-flex items-center gap-1.5 sm:gap-2 text-gray-200 hover:text-white mb-4 sm:mb-5 md:mb-6 transition text-sm sm:text-base"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Back to Blogs
            </Link>

            {transformed.category?.name ? (
              <div className="mb-3 sm:mb-4">
                <span className="bg-brand-primary text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold">
                  {transformed.category.name}
                </span>
              </div>
            ) : null}

            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-5 md:mb-6 text-white">
              {transformed.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 md:gap-6 text-gray-200 text-xs sm:text-sm">
              {dateText ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {dateText}
                </div>
              ) : null}
              {readTimeText ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {readTimeText}
                </div>
              ) : null}
              {transformed.author?.full_name ? <div>By {transformed.author.full_name}</div> : null}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Image */}
      {transformed.featured_image ? (
        <section className="py-6 sm:py-7 md:py-8">
          <div className="container mx-auto px-3 sm:px-4">
            <div className="max-w-4xl mx-auto">
              <div className="relative h-48 sm:h-64 md:h-80 lg:h-96 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-gray-200">
                <Image src={transformed.featured_image} alt={transformed.title} fill className="object-cover" priority />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Content */}
      <section className="py-6 sm:py-7 md:py-8">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-4xl mx-auto">
            <article className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8 lg:p-12">
              {/* Tags */}
              {transformed.tags && transformed.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-6 sm:mb-7 md:mb-8">
                  {transformed.tags.map((tag) =>
                    tag ? (
                      <span
                        key={tag.slug || tag.name}
                        className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm"
                      >
                        <Tag className="w-3 h-3" />
                        {tag.name}
                      </span>
                    ) : null
                  )}
                </div>
              ) : null}

              {transformed.excerpt ? (
                <p className="text-gray-700 text-sm sm:text-base leading-relaxed mb-6 sm:mb-7 md:mb-8">
                  {transformed.excerpt}
                </p>
              ) : null}

              {/* Content (HTML supported as per dashboard editor helper text) */}
              <div
                className="prose prose-sm sm:prose-base md:prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: transformed.content }}
              />

              {/* Share Button (client-side uses navigator.clipboard; keep as normal link fallback) */}
              <div className="mt-8 sm:mt-10 md:mt-12 pt-6 sm:pt-7 md:pt-8 border-t border-gray-200">
                <a
                  href={`https://myfng.in/blogs/${encodeURIComponent(transformed.slug)}`}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-700 text-xs sm:text-sm md:text-base font-semibold"
                >
                  <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  Share this Article
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

