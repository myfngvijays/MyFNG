import Link from 'next/link';
import type { Metadata } from 'next';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { buildNotFoundMetadata } from '@/lib/seo/technical';

export const metadata: Metadata = buildNotFoundMetadata();

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-red-600">404</p>
        <h1 className="mt-3 text-3xl font-black text-gray-900 sm:text-4xl">Page not found</h1>
        <p className="mt-4 max-w-xl text-gray-600">
          This page does not exist or may have moved. Try one of the links below to continue browsing MYFNG.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700">
            Go to Home
          </Link>
          <Link href="/book-service" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50">
            Book Car Service
          </Link>
          <Link href="/car-services" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50">
            Browse Services
          </Link>
          <Link href="/workshop-locator" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-800 hover:bg-gray-50">
            Find Workshops
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
