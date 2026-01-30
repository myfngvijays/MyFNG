import { Suspense } from 'react';
import BlogPageClient from './BlogPageClient';

export default function BlogPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <BlogPageClient />
    </Suspense>
  );
}

