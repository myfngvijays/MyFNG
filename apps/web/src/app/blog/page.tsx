'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { ArrowRight, Calendar, Clock, Search } from 'lucide-react';
import { formatDateDMY } from "@/lib/utils";

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
  featured_image?: string;
  category?: { id: string; name: string; slug: string };
  tags?: Array<{ name: string; slug: string }>;
  author?: { full_name: string };
}

export default function BlogPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchBlogs();
  }, []);

  useEffect(() => {
    // Extract categories from blogs after blogs are loaded
    if (blogs.length > 0) {
      const uniqueCategories = Array.from(
        new Map(
          blogs
            .filter(blog => blog.category)
            .map(blog => [blog.category!.id, blog.category!])
        ).values()
      );
      setCategories(uniqueCategories);
    }
  }, [blogs]);

  async function fetchBlogs() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '50'); // Get more blogs
      
      // Use public API endpoint - no authentication required
      const response = await fetch(`/api/blogs/public?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setBlogs(data.blogs || []);
      } else {
        console.error('Failed to fetch blogs');
      }
    } catch (error) {
      console.error('Error fetching blogs:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPosts = blogs.filter(blog => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (blog.excerpt && blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (blog.tags && blog.tags.some(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase())));
    
    // Category filter
    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory && blog.category?.id === selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return formatDateDMY(date);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Header */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 sm:mb-3 md:mb-4 text-white">Our Blog</h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-200">
              Expert tips, industry insights, and car care advice
            </p>
          </div>
        </div>
      </section>

      {/* Search and Filter */}
      <section className="py-6 sm:py-7 md:py-8 bg-white border-b border-gray-200">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {/* Search Bar */}
            <div className="relative mb-4 sm:mb-5 md:mb-6">
              <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-brand-primary text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    selectedCategory === category.id
                      ? 'bg-brand-primary text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-10 sm:py-12 md:py-16">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="text-center py-12 sm:py-16 md:py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm sm:text-base md:text-lg">Loading blogs...</p>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12 sm:py-16 md:py-20">
                <p className="text-gray-500 text-sm sm:text-base md:text-lg">No blog posts found matching your criteria.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                {filteredPosts.map((blog) => (
                  <Link
                    key={blog.id}
                    href={`/blogs/${blog.slug}`}
                    className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all group"
                  >
                    <div className="h-40 sm:h-44 md:h-48 relative overflow-hidden bg-gray-200">
                      {blog.featured_image ? (
                        <Image
                          src={blog.featured_image}
                          alt={blog.title}
                          fill
                          className="object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-primary to-blue-600">
                          <span className="text-white text-4xl font-bold">
                            {blog.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {blog.category && (
                        <div className="absolute top-3 sm:top-4 left-3 sm:left-4">
                          <span className="bg-brand-primary text-white px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold">
                            {blog.category.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 md:p-6">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 text-[10px] sm:text-xs text-gray-500 mb-2 sm:mb-3">
                        {blog.published_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                            {formatDate(blog.published_at)}
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                          {blog.read_time || 3} min read
                        </div>
                      </div>
                      <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary mb-2 sm:mb-3 group-hover:text-brand-primary transition line-clamp-2">
                        {blog.title}
                      </h3>
                      {blog.excerpt && (
                        <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-3">
                          {blog.excerpt}
                        </p>
                      )}
                      {blog.tags && blog.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3 sm:mb-4">
                          {blog.tags.slice(0, 3).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] sm:text-xs"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-brand-primary text-xs sm:text-sm font-semibold">
                        Read More <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

