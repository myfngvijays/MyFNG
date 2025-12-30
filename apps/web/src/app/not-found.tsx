'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Search } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-16 sm:pt-20 md:pt-24">
        <section className="relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04]" />
          <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="absolute -bottom-28 -left-24 h-96 w-96 rounded-full bg-purple-300/20 blur-3xl" />

          <div className="relative container mx-auto px-4 sm:px-6 py-14 sm:py-16 md:py-20">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/70 border border-gray-200 shadow-lg shadow-blue-900/10 mb-5">
                <Search className="w-6 h-6 text-blue-700" />
              </div>

              <div className="text-7xl sm:text-8xl md:text-9xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                404
              </div>

              <h1 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
                Page not found
              </h1>
              <p className="mt-3 text-sm sm:text-base md:text-lg text-gray-600">
                The page you’re looking for doesn’t exist, or it may have been moved. Try going back, or return to the homepage.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
                    else router.push('/');
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white/80 px-6 py-3 text-gray-900 font-semibold hover:border-gray-400 transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>

                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-white font-semibold shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all"
                >
                  <Home className="w-5 h-5" />
                  Go to Home
                </Link>

                <Link
                  href="/services"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-6 py-3 text-gray-900 font-semibold hover:border-gray-300 transition-all"
                >
                  View Services
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}


