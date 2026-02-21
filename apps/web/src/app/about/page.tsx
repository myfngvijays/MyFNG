'use client';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/40 via-white to-white">
      <Navbar />
      <main className="pt-20 sm:pt-24">
        <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-5xl mx-auto">
            <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-10 shadow-xl shadow-blue-900/5">
              <div className="text-sm font-bold text-brand-primary">MY FNG</div>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-gray-900">About MY FNG</h1>
              <div className="mt-6 space-y-8 text-gray-700">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 sm:p-6 space-y-4">
                  <p className="text-base sm:text-lg">
                    MY FNG is India's integrated car care platform, built to fix what the traditional car service industry has ignored for decades - trust, transparency, and convenience.
                  </p>
                  <p className="text-base sm:text-lg">
                    Car owners are often forced to choose between overpriced authorized service centers or unorganized local garages with uncertain quality. Delays, unclear estimates, duplicate parts, and zero accountability have become normal. We believe they should not be.
                  </p>
                  <p className="text-base sm:text-lg">
                    MY FNG was founded to fundamentally change how car servicing works in India.
                  </p>
                </div>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">What We Do</h2>
                  <p className="mt-3">
                    MY FNG is a technology-driven car service and repair aggregator that connects car owners with verified, top-quality multi-brand workshops - while managing the entire service experience end-to-end.
                  </p>
                  <p className="mt-3">
                    From periodic servicing and mechanical repairs to detailing and roadside assistance, we ensure every service is:
                  </p>
                  <ul className="mt-3 list-disc pl-5 space-y-1 marker:text-brand-primary">
                    <li>Transparent</li>
                    <li>Professionally managed</li>
                    <li>Backed by process, warranty, and accountability</li>
                  </ul>
                  <p className="mt-3">Customers do not deal with workshops directly. MY FNG owns the experience.</p>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">How MY FNG Is Different</h2>
                  <p className="mt-3">
                    Unlike traditional platforms that only generate leads, MY FNG operates as a managed car care ecosystem.
                  </p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">Verified Workshops Only</h3>
                      <p>Every partner workshop is audited, graded, and continuously monitored for quality, pricing, and service discipline.</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">Complete Transparency</h3>
                      <p>Customers receive real-time updates with photos and videos - pre-inspection, work in progress, parts used, and final delivery.</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">No Hidden Surprises</h3>
                      <p>Clear estimates are shared before work begins. No work is done without customer approval.</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">Free Pickup &amp; Drop</h3>
                      <p>Convenience is built into the system, not offered as an upsell.</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">Warranty on Services</h3>
                      <p>Every service comes with warranty coverage for peace of mind.</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <h3 className="font-bold text-gray-900">In-house Roadside Assistance</h3>
                      <p>After acquiring Roadserve, MY FNG became one of the first car service aggregators in India with in-house 24/7 roadside assistance, making us a truly integrated car care platform.</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Built for Scale, Powered by Technology</h2>
                  <p className="mt-3">
                    MY FNG is building India's first AI-focused car service booking platform, designed to eliminate outdated, form-heavy booking flows.
                  </p>
                  <p className="mt-3">Customers can book services through:</p>
                  <ul className="mt-3 list-disc pl-5 space-y-1 marker:text-brand-primary">
                    <li>A smart, simplified booking system</li>
                    <li>AI-powered chat-based assistance</li>
                    <li>Direct support for urgent and roadside needs</li>
                  </ul>
                  <p className="mt-3">Our technology roadmap is focused on:</p>
                  <ul className="mt-3 list-disc pl-5 space-y-1 marker:text-brand-primary">
                    <li>Faster bookings</li>
                    <li>Smarter diagnostics</li>
                    <li>Better customer communication</li>
                    <li>Higher workshop efficiency</li>
                  </ul>
                  <p className="mt-3">This is not just a service platform - it is infrastructure for the future of car care.</p>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Our Vision</h2>
                  <p className="mt-3">
                    To become India's most trusted and seamless car care platform, serving millions of car owners with consistency, transparency, and reliability - city by city.
                  </p>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Our Mission</h2>
                  <p className="mt-3">To remove stress, confusion, and unfair practices from car servicing by combining:</p>
                  <ul className="mt-3 list-disc pl-5 space-y-1 marker:text-brand-primary">
                    <li>The best workshops</li>
                    <li>Strong operational processes</li>
                    <li>Technology and AI</li>
                    <li>A customer-first mindset</li>
                  </ul>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Where We Operate</h2>
                  <p className="mt-3">MY FNG currently serves car owners across:</p>
                  <ul className="mt-3 list-disc pl-5 space-y-1 marker:text-brand-primary">
                    <li>Mumbai</li>
                    <li>Navi Mumbai</li>
                    <li>Thane</li>
                    <li>Palghar</li>
                    <li>Pune</li>
                  </ul>
                  <p className="mt-3">...and is expanding rapidly across major Indian cities.</p>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-gray-50/60 p-5 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Why Customers Trust MY FNG</h2>
                  <p className="mt-3">
                    Thousands of car owners choose MY FNG not because we are cheaper - but because we are clear, reliable, and accountable.
                  </p>
                  <p className="mt-3">When you book with MY FNG, you are not booking a garage.</p>
                  <p className="mt-1 font-semibold text-gray-900">You are booking peace of mind.</p>
                </section>
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
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

