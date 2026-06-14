'use client';

import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import AppDownloadSection from '@/components/landing/AppDownloadSection';
import Link from 'next/link';
import { Bot, Car, CheckCircle2, Eye, MapPin, MessageCircle, Phone, Shield, Smartphone, Sparkles, Target, TrendingUp, Truck, Users, Wrench, Zap } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-28 sm:pt-36 pb-16 sm:pb-20 bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-400 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Car className="w-4 h-4" />
              India&apos;s First AI-Powered Car Care Platform
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight">
              About <span className="text-yellow-300">MY FNG</span>
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-blue-100 max-w-3xl mx-auto leading-relaxed">
              Your Friendly Neighbourhood Garage. Built to fix what the traditional car service industry has ignored for decades – trust, transparency, and convenience.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-white/80 text-sm">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-yellow-300" /> 10,000+ Happy Customers</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-yellow-300" /> Mumbai, Thane & Pune</div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-yellow-300" /> Verified Workshops Only</div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-8 sm:py-12">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">The Problem We&apos;re Solving</h2>
              <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
                Car owners are forced to choose between overpriced authorized centers or unorganized local garages with uncertain quality.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: '😤', title: 'Unclear Estimates', desc: 'Hidden charges and surprise bills after service' },
                { icon: '⏳', title: 'Unnecessary Delays', desc: 'No updates, no timeline, no accountability' },
                { icon: '❌', title: 'Zero Transparency', desc: 'Duplicate parts, fake repairs, no proof of work' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center">
                  <span className="text-3xl">{icon}</span>
                  <h3 className="mt-3 font-bold text-gray-900">{title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-lg font-semibold text-brand-primary">
              MY FNG was founded to fundamentally change how car servicing works in India.
            </p>
          </div>
        </div>
      </section>

      {/* What We Do */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">What We Do</h2>
              <p className="mt-3 text-gray-600 max-w-3xl mx-auto">
                MY FNG is a technology-driven car service aggregator that connects car owners with verified, top-quality multi-brand workshops – managing the entire service experience end-to-end.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Shield, title: 'Verified Workshops Only', desc: 'Every partner workshop is audited, graded, and continuously monitored for quality and pricing.' },
                { icon: Eye, title: 'Complete Transparency', desc: 'Real-time updates with photos & videos – pre-inspection, work in progress, parts used, and delivery.' },
                { icon: CheckCircle2, title: 'No Hidden Surprises', desc: 'Clear estimates before work begins. No work done without customer approval.' },
                { icon: Truck, title: 'Free Pickup & Drop', desc: 'Convenience is built into the system, not offered as an upsell.' },
                { icon: Shield, title: 'Warranty on Services', desc: 'Every service comes with warranty coverage for complete peace of mind.' },
                { icon: Phone, title: '24/7 Roadside Assistance', desc: 'In-house RSA after acquiring Roadserve – truly integrated car care.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-lg transition-shadow">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-gray-700 font-medium">
              Customers don&apos;t deal with workshops directly. <span className="font-bold text-gray-900">MY FNG owns the experience.</span>
            </p>
          </div>
        </div>
      </section>

      {/* AI & Technology Section */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold mb-3">
                <Sparkles className="w-4 h-4" />
                AI-Powered Platform
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Built for Scale, Powered by Technology</h2>
              <p className="mt-3 text-gray-600 max-w-3xl mx-auto">
                India&apos;s first AI-focused car service booking platform – designed to eliminate outdated, form-heavy booking flows.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* MISA AI Bot */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MISA AI</h3>
                    <p className="text-sm text-gray-600">Smart Booking Assistant</p>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Our AI-powered chatbot MISA helps you book car services in under 60 seconds – no forms, no calls. Just chat naturally and get instant recommendations, pricing, and scheduling.
                </p>
                <ul className="space-y-2">
                  {[
                    'Natural language service booking',
                    'Instant price estimates',
                    'Smart service recommendations based on car age & mileage',
                    'Available 24/7 on app & website',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* MyFNG App */}
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">MyFNG App</h3>
                    <p className="text-sm text-gray-600">Everything in Your Pocket</p>
                  </div>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  The MyFNG mobile app puts complete car care in your hands – book services, track live progress with photos, chat with MISA AI, manage your service history, and get exclusive app-only discounts.
                </p>
                <ul className="space-y-2">
                  {[
                    'Book in 60 seconds via AI or manual flow',
                    'Live tracking with real-time photo updates',
                    'MyFNG Prime membership for extra savings',
                    'Available on Android & iOS',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3 mt-4">
                  <a href="https://play.google.com/store/apps/details?id=com.myfng.app" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white bg-[#01875f] px-3 py-1.5 rounded-full">
                    Google Play
                  </a>
                  <a href="https://apps.apple.com/in/app/myfng-trusted-car-care/id6767495114" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-white bg-black px-3 py-1.5 rounded-full">
                    App Store
                  </a>
                </div>
              </div>
            </div>

            {/* Tech Roadmap */}
            <div className="mt-8 bg-gray-50 border border-gray-200 rounded-2xl p-6">
              <h3 className="font-bold text-gray-900 mb-4">Our Technology Roadmap</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: Zap, text: 'Faster Bookings' },
                  { icon: Bot, text: 'Smarter Diagnostics' },
                  { icon: MessageCircle, text: 'Better Communication' },
                  { icon: TrendingUp, text: 'Workshop Efficiency' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                    <Icon className="w-4 h-4 text-brand-primary flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">{text}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-600">This is not just a service platform – it is infrastructure for the future of car care.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-blue-200 rounded-2xl p-6 sm:p-8">
              <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Our Vision</h2>
              <p className="mt-3 text-gray-700 leading-relaxed">
                To become India&apos;s most trusted and seamless car care platform, serving millions of car owners with consistency, transparency, and reliability – city by city.
              </p>
            </div>
            <div className="bg-white border border-indigo-200 rounded-2xl p-6 sm:p-8">
              <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Our Mission</h2>
              <p className="mt-3 text-gray-700 leading-relaxed">
                To remove stress, confusion, and unfair practices from car servicing by combining:
              </p>
              <ul className="mt-3 space-y-2">
                {['The best workshops', 'Strong operational processes', 'Technology and AI', 'A customer-first mindset'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Where We Operate */}
      <section className="py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Where We Operate</h2>
            <p className="mt-3 text-gray-600">Currently serving car owners across major cities – and expanding rapidly.</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {['Mumbai', 'Navi Mumbai', 'Thane', 'Palghar', 'Pune'].map((city) => (
                <div key={city} className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-gray-900">{city}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Trust Us */}
      <section className="py-12 sm:py-16 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Why Customers Trust MY FNG</h2>
            <p className="mt-4 text-gray-700 text-lg leading-relaxed">
              Thousands of car owners choose MY FNG not because we are cheaper – but because we are clear, reliable, and accountable.
            </p>
            <div className="mt-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white">
              <p className="text-lg">When you book with MY FNG, you&apos;re not booking a garage.</p>
              <p className="mt-2 text-2xl sm:text-3xl font-bold">You&apos;re booking peace of mind.</p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/car-services"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-6 py-3 text-white font-bold hover:bg-brand-primary-hover transition"
              >
                <Wrench className="w-4 h-4" />
                Explore Services
              </Link>
              <Link
                href="/book-service"
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-6 py-3 text-gray-900 font-bold hover:bg-gray-50 transition"
              >
                <Zap className="w-4 h-4" />
                Book Service
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* App Download Section */}
      <AppDownloadSection />

      <Footer />
    </div>
  );
}
