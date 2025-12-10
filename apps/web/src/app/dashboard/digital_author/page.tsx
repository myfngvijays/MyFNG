'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, Plus, Search, Edit, Eye, Clock,
  Calendar, Tag, BookOpen, CheckCircle, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Blog {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  status: string;
  views: number;
  read_time: number;
  created_at: string;
  published_at?: string;
  category?: { name: string; slug: string };
  tags?: Array<{ name: string; slug: string }>;
  featured_image?: string;
}

export default function DigitalAuthorDashboard() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    drafts: 0,
    published: 0,
    views: 0
  });

  useEffect(() => {
    fetchBlogs();
  }, []);

  async function fetchBlogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', '1');
      params.append('limit', '10');

      const response = await fetch(`/api/blogs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBlogs(data.blogs || []);
        
        // Calculate stats
        const all = data.blogs || [];
        setStats({
          total: all.length,
          drafts: all.filter((b: Blog) => b.status === 'draft').length,
          published: all.filter((b: Blog) => b.status === 'published').length,
          views: all.reduce((sum: number, b: Blog) => sum + (b.views || 0), 0)
        });
      } else {
        toast.error('Failed to fetch blogs');
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
      toast.error('Failed to fetch blogs');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Published</span>;
      case 'draft':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Draft</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{status}</span>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="digital_author">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="digital_author">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">My Blogs</h1>
            <p className="text-text-body mt-1">Create and manage your blog posts</p>
          </div>
          <Link href="/dashboard/digital_author/blogs/create">
            <button className="btn btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Blog
            </button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-text-body truncate">Total Blogs</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.total}</p>
              </div>
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-text-body truncate">Drafts</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.drafts}</p>
              </div>
              <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600 flex-shrink-0" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-text-body truncate">Published</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.published}</p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-text-body truncate">Total Views</p>
                <p className="text-xl sm:text-2xl font-bold text-text-heading">{stats.views}</p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Recent Blogs */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-heading">My Recent Blogs</h2>
            <Link href="/dashboard/digital_author/blogs">
              <button className="btn btn-sm btn-outline">View All</button>
            </Link>
          </div>

          {blogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-heading mb-2">No blogs yet</h3>
              <p className="text-text-body mb-4">Get started by creating your first blog post</p>
              <Link href="/dashboard/digital_author/blogs/create">
                <button className="btn btn-primary">Create Blog</button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {blogs.map((blog) => (
                <div key={blog.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition">
                  <div className="flex flex-col lg:flex-row gap-3 sm:gap-4">
                    {blog.featured_image && (
                      <img
                        src={blog.featured_image}
                        alt={blog.title}
                        className="w-full lg:w-32 h-32 lg:h-24 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-semibold text-text-heading mb-1 break-words">{blog.title}</h3>
                          {blog.excerpt && (
                            <p className="text-text-body text-xs sm:text-sm mb-2 line-clamp-1 break-words">{blog.excerpt}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                            {blog.category && (
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="truncate">{blog.category.name}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              {blog.read_time} min
                            </span>
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Eye className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              {blog.views} views
                            </span>
                            {blog.published_at && (
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                {new Date(blog.published_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(blog.status)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}`} className="flex-1 sm:flex-none min-w-0">
                          <button className="btn btn-sm btn-outline w-full sm:w-auto flex items-center justify-center gap-1">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="text-xs sm:text-sm">View</span>
                          </button>
                        </Link>
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}/edit`} className="flex-1 sm:flex-none min-w-0">
                          <button className="btn btn-sm btn-primary w-full sm:w-auto flex items-center justify-center gap-1">
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="text-xs sm:text-sm">Edit</span>
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
