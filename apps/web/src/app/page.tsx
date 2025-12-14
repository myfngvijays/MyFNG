'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import BookingForm from '@/components/landing/BookingForm';
import LiveStats from '@/components/landing/LiveStats';
import AIFeatureBadge from '@/components/landing/AIFeatureBadge';
import TrustBadges from '@/components/landing/TrustBadges';
import DynamicFOMO from '@/components/landing/DynamicFOMO';
import { 
  MessageSquare, 
  Zap, 
  CheckCircle, 
  Star, 
  ChevronRight, 
  Bot, 
  ArrowRight, 
  Shield, 
  Clock, 
  MapPin, 
  Activity, 
  Car,
  Users,
  Award,
  TrendingUp,
  Heart,
  HelpCircle,
  Quote,
  Loader2,
  Sparkles,
  Cpu,
  Radio,
  AlertCircle,
  Droplets,
  Calendar
} from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const [activeCarType, setActiveCarType] = useState<'hatchback' | 'sedan' | 'suv'>('sedan');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);

  // Pricing Data based on Car Type
  const pricingData = {
    hatchback: { basic: '₹1,999', premium: '₹3,999', comprehensive: '₹6,999' },
    sedan: { basic: '₹2,499', premium: '₹4,999', comprehensive: '₹8,999' },
    suv: { basic: '₹3,499', premium: '₹6,499', comprehensive: '₹10,999' }
  };

  // Brand Logos - Fetch from database
  const [brandLogos, setBrandLogos] = useState<Array<{ name: string; logo: string }>>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const response = await fetch('/api/super_admin/car-brands?active_only=true');
        if (response.ok) {
          const result = await response.json();
          const brands = (result.data || []).map((brand: any) => ({
            name: brand.name,
            logo: brand.logo_url,
          }));
          setBrandLogos(brands);
        } else {
          // Fallback to empty array if API fails
          setBrandLogos([]);
        }
      } catch (error) {
        console.error('Error fetching brands:', error);
        setBrandLogos([]);
      } finally {
        setBrandsLoading(false);
      }
    }
    fetchBrands();
  }, []);

  return (
    <div className="min-h-screen bg-white font-poppins text-text-body selection:bg-brand-primary/20">
      <Navbar />

      {/* 1. Hero Section: AI-Powered & Futuristic - Updated Clean Look */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24 overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        <div className="absolute top-0 right-0 w-full lg:w-1/2 h-full bg-gradient-to-l from-blue-100/40 to-transparent transform skew-x-12 translate-x-1/4"></div>
        
        {/* Floating background blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-float" style={{animationDelay: '1.5s'}}></div>

        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            
            {/* Left Content */}
            <div className="lg:w-1/2 text-center lg:text-left w-full">
              {/* AI Badge */}
              <div className="mb-6 flex justify-center lg:justify-start">
                <AIFeatureBadge text="Powered by Advanced AI Technology" />
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 text-gray-900 leading-tight tracking-tight">
                India's First <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  AI-Powered Car
                </span> <br />
                Service Booking Platform
              </h1>
              
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed font-medium">
                Smart diagnostics, transparent pricing, verified garages, and real-time tracking — all in one platform
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <button 
                  onClick={() => setIsBookingFormOpen(true)}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl shadow-lg shadow-blue-600/20 font-semibold text-lg transition-all transform hover:-translate-y-1 hover:shadow-xl"
                >
                  Book Service Now
                </button>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="btn bg-white border-2 border-blue-100 hover:border-blue-600 text-blue-900 hover:text-blue-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:-translate-y-1"
                >
                  Get AI Diagnosis
                </button>
              </div>

              {/* Dynamic FOMO - Live Indicator */}
              <div className="mb-12 flex justify-center lg:justify-start">
                 <DynamicFOMO />
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-gray-100">
                <div className="flex flex-col items-center lg:items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-1">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-900 text-sm sm:text-base">Verified Garages</span>
                </div>
                
                <div className="flex flex-col items-center lg:items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-1">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-900 text-sm sm:text-base">Genuine Parts</span>
                </div>

                <div className="flex flex-col items-center lg:items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 mb-1">
                    <Shield className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-900 text-sm sm:text-base">Upfront Pricing</span>
                </div>

                <div className="flex flex-col items-center lg:items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-1">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-gray-900 text-sm sm:text-base">Pan-India Network</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:w-1/2 relative w-full mt-10 lg:mt-0">
              <div className="relative z-10 perspective-1000">
                {/* Main Image - Using the clean futuristic car image */}
                <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/20 bg-white p-2 border border-white/50 backdrop-blur-sm">
                  <div className="rounded-2xl overflow-hidden relative bg-gradient-to-b from-gray-100 to-white">
                     {/* Using a placeholder car illustration or the existing image but styled cleaner */}
                     <img 
                      src="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=1000" 
                      alt="Futuristic Car" 
                      className="w-full object-cover h-[300px] sm:h-[400px] mix-blend-multiply opacity-90 hover:opacity-100 transition-opacity duration-500"
                    />
                    {/* Gradient Overlay for better text visibility if needed */}
                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
                  </div>
                </div>
                
                {/* Floating Card 1: AI Recommendation */}
                <div className="absolute -top-6 -left-6 md:top-8 md:-left-12 bg-white p-4 rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-50 animate-float z-20 max-w-[240px]">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">AI Recommendation</div>
                      <div className="font-bold text-gray-900 text-sm leading-tight">Engine Oil Change Due</div>
                    </div>
                  </div>
                </div>

                {/* Floating Card 2: Health Status */}
                <div className="absolute top-1/3 -right-6 md:-right-12 bg-white p-4 rounded-2xl shadow-xl shadow-green-900/5 border border-green-50 animate-float z-20 max-w-[200px]" style={{animationDelay: '1s'}}>
                   <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-green-600 uppercase tracking-wider">Health Status</div>
                      <div className="font-bold text-gray-900 text-sm">92% Overall Health</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{width: '92%'}}></div>
                  </div>
                </div>

                {/* Floating Card 3: Nearest Workshop */}
                <div className="absolute -bottom-8 left-10 md:bottom-8 md:left-0 bg-white p-4 rounded-2xl shadow-xl shadow-purple-900/5 border border-purple-50 animate-float z-20" style={{animationDelay: '2s'}}>
                   <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-600/20">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Nearest Workshop</div>
                      <div className="font-bold text-gray-900 text-sm">2.3 km away</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-20 pt-10 border-t border-gray-200/60 animate-fade-in-up" style={{animationDelay: '0.8s'}}>
            <TrustBadges />
          </div>
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-12 sm:py-14 md:py-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <AIFeatureBadge text="Real-Time Analytics" />
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-3 sm:mt-4 mb-3 sm:mb-4 text-brand-secondary">Trusted by Thousands</h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-2 sm:px-0">
              Join India's fastest-growing AI-powered car service booking platform
            </p>
          </div>
          <LiveStats />
        </div>
      </section>

      {/* 2. Our Services */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Our Services</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 mb-3 sm:mb-4 text-brand-secondary">Complete Car Care Solutions</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-2 sm:px-0">
              From periodic maintenance to complex repairs - our AI chatbot recommends the perfect service for your car. 
              <span className="font-semibold text-brand-secondary">100% transparent pricing</span> with no hidden charges.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
            <ServiceTypeCard 
              icon={<Activity className="w-8 h-8" />}
              title="Periodic Service"
              desc="AI-powered scheduled maintenance with digital health reports"
              features={['Oil Change', 'Filter Replacement', 'Fluid Top-up', 'AI Health Report']}
              slug="periodic-service"
            />
            <ServiceTypeCard 
              icon={<Zap className="w-8 h-8" />}
              title="Engine Service"
              desc="Complete engine diagnostics powered by AI"
              features={['Engine Diagnostics', 'Oil Service', 'Filter Change', 'Performance Check']}
              slug="engine-service"
            />
            <ServiceTypeCard 
              icon={<Shield className="w-8 h-8" />}
              title="AC Service"
              desc="Complete climate control solutions"
              features={['AC Cleaning', 'Gas Refill', 'Filter Change', 'Sanitization']}
              slug="ac-service"
            />
            <ServiceTypeCard 
              icon={<Zap className="w-8 h-8" />}
              title="Battery Service"
              desc="AI-powered battery health analysis"
              features={['Battery Check', 'Charging Test', 'Replacement', 'Warranty']}
              slug="battery-service"
            />
            <ServiceTypeCard 
              icon={<Shield className="w-8 h-8" />}
              title="Brake Service"
              desc="Complete brake system inspection"
              features={['Brake Pad Check', 'Fluid Replacement', 'Disc Inspection', 'Safety Test']}
              slug="brake-service"
            />
            <ServiceTypeCard 
              icon={<Car className="w-8 h-8" />}
              title="Tyre & Wheel Care"
              desc="Professional tyre and wheel services"
              features={['Tyre Rotation', 'Wheel Alignment', 'Balancing', 'Replacement']}
              slug="tyre-wheel-care"
            />
            <ServiceTypeCard 
              icon={<Activity className="w-8 h-8" />}
              title="Detailing Service"
              desc="Premium car detailing and protection"
              features={['Interior Cleaning', 'Exterior Polish', 'Waxing', 'Ceramic Coating']}
              slug="detailing-service"
            />
            <ServiceTypeCard 
              icon={<Car className="w-8 h-8" />}
              title="Denting & Painting"
              desc="High-precision body work"
              features={['Dent Removal', 'Color Matching', 'Paint Protection', 'Quality Check']}
              slug="denting-painting"
            />
          </div>

          <div className="text-center mt-8 sm:mt-10 md:mt-12">
            <Link href="/services" className="btn btn-primary text-sm sm:text-base md:text-lg px-6 sm:px-8 md:px-10 py-2.5 sm:py-3 md:py-4 rounded-xl inline-flex items-center gap-2">
              Explore All Services <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Brands We Serve - Horizontal Scrolling */}
      <section className="py-12 sm:py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Brands We Serve</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">We Service All Major Car Brands</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              From Maruti to Mercedes, we've got you covered
            </p>
          </div>

          <div className="relative overflow-hidden py-2 sm:py-4">
            {brandsLoading ? (
              <div className="flex justify-center items-center py-8 sm:py-10 md:py-12">
                <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-brand-primary" />
              </div>
            ) : brandLogos.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500">
                <Car className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
                <p className="text-sm sm:text-base">No brands available. Please add brands from admin panel.</p>
              </div>
            ) : (
              <div className="flex gap-4 sm:gap-5 md:gap-6 animate-scroll-horizontal">
                {/* Brand logos with images */}
                {brandLogos.map((brand, idx) => (
                  <div key={`brand-1-${idx}`} className="flex items-center justify-center min-w-[120px] sm:min-w-[130px] md:min-w-[140px] h-20 sm:h-24 md:h-28 bg-white rounded-lg sm:rounded-xl shadow-md hover:shadow-xl transition-all p-3 sm:p-4 md:p-5 border border-gray-100 flex-shrink-0 group relative">
                    <img 
                      src={brand.logo} 
                      alt={brand.name} 
                      className="object-contain w-full h-full max-w-[120px] max-h-[70px] group-hover:scale-110 transition-transform"
                      loading="eager"
                      onError={(e) => {
                        // Fallback: show brand name if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.brand-fallback')) {
                          const fallback = document.createElement('span');
                          fallback.className = 'brand-fallback text-sm font-bold text-gray-700 text-center px-3';
                          fallback.textContent = brand.name;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {/* Always show brand name below logo */}
                    <span className="absolute -bottom-6 left-0 right-0 text-xs font-semibold text-gray-600 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {brand.name}
                    </span>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {brandLogos.map((brand, idx) => (
                  <div key={`brand-2-${idx}`} className="flex items-center justify-center min-w-[140px] h-28 bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-5 border border-gray-100 flex-shrink-0 group relative">
                    <img 
                      src={brand.logo} 
                      alt={brand.name} 
                      className="object-contain w-full h-full max-w-[120px] max-h-[70px] group-hover:scale-110 transition-transform"
                      loading="eager"
                      onError={(e) => {
                        // Fallback: show brand name if image fails
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.brand-fallback')) {
                          const fallback = document.createElement('span');
                          fallback.className = 'brand-fallback text-sm font-bold text-gray-700 text-center px-3';
                          fallback.textContent = brand.name;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                    {/* Always show brand name below logo */}
                    <span className="absolute -bottom-6 left-0 right-0 text-xs font-semibold text-gray-600 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {brand.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. How MY FNG Works */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">How It Works</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">Hassle-Free Car Maintenance with MY FNG AI Booking</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 max-w-2xl mx-auto px-4">
              Experience the future of car service booking. Our AI-powered booking platform helps you book services directly - no employee needed. 
              Complete transparency in pricing and real-time tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
            <StepCard 
              number="01" 
              title="Chat with MY FNG AI" 
              desc="Simply chat with our AI assistant - no employee interaction needed. Our AI understands your car model, service history, and recommends the perfect service package."
            />
            <StepCard 
              number="02" 
              title="Transparent Pricing" 
              desc="Get instant, transparent pricing based on your car model and location. No hidden charges - our AI-powered booking platform ensures complete pricing transparency."
            />
            <StepCard 
              number="03" 
              title="Hassle-Free Service" 
              desc="Book your service directly through AI chatbot. Real-time tracking, AI-powered quality checks, and instant updates throughout the process."
            />
          </div>
        </div>
      </section>

      {/* 5. Why Choose MY FNG */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Why Choose Us</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">Why Choose MY FNG?</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 max-w-2xl mx-auto px-4">
              Experience the difference with our AI-powered platform and premium service quality
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-7 md:gap-8">
            <WhyChooseCard 
              icon={<Bot className="w-8 h-8" />}
              title="AI-Powered Booking"
              desc="Book services directly through our AI chatbot - no employee interaction needed"
            />
            <WhyChooseCard 
              icon={<Shield className="w-8 h-8" />}
              title="100% Transparent Pricing"
              desc="No hidden charges. See exactly what you pay for with upfront pricing"
            />
            <WhyChooseCard 
              icon={<Clock className="w-8 h-8" />}
              title="Quick Service"
              desc="Fast turnaround times with real-time tracking and updates"
            />
            <WhyChooseCard 
              icon={<Award className="w-8 h-8" />}
              title="Quality Assured"
              desc="AI-powered quality checks and certified technicians"
            />
            <WhyChooseCard 
              icon={<Users className="w-8 h-8" />}
              title="Expert Technicians"
              desc="Trained professionals with years of experience"
            />
            <WhyChooseCard 
              icon={<TrendingUp className="w-8 h-8" />}
              title="Real-Time Updates"
              desc="Track your service progress with live updates and photos"
            />
            <WhyChooseCard 
              icon={<Heart className="w-8 h-8" />}
              title="Customer First"
              desc="Dedicated support team available 24/7 for your assistance"
            />
            <WhyChooseCard 
              icon={<CheckCircle className="w-8 h-8" />}
              title="Warranty Guaranteed"
              desc="All services come with warranty and quality guarantee"
            />
          </div>
        </div>
      </section>

      {/* Emergency Roadside Assistance Section - High Impact */}
      <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
        {/* Dramatic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-orange-950 to-red-900"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
        
        {/* Animated Elements */}
        <div className="hidden md:block absolute top-0 left-0 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="hidden md:block absolute bottom-0 right-0 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>

        <div className="container mx-auto px-3 sm:px-4 md:px-6 relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Emergency Badge */}
            <div className="flex justify-center mb-4 sm:mb-5 md:mb-6">
              <div className="inline-flex items-center gap-2 sm:gap-3 glass px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-full border border-red-500/30 animate-pulse-glow">
                <div className="relative flex items-center">
                  <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="absolute w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full animate-ping"></div>
                </div>
                <span className="text-white font-bold text-xs sm:text-sm">24/7 EMERGENCY SUPPORT</span>
              </div>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-center text-white mb-4 sm:mb-5 md:mb-6 animate-fade-in-up px-4">
              Stuck on the Road? <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                We're Just a Tap Away!
              </span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-gray-300 text-center mb-8 sm:mb-10 md:mb-12 max-w-3xl mx-auto animate-fade-in-up px-4" style={{animationDelay: '0.2s'}}>
              Car breakdown? Flat tire? Battery dead? Our AI-powered roadside assistance reaches you in <span className="text-white font-bold">under 30 minutes</span>. 
              Available 24/7 across India.
            </p>

            {/* RSA Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12">
              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Jump Start</h3>
                <p className="text-gray-400 text-sm">Battery dead? We'll get you started in minutes</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <Car className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Towing Service</h3>
                <p className="text-gray-400 text-sm">Vehicle won't start? We'll tow it to safety</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.5s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Flat Tire Fix</h3>
                <p className="text-gray-400 text-sm">Puncture? We'll change or repair on the spot</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.6s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <Droplets className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Fuel Delivery</h3>
                <p className="text-gray-400 text-sm">Out of fuel? Emergency fuel delivery</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.7s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Live GPS Tracking</h3>
                <p className="text-gray-400 text-sm">Track our technician in real-time</p>
              </div>

              <div className="glass p-6 rounded-2xl border border-white/10 hover:border-orange-500/50 transition animate-fade-in-up" style={{animationDelay: '0.8s'}}>
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Quick Response</h3>
                <p className="text-gray-400 text-sm">Average arrival time: 25 minutes</p>
              </div>
            </div>

            {/* Emergency CTA */}
            <div className="text-center animate-fade-in-up" style={{animationDelay: '0.9s'}}>
              <Link
                href="/roadside-assistance"
                className="inline-flex items-center gap-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-xl font-bold px-12 py-5 rounded-2xl shadow-2xl shadow-red-500/50 transition-all transform hover:-translate-y-1 hover:shadow-3xl animate-pulse-glow"
              >
                <Radio className="w-6 h-6 animate-pulse" />
                Request Emergency Help
                <ArrowRight className="w-6 h-6" />
              </Link>
              <p className="text-gray-400 mt-4 text-sm">
                Available in 50+ cities across India • 24/7 Support
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. From Our Blogs */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Latest Updates</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">From Our Blogs</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Stay updated with car maintenance tips, industry news, and expert advice
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
            <BlogCard 
              title="5 Essential Car Maintenance Tips for Monsoon"
              excerpt="Protect your car during rainy season with these expert tips..."
              date="Dec 15, 2024"
              image="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=400"
            />
            <BlogCard 
              title="How AI is Revolutionizing Car Service Industry"
              excerpt="Discover how artificial intelligence is transforming car maintenance..."
              date="Dec 10, 2024"
              image="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=400"
            />
            <BlogCard 
              title="Understanding Your Car's Service Schedule"
              excerpt="Learn when and why your car needs regular servicing..."
              date="Dec 5, 2024"
              image="https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=400"
            />
          </div>

          <div className="text-center mt-8 sm:mt-10 md:mt-12">
            <Link href="/blog" className="btn btn-outline text-sm sm:text-base md:text-lg px-6 sm:px-8 md:px-10 py-2.5 sm:py-3 md:py-4 rounded-xl">
              Read All Blogs <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. What People Say - Testimonials */}
      <section className="py-12 sm:py-16 md:py-20 bg-gray-50">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Testimonials</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">What People Say About Us</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Real feedback from our satisfied customers
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 md:gap-8">
            <TestimonialCard 
              name="Rajesh Kumar"
              location="Mumbai"
              rating={5}
              text="Best car service experience! The AI chatbot made booking so easy. Transparent pricing and excellent service quality."
              vehicle="Honda City"
            />
            <TestimonialCard 
              name="Priya Sharma"
              location="Navi Mumbai"
              rating={5}
              text="MY FNG saved me so much time. Real-time updates and professional service. Highly recommended!"
              vehicle="Maruti Swift"
            />
            <TestimonialCard 
              name="Amit Patel"
              location="Thane"
              rating={5}
              text="Amazing service! The AI-powered booking was seamless and the technicians were very professional."
              vehicle="Hyundai Creta"
            />
          </div>
        </div>
      </section>

      {/* 8. Frequently Asked Questions */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="text-center mb-10 sm:mb-12 md:mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">FAQ</span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-2 text-brand-secondary">Frequently Asked Questions</h2>
            <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4 px-4">
              Got questions? We've got answers
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            <FAQItem 
              question="How does AI-powered booking work?"
              answer="Simply chat with our AI assistant, provide your vehicle details, and get instant transparent pricing. Book your service directly without any employee interaction."
            />
            <FAQItem 
              question="Is the pricing really transparent?"
              answer="Yes! Our AI shows you exactly what you'll pay upfront. No hidden charges, no surprises. You see the complete breakdown before booking."
            />
            <FAQItem 
              question="How long does a typical service take?"
              answer="Service duration varies by type. Basic service takes 2-3 hours, premium service takes 4-5 hours, and comprehensive service takes 6-8 hours."
            />
            <FAQItem 
              question="Do you provide warranty on services?"
              answer="Yes, all our services come with warranty. Labour warranty is typically 1 month or 1,000 km, and parts warranty varies by component."
            />
            <FAQItem 
              question="Can I track my service in real-time?"
              answer="Absolutely! You'll receive real-time updates, photos, and live tracking throughout the service process via our AI-powered platform."
            />
            <FAQItem 
              question="What car brands do you service?"
              answer="We service all major car brands including Maruti Suzuki, Hyundai, Tata, Mahindra, Honda, Toyota, Ford, Volkswagen, BMW, Mercedes-Benz, Audi, and many more."
            />
          </div>
        </div>
      </section>



      {/* Floating Chatbot (Always Visible) */}
      <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50">
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 md:py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-2 sm:gap-3 group border-2 sm:border-4 border-white/20 animate-bounce-slow"
        >
          <Bot className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform flex-shrink-0" />
          <span className="font-semibold text-xs sm:text-sm md:text-base hidden sm:inline">Ask MY FNG AI</span>
          <span className="font-semibold text-xs sm:hidden">AI</span>
        </button>
      </div>

      {/* Chatbot Modal */}
      {isChatOpen && (
        <div className="fixed bottom-20 sm:bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
          <div className="bg-brand-primary p-3 sm:p-4 flex justify-between items-center gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <div className="bg-white/20 p-1 sm:p-1.5 rounded-lg flex-shrink-0">
                <Bot className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-bold text-xs sm:text-sm truncate">MY FNG AI Assistant</p>
                <p className="text-blue-100 text-[10px] sm:text-xs truncate">Online • Book service directly</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white text-xl sm:text-2xl flex-shrink-0">
              ×
            </button>
          </div>
          <div className="h-64 sm:h-72 md:h-80 bg-gray-50 p-3 sm:p-4 overflow-y-auto">
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700">
                Hi! 👋 I'm MY FNG AI Assistant. Book your car service directly with me - no employee needed! 
                <br/><br/>What service do you need today?
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 justify-end mb-3 sm:mb-4">
              <div className="bg-brand-primary p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tr-none shadow-sm text-xs sm:text-sm text-white max-w-[80%]">
                I need periodic service for my car
              </div>
            </div>
            <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4">
               <div className="w-7 h-7 sm:w-8 sm:h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-xs sm:text-sm text-gray-700">
                Perfect! I can help you book periodic service. <br/><br/>
                <strong>Transparent Pricing:</strong> Starting from ₹1,999 (varies by car model). 
                <br/><br/>Would you like me to check your car details and show exact pricing?
              </div>
            </div>
          </div>
          <div className="p-2.5 sm:p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-1.5 sm:gap-2">
              <input type="text" placeholder="Type your message..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:border-brand-primary" />
              <button className="bg-brand-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-brand-primary-hover flex-shrink-0">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />

      {/* Booking Form Modal */}
      {isBookingFormOpen && (
        <BookingForm onClose={() => setIsBookingFormOpen(false)} />
      )}

    </div>
  );
}

// --- Sub Components ---

function StepCard({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="bg-white p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group">
      <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-100 group-hover:text-brand-primary/10 transition-colors mb-3 sm:mb-4">{number}</div>
      <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary mb-2 sm:mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed text-xs sm:text-sm">{desc}</p>
    </div>
  );
}

function PricingCard({ title, price, save, time, features, isPremium, activeCar }: any) {
  return (
    <div className={`bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-xl border transition-all duration-300 ${
      isPremium ? 'border-brand-primary ring-2 sm:ring-4 ring-brand-primary/5 transform scale-[1.02] sm:scale-105 z-10' : 'border-gray-100 hover:border-brand-primary/30'
    }`}>
      <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg md:text-xl font-bold text-brand-secondary">{title}</h3>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">for {activeCar}</p>
        </div>
        {save && <span className="bg-green-100 text-green-700 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md flex-shrink-0">{save}</span>}
      </div>
      
      <div className="mb-4 sm:mb-5 md:mb-6">
        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-primary">{price}</span>
      </div>
      
      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 mb-4 sm:mb-5 md:mb-6 bg-gray-50 p-1.5 sm:p-2 rounded-lg">
        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" /> <span>{time}</span>
      </div>
      
      <ul className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-6 sm:mb-7 md:mb-8">
        {features.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
            <div className="mt-0.5 bg-brand-primary/10 p-0.5 rounded-full flex-shrink-0">
              <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-brand-primary" />
            </div>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      
      <button className={`w-full py-2.5 sm:py-2.5 md:py-3 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base transition ${
        isPremium ? 'bg-brand-primary text-white hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/30' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
      }`}>
        Book Now
      </button>
    </div>
  );
}

function TimelineItem({ time, title, desc, status }: any) {
  const getIcon = () => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-white" />;
    if (status === 'active') return <Activity className="w-4 h-4 text-white" />;
    return <Clock className="w-4 h-4 text-gray-500" />;
  };
  
  const getBg = () => {
    if (status === 'completed') return 'bg-green-500';
    if (status === 'active') return 'bg-brand-fng animate-pulse';
    return 'bg-gray-700';
  };

  return (
    <div className="relative group">
      <div className={`absolute -left-[41px] top-1 w-8 h-8 rounded-full border-4 border-gray-900 flex items-center justify-center z-10 ${getBg()}`}>
        {getIcon()}
      </div>
      <div className={`mb-1 ${status === 'active' ? 'text-brand-fng font-bold' : 'text-gray-400 font-medium'} text-sm`}>{time}</div>
      <h4 className={`text-lg font-bold mb-1 ${status === 'pending' ? 'text-gray-500' : 'text-white'}`}>{title}</h4>
      <p className="text-sm text-gray-400 pb-8">{desc}</p>
    </div>
  );
}

function LiveUpdateCard({ title, status, desc, color }: any) {
  const statusColors = {
    green: 'text-green-400 border-green-500/30 bg-green-500/10',
    yellow: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
    gray: 'text-gray-400 border-gray-500/30 bg-gray-500/10',
  };
  
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-white">{title}</h4>
        <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[color as keyof typeof statusColors]}`}>
          {status}
        </span>
      </div>
      <p className="text-xs text-gray-400">{desc}</p>
    </div>
  );
}

function WorkshopCard({ name, location, rating, services, image }: any) {
  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition group">
      <div className="h-36 sm:h-40 md:h-48 rounded-lg sm:rounded-xl overflow-hidden relative mb-3 sm:mb-4">
        <Image src={image} alt={name} fill className="object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-white/90 backdrop-blur px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[10px] sm:text-xs font-bold flex items-center gap-0.5 sm:gap-1">
          <Shield className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-600 flex-shrink-0" /> <span className="hidden sm:inline">AI Verified</span><span className="sm:hidden">AI</span>
        </div>
      </div>
      <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-2">
        <div className="min-w-0 flex-1">
           <h3 className="font-bold text-base sm:text-lg text-brand-secondary truncate">{name}</h3>
           <p className="text-xs sm:text-sm text-gray-500 truncate">{location}</p>
        </div>
        <div className="bg-green-50 text-green-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg font-bold text-xs sm:text-sm flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {rating} <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
        </div>
      </div>
      <div className="text-[10px] sm:text-xs text-gray-400 mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-gray-100">
        {services} • Certified Partner
      </div>
    </div>
  );
}

function StatBox({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-brand-primary mb-1 sm:mb-2">{number}</div>
      <div className="text-gray-500 font-medium text-xs sm:text-sm">{label}</div>
    </div>
  );
}

function RSAService({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 p-4 rounded-xl backdrop-blur-sm hover:bg-white/20 transition group">
      <div className="text-brand-fng bg-white/20 p-2 rounded-lg group-hover:bg-brand-fng group-hover:text-white transition">
        {icon}
      </div>
      <span className="font-semibold">{title}</span>
    </div>
  );
}

function ServiceTypeCard({ icon, title, desc, features, slug }: { icon: React.ReactNode; title: string; desc: string; features: string[]; slug?: string }) {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group">
      <div className="mb-4 sm:mb-5 md:mb-6 bg-brand-primary/10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg md:text-xl font-bold mb-1.5 sm:mb-2 text-brand-secondary">{title}</h3>
      <p className="text-gray-600 text-xs sm:text-sm mb-3 sm:mb-4">{desc}</p>
      <ul className="space-y-1.5 sm:space-y-2 mb-4">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-500">
            <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {slug && (
        <Link
          href={`/services/${slug}`}
          className="inline-flex items-center gap-1.5 sm:gap-2 text-brand-primary text-xs sm:text-sm font-semibold hover:gap-2 sm:hover:gap-3 transition"
        >
          Know More <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Link>
      )}
    </div>
  );
}

function WhyChooseCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group text-center">
      <div className="mb-3 sm:mb-4 bg-brand-primary/10 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg sm:rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors mx-auto">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-bold mb-1.5 sm:mb-2 text-brand-secondary">{title}</h3>
      <p className="text-gray-600 text-xs sm:text-sm">{desc}</p>
    </div>
  );
}

function BlogCard({ title, excerpt, date, image }: { title: string; excerpt: string; date: string; image: string }) {
  return (
    <Link href="/blog" className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition group">
      <div className="h-36 sm:h-40 md:h-48 relative overflow-hidden">
        <Image src={image} alt={title} fill className="object-cover group-hover:scale-105 transition duration-500" />
      </div>
      <div className="p-4 sm:p-5 md:p-6">
        <p className="text-[10px] sm:text-xs text-gray-500 mb-1.5 sm:mb-2">{date}</p>
        <h3 className="text-base sm:text-lg font-bold text-brand-secondary mb-1.5 sm:mb-2 group-hover:text-brand-primary transition line-clamp-2">{title}</h3>
        <p className="text-gray-600 text-xs sm:text-sm line-clamp-2">{excerpt}</p>
        <div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-brand-primary text-xs sm:text-sm font-semibold">
          Read More <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
        </div>
      </div>
    </Link>
  );
}

function TestimonialCard({ name, location, rating, text, vehicle }: { name: string; location: string; rating: number; text: string; vehicle: string }) {
  return (
    <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center gap-0.5 sm:gap-1 mb-3 sm:mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <Quote className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-brand-primary/20 mb-3 sm:mb-4" />
      <p className="text-gray-700 mb-4 sm:mb-5 md:mb-6 italic text-xs sm:text-sm md:text-base">{text}</p>
      <div className="border-t border-gray-100 pt-3 sm:pt-4">
        <p className="font-bold text-sm sm:text-base text-gray-900">{name}</p>
        <p className="text-xs sm:text-sm text-gray-500">{location} • {vehicle}</p>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 md:p-6 flex items-center justify-between text-left hover:bg-gray-50 transition gap-2 sm:gap-4"
      >
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
          <HelpCircle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-brand-primary flex-shrink-0" />
          <span className="font-bold text-sm sm:text-base text-gray-900">{question}</span>
        </div>
        <ChevronRight className={`w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 pt-0 border-t border-gray-100">
          <p className="text-gray-600 mt-3 sm:mt-4 text-xs sm:text-sm md:text-base">{answer}</p>
        </div>
      )}
    </div>
  );
}
