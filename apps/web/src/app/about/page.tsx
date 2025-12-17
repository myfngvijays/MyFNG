'use client';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-20 sm:pt-24">
        <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-sm">
              <div className="text-sm font-bold text-brand-primary">MY FNG</div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">About Us</h1>
              <p className="mt-4 text-base sm:text-lg text-gray-700">
                MY FNG is your friendly neighbourhood garage—focused on reliable car service, transparent pricing,
                and a smooth booking experience.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-sm font-extrabold text-gray-900">What we do</div>
                  <p className="mt-2 text-sm text-gray-700">
                    Periodic service, repairs, diagnostics, and more—booked online with clear steps.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-sm font-extrabold text-gray-900">How we work</div>
                  <p className="mt-2 text-sm text-gray-700">
                    Quality-first process with skilled partners, checklists, and customer-friendly support.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-5 py-3 text-white font-bold hover:bg-brand-primary-hover transition"
                >
                  Explore Services
                </Link>
                <Link
                  href="/book-service"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-gray-900 font-bold hover:bg-gray-50 transition"
                >
                  Book Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

