'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  FileText, Plus, Search, Filter, Edit, Trash2, Eye, 
  Calendar, Tag, BookOpen, CheckCircle, XCircle, Clock,
  TrendingUp
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
  likes: number;
  is_featured: boolean;
  read_time: number;
  created_at: string;
  published_at?: string;
  category?: { name: string; slug: string };
  author?: { full_name: string };
  tags?: Array<{ name: string; slug: string }>;
  featured_image?: string;
}

export default function BlogsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  useEffect(() => {
    fetchBlogs();
    fetchCategories();
  }, [filter, searchTerm, pagination.page, selectedCategory]);

  async function fetchCategories() {
    try {
      const response = await fetch('/api/blogs/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }

  async function fetchBlogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory) params.append('category_id', selectedCategory);
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/blogs?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBlogs(data.blogs || []);
        setPagination(data.pagination || pagination);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to fetch blogs');
      }
    } catch (error: any) {
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
      case 'archived':
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold flex items-center gap-1"><XCircle className="w-3 h-3" /> Archived</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">{status}</span>;
    }
  };

  return (
    <DashboardLayout role="digital_author">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">Blog Management</h1>
            <p className="text-text-body mt-1">Create, edit, and manage blog posts</p>
          </div>
          <Link href="/dashboard/digital_marketing/blogs/create">
            <button className="btn btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Blog
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search blogs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Blogs List */}
        {loading ? (
          <div className="card text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading blogs...</p>
          </div>
        ) : blogs.length === 0 ? (
          <div className="card text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-text-heading mb-2">No blogs found</h3>
            <p className="text-text-body mb-4">Get started by creating your first blog post</p>
            <Link href="/dashboard/digital_author/blogs/create">
              <button className="btn btn-primary">Create Blog</button>
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {blogs.map((blog) => (
                <div key={blog.id} className="card hover:shadow-lg transition">
                  <div className="flex flex-col lg:flex-row gap-4">
                    {blog.featured_image && (
                      <img
                        src={blog.featured_image}
                        alt={blog.title}
                        className="w-full lg:w-48 h-32 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base sm:text-lg font-semibold text-text-heading break-words">{blog.title}</h3>
                            {blog.is_featured && (
                              <span className="px-2 py-0.5 bg-brand-primary text-white rounded text-xs font-semibold whitespace-nowrap flex-shrink-0">Featured</span>
                            )}
                          </div>
                          {blog.excerpt && (
                            <p className="text-text-body text-sm mb-3 line-clamp-2 break-words">{blog.excerpt}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                            {blog.category && (
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                                <span className="truncate">{blog.category.name}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1 whitespace-nowrap">
                              <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              {blog.read_time} min read
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
                          {blog.tags && blog.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {blog.tags.map((tag, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs flex items-center gap-1 whitespace-nowrap">
                                  <Tag className="w-3 h-3 flex-shrink-0" />
                                  {tag.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(blog.status)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}`} className="flex-1 sm:flex-none">
                          <button className="btn btn-sm btn-outline w-full sm:w-auto flex items-center justify-center gap-1">
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">View</span>
                          </button>
                        </Link>
                        <Link href={`/dashboard/digital_author/blogs/${blog.id}/edit`} className="flex-1 sm:flex-none">
                          <button className="btn btn-sm btn-primary w-full sm:w-auto flex items-center justify-center gap-1">
                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="text-xs sm:text-sm">Edit</span>
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                  className="btn btn-outline btn-sm"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page >= pagination.totalPages}
                  className="btn btn-outline btn-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
