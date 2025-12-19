'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  ArrowLeft,
  Edit,
  Eye,
  Calendar,
  Clock,
  Tag,
  BookOpen,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: string;
  views: number;
  likes: number;
  shares: number;
  read_time: number;
  is_featured: boolean;
  is_premium: boolean;
  created_at: string;
  published_at?: string;
  featured_image?: string;
  category?: { name: string; slug: string };
  author?: { id: string; full_name: string; email: string };
  tags?: Array<{ name: string; slug: string }>;
  images?: Array<{ id: string; image_url: string; caption?: string }>;
  seo_data?: {
    meta_title?: string;
    meta_description?: string;
    keywords?: string;
    canonical_url?: string;
    og_title?: string;
    og_description?: string;
    og_image?: string;
  };
}

export default function DigitalMarketingBlogDetailPage() {
  const router = useRouter();
  const params = useParams();
  const blogId = params.id as string;
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (blogId) fetchBlog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blogId]);

  async function fetchBlog() {
    setLoading(true);
    try {
      const response = await fetch(`/api/blogs/${blogId}`);
      if (response.ok) {
        const data = await response.json();
        setBlog(data.blog);
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.error || 'Failed to load blog');
        router.push('/dashboard/digital_marketing/blogs');
      }
    } catch (error) {
      console.error('Error fetching blog:', error);
      toast.error('Failed to load blog');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">Published</span>
        );
      case 'draft':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">Draft</span>
        );
      case 'archived':
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">Archived</span>
        );
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">{status}</span>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading blog...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!blog) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="card text-center py-12">
          <h2 className="text-xl font-semibold text-text-heading mb-2">Blog not found</h2>
          <Link href="/dashboard/digital_marketing/blogs">
            <button className="btn btn-primary mt-4">Back to Blogs</button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <Link href="/dashboard/digital_marketing/blogs" className="flex-shrink-0">
              <button className="btn btn-outline btn-sm">
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading break-words">{blog.title}</h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                {getStatusBadge(blog.status)}
                {blog.is_featured && (
                  <span className="px-2 py-1 bg-brand-primary text-white rounded text-xs font-semibold whitespace-nowrap">
                    Featured
                  </span>
                )}
                {blog.is_premium && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold whitespace-nowrap">
                    Premium
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Link href={`/blog/${blog.slug}`} target="_blank" className="w-full sm:w-auto">
              <button className="btn btn-outline w-full sm:w-auto flex items-center justify-center gap-2">
                <Eye className="w-4 h-4" />
                View Public
              </button>
            </Link>
            <Link href={`/dashboard/digital_marketing/blogs/${blogId}/edit`} className="w-full sm:w-auto">
              <button className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
                <Edit className="w-4 h-4" />
                <span className="text-sm sm:text-base">Edit</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Featured Image */}
        {blog.featured_image && (
          <div className="card p-0 overflow-hidden">
            <img src={blog.featured_image} alt={blog.title} className="w-full h-64 sm:h-96 object-cover" />
          </div>
        )}

        {/* Blog Info */}
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Category</p>
                <p className="font-semibold text-sm sm:text-base text-text-heading truncate">
                  {blog.category?.name || 'Uncategorized'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Read Time</p>
                <p className="font-semibold text-sm sm:text-base text-text-heading">{blog.read_time} min</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">Views</p>
                <p className="font-semibold text-sm sm:text-base text-text-heading">{blog.views || 0}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-gray-600">{blog.published_at ? 'Published' : 'Created'}</p>
                <p className="font-semibold text-sm sm:text-base text-text-heading">
                  {blog.published_at ? formatDateDMY(blog.published_at) : formatDateDMY(blog.created_at)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Blog Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Excerpt */}
            {blog.excerpt && (
              <div className="card bg-blue-50 border-blue-200">
                <p className="text-lg text-text-body italic">{blog.excerpt}</p>
              </div>
            )}

            {/* Content */}
            <div className="card overflow-hidden">
              <div
                className="prose prose-sm sm:prose-base lg:prose-lg max-w-none blog-content break-words"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            </div>

            {/* Additional Images */}
            {blog.images && blog.images.length > 0 && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  Additional Images
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {blog.images.map((img) => (
                    <div key={img.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <img src={img.image_url} alt={img.caption || 'Blog image'} className="w-full h-40 sm:h-48 object-cover" />
                      {img.caption && <p className="p-2 sm:p-3 text-xs sm:text-sm text-gray-600 break-words">{img.caption}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {blog.tags && blog.tags.length > 0 && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4 flex items-center gap-2">
                  <Tag className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {blog.tags.map((tag, idx) => (
                    <span
                      key={`${tag.slug || tag.name}-${idx}`}
                      className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap"
                    >
                      <Tag className="w-3 h-3 flex-shrink-0" />
                      {tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6">
            {/* Author Info */}
            {blog.author && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">Author</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-brand-primary flex items-center justify-center text-white font-semibold text-sm sm:text-base flex-shrink-0">
                    {blog.author.full_name?.charAt(0)?.toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-text-heading truncate">{blog.author.full_name}</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">{blog.author.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* SEO Info */}
            {blog.seo_data && (
              <div className="card">
                <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">SEO Settings</h3>
                <div className="space-y-3 text-xs sm:text-sm">
                  {blog.seo_data.meta_title && (
                    <div>
                      <p className="text-gray-600 mb-1">Meta Title</p>
                      <p className="font-medium text-text-heading break-words">{blog.seo_data.meta_title}</p>
                    </div>
                  )}
                  {blog.seo_data.meta_description && (
                    <div>
                      <p className="text-gray-600 mb-1">Meta Description</p>
                      <p className="font-medium text-text-heading line-clamp-3 break-words">{blog.seo_data.meta_description}</p>
                    </div>
                  )}
                  {blog.seo_data.keywords && (
                    <div>
                      <p className="text-gray-600 mb-1">Keywords</p>
                      <p className="font-medium text-text-heading break-words">{blog.seo_data.keywords}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="card">
              <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Statistics
              </h3>
              <div className="space-y-2 sm:space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs sm:text-sm">Views</span>
                  <span className="font-semibold text-sm sm:text-base">{blog.views || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs sm:text-sm">Likes</span>
                  <span className="font-semibold text-sm sm:text-base">{blog.likes || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs sm:text-sm">Shares</span>
                  <span className="font-semibold text-sm sm:text-base">{blog.shares || 0}</span>
                </div>
              </div>
            </div>

            {/* Quick info */}
            <div className="card">
              <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-3 sm:mb-4">Identifiers</h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div>
                  <p className="text-gray-600 mb-0.5">ID</p>
                  <p className="font-mono break-all">{blog.id}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-0.5">Slug</p>
                  <p className="font-mono break-all">{blog.slug}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

