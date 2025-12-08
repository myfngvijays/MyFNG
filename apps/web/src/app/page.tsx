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

      {/* 1. Hero Section: AI-Powered & Futuristic */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 animate-gradient" style={{backgroundSize: '200% 200%'}}></div>
        
        {/* Floating Orbs */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-blue-500/30 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-float" style={{animationDelay: '2s'}}></div>
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            {/* Left Content */}
            <div className="lg:w-1/2 text-center lg:text-left">
              {/* AI Badge */}
              <div className="mb-6 flex justify-center lg:justify-start">
                <AIFeatureBadge text="Powered by Advanced AI Technology" />
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight animate-fade-in-up text-white">
                India's First <br />
                <span className="relative inline-block">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 neon-text">
                    AI-Powered
                  </span>
                </span> <br />
                Car Service 🚗⚡
              </h1>
              
              <p className="text-lg text-gray-200 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                Experience the future of car care with our <span className="text-white font-semibold">AI-powered diagnostics</span> and instant service booking. 
                No waiting, no hassle - just smart car care.
              </p>

              {/* Key Features */}
              <div className="grid grid-cols-2 gap-3 mb-8 animate-fade-in-up" style={{animationDelay: '0.3s'}}>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>AI Diagnostics</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span>100% Transparent</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>24/7 Available</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <span>Live Tracking</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up" style={{animationDelay: '0.4s'}}>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="group btn bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-lg px-8 py-4 rounded-xl shadow-lg shadow-blue-500/50 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/60 ai-glow"
                >
                  <Bot className="w-5 h-5 group-hover:animate-bounce" />
                  Talk to AI Assistant
                </button>
                <button 
                  onClick={() => setIsBookingFormOpen(true)}
                  className="btn glass hover:bg-white/20 border border-white/20 text-white text-lg px-8 py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1"
                >
                  <Car className="w-5 h-5" />
                  Quick Book
                </button>
                <Link
                  href="/book-service"
                  className="btn glass hover:bg-white/20 border border-white/20 text-white text-lg px-8 py-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1"
                >
                  <Calendar className="w-5 h-5" />
                  Traditional Booking
                </Link>
              </div>

              {/* Live Indicator - Dynamic FOMO */}
              <DynamicFOMO />
            </div>

            {/* Right Visual: AI Dashboard Card */}
            <div className="lg:w-1/2 relative animate-fade-in-up" style={{animationDelay: '0.6s'}}>
              <div className="relative">
                {/* Main Image */}
                <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl ai-glow">
                  <img 
                    src="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=1000" 
                    alt="Futuristic Car" 
                    className="w-full object-cover h-[500px]"
                  />
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60"></div>
                </div>
                
                {/* AI Analysis Card - Floating */}
                <div className="absolute -bottom-6 -left-6 glass p-6 rounded-2xl shadow-2xl max-w-xs w-full animate-float border border-white/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">AI Analysis</h3>
                      <p className="text-xs text-gray-400">Diagnostic Report</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Engine Health</span>
                      <span className="text-green-400 font-semibold">98%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full animate-progress" style={{width: '98%'}}></div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Service Due</span>
                      <span className="text-orange-400 font-semibold">500 km</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-orange-400 to-orange-500 h-2 rounded-full animate-progress" style={{width: '65%'}}></div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats - Top Right */}
                <div className="absolute -top-6 -right-6 glass p-4 rounded-xl shadow-xl animate-bounce-in border border-white/20">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">12 min</div>
                    <div className="text-xs text-gray-400">Avg Response</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="mt-16 animate-fade-in-up" style={{animationDelay: '0.8s'}}>
            <TrustBadges />
          </div>
        </div>
      </section>

      {/* Live Stats Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <AIFeatureBadge text="Real-Time Analytics" />
            <h2 className="text-4xl font-bold mt-4 mb-4 text-brand-secondary">Trusted by Thousands</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Join India's fastest-growing AI-powered car service platform
            </p>
          </div>
          <LiveStats />
        </div>
      </section>

      {/* 2. Our Services */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Our Services</span>
            <h2 className="text-4xl font-bold mt-2 mb-4 text-brand-secondary">Complete Car Care Solutions</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From periodic maintenance to complex repairs - our AI chatbot recommends the perfect service for your car. 
              <span className="font-semibold text-brand-secondary">100% transparent pricing</span> with no hidden charges.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ServiceTypeCard 
              icon={<Activity className="w-8 h-8" />}
              title="Periodic Service"
              desc="AI-powered scheduled maintenance with digital health reports"
              features={['Oil Change', 'Filter Replacement', 'Fluid Top-up', 'AI Health Report']}
            />
            <ServiceTypeCard 
              icon={<Zap className="w-8 h-8" />}
              title="Engine Service"
              desc="Complete engine diagnostics powered by AI"
              features={['Engine Diagnostics', 'Oil Service', 'Filter Change', 'Performance Check']}
            />
            <ServiceTypeCard 
              icon={<Shield className="w-8 h-8" />}
              title="AC Service"
              desc="Complete climate control solutions"
              features={['AC Cleaning', 'Gas Refill', 'Filter Change', 'Sanitization']}
            />
            <ServiceTypeCard 
              icon={<Zap className="w-8 h-8" />}
              title="Battery Service"
              desc="AI-powered battery health analysis"
              features={['Battery Check', 'Charging Test', 'Replacement', 'Warranty']}
            />
            <ServiceTypeCard 
              icon={<Shield className="w-8 h-8" />}
              title="Brake Service"
              desc="Complete brake system inspection"
              features={['Brake Pad Check', 'Fluid Replacement', 'Disc Inspection', 'Safety Test']}
            />
            <ServiceTypeCard 
              icon={<Car className="w-8 h-8" />}
              title="Tyre & Wheel Care"
              desc="Professional tyre and wheel services"
              features={['Tyre Rotation', 'Wheel Alignment', 'Balancing', 'Replacement']}
            />
            <ServiceTypeCard 
              icon={<Activity className="w-8 h-8" />}
              title="Detailing Service"
              desc="Premium car detailing and protection"
              features={['Interior Cleaning', 'Exterior Polish', 'Waxing', 'Ceramic Coating']}
            />
            <ServiceTypeCard 
              icon={<Car className="w-8 h-8" />}
              title="Denting & Painting"
              desc="High-precision body work"
              features={['Dent Removal', 'Color Matching', 'Paint Protection', 'Quality Check']}
            />
          </div>

          <div className="text-center mt-12">
            <Link href="/services" className="btn btn-primary text-lg px-10 py-4 rounded-xl inline-flex items-center gap-2">
              Explore All Services <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Brands We Serve - Horizontal Scrolling */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Brands We Serve</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">We Service All Major Car Brands</h2>
            <p className="text-gray-600 mt-4">
              From Maruti to Mercedes, we've got you covered
            </p>
          </div>

          <div className="relative overflow-hidden py-4">
            {brandsLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              </div>
            ) : brandLogos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Car className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No brands available. Please add brands from admin panel.</p>
              </div>
            ) : (
              <div className="flex gap-6 animate-scroll-horizontal">
                {/* Brand logos with images */}
                {brandLogos.map((brand, idx) => (
                  <div key={`brand-1-${idx}`} className="flex items-center justify-center min-w-[140px] h-28 bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-5 border border-gray-100 flex-shrink-0 group relative">
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
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">How It Works</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">Hassle-Free Car Maintenance with MY FNG AI</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Experience the future of car servicing. Our AI chatbot books your service directly - no employee needed. 
              Complete transparency in pricing and real-time tracking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number="01" 
              title="Chat with MY FNG AI" 
              desc="Simply chat with our AI assistant - no employee interaction needed. Our AI understands your car model, service history, and recommends the perfect service package."
            />
            <StepCard 
              number="02" 
              title="Transparent AI Pricing" 
              desc="Get instant, transparent pricing based on your car model and location. No hidden charges - our AI ensures complete pricing transparency."
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
      <section className="py-20 bg-gradient-to-br from-brand-primary/5 to-brand-secondary/5">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Why Choose Us</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">Why Choose MY FNG?</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Experience the difference with our AI-powered platform and premium service quality
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
      <section className="relative py-24 overflow-hidden">
        {/* Dramatic Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-orange-950 to-red-900"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
        
        {/* Animated Elements */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Emergency Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-3 glass px-6 py-3 rounded-full border border-red-500/30 animate-pulse-glow">
                <div className="relative flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="absolute w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                </div>
                <span className="text-white font-bold text-sm">24/7 EMERGENCY SUPPORT</span>
              </div>
            </div>

            <h2 className="text-5xl lg:text-6xl font-bold text-center text-white mb-6 animate-fade-in-up">
              Stuck on the Road? <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-400">
                We're Just a Tap Away!
              </span>
            </h2>

            <p className="text-xl text-gray-300 text-center mb-12 max-w-3xl mx-auto animate-fade-in-up" style={{animationDelay: '0.2s'}}>
              Car breakdown? Flat tire? Battery dead? Our AI-powered roadside assistance reaches you in <span className="text-white font-bold">under 30 minutes</span>. 
              Available 24/7 across India.
            </p>

            {/* RSA Services Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
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
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Latest Updates</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">From Our Blogs</h2>
            <p className="text-gray-600 mt-4">
              Stay updated with car maintenance tips, industry news, and expert advice
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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

          <div className="text-center mt-12">
            <Link href="/blog" className="btn btn-outline text-lg px-10 py-4 rounded-xl">
              Read All Blogs <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* 7. What People Say - Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Testimonials</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">What People Say About Us</h2>
            <p className="text-gray-600 mt-4">
              Real feedback from our satisfied customers
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">FAQ</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">Frequently Asked Questions</h2>
            <p className="text-gray-600 mt-4">
              Got questions? We've got answers
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
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
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white px-6 py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3 group border-4 border-white/20 animate-bounce-slow"
        >
          <Bot className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="font-semibold">Ask MY FNG AI</span>
        </button>
      </div>

      {/* Chatbot Modal */}
      {isChatOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in-up">
          <div className="bg-brand-primary p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">MY FNG AI Assistant</p>
                <p className="text-blue-100 text-xs">Online • Book service directly • No employee needed</p>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white">
              ×
            </button>
          </div>
          <div className="h-80 bg-gray-50 p-4 overflow-y-auto">
            <div className="flex gap-2 mb-4">
              <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-700">
                Hi! 👋 I'm MY FNG AI Assistant. Book your car service directly with me - no employee needed! 
                <br/><br/>What service do you need today?
              </div>
            </div>
            <div className="flex gap-2 justify-end mb-4">
              <div className="bg-brand-primary p-3 rounded-2xl rounded-tr-none shadow-sm text-sm text-white">
                I need periodic service for my car
              </div>
            </div>
            <div className="flex gap-2 mb-4">
               <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-brand-primary" />
              </div>
              <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 text-sm text-gray-700">
                Perfect! I can help you book periodic service. <br/><br/>
                <strong>Transparent Pricing:</strong> Starting from ₹1,999 (varies by car model). 
                <br/><br/>Would you like me to check your car details and show exact pricing?
              </div>
            </div>
          </div>
          <div className="p-3 border-t border-gray-100 bg-white">
            <div className="flex gap-2">
              <input type="text" placeholder="Type your message..." className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-primary" />
              <button className="bg-brand-primary text-white p-2 rounded-full hover:bg-brand-primary-hover">
                <ArrowRight className="w-4 h-4" />
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
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group">
      <div className="text-5xl font-bold text-gray-100 group-hover:text-brand-primary/10 transition-colors mb-4">{number}</div>
      <h3 className="text-xl font-bold text-brand-secondary mb-3">{title}</h3>
      <p className="text-gray-600 leading-relaxed text-sm">{desc}</p>
    </div>
  );
}

function PricingCard({ title, price, save, time, features, isPremium, activeCar }: any) {
  return (
    <div className={`bg-white p-8 rounded-3xl shadow-xl border transition-all duration-300 ${
      isPremium ? 'border-brand-primary ring-4 ring-brand-primary/5 transform scale-105 z-10' : 'border-gray-100 hover:border-brand-primary/30'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-brand-secondary">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">for {activeCar}</p>
        </div>
        {save && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">{save}</span>}
      </div>
      
      <div className="mb-6">
        <span className="text-4xl font-bold text-brand-primary">{price}</span>
      </div>
      
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 bg-gray-50 p-2 rounded-lg">
        <Clock className="w-4 h-4" /> {time}
      </div>
      
      <ul className="space-y-3 mb-8">
        {features.map((item: string, i: number) => (
          <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
            <div className="mt-0.5 bg-brand-primary/10 p-0.5 rounded-full">
              <CheckCircle className="w-3 h-3 text-brand-primary" />
            </div>
            {item}
          </li>
        ))}
      </ul>
      
      <button className={`w-full py-3 rounded-xl font-bold transition ${
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
    <div className="bg-white p-4 rounded-2xl shadow-md hover:shadow-xl transition group">
      <div className="h-48 rounded-xl overflow-hidden relative mb-4">
        <Image src={image} alt={name} fill className="object-cover group-hover:scale-105 transition duration-500" />
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
          <Shield className="w-3 h-3 text-green-600" /> AI Verified
        </div>
      </div>
      <div className="flex justify-between items-start mb-2">
        <div>
           <h3 className="font-bold text-lg text-brand-secondary">{name}</h3>
           <p className="text-sm text-gray-500">{location}</p>
        </div>
        <div className="bg-green-50 text-green-700 px-2 py-1 rounded-lg font-bold text-sm flex items-center gap-1">
          {rating} <Star className="w-3 h-3 fill-current" />
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
        {services} • Certified Partner
      </div>
    </div>
  );
}

function StatBox({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-4xl font-bold text-brand-primary mb-2">{number}</div>
      <div className="text-gray-500 font-medium text-sm">{label}</div>
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

function ServiceTypeCard({ icon, title, desc, features }: { icon: React.ReactNode; title: string; desc: string; features: string[] }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group">
      <div className="mb-6 bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-brand-secondary">{title}</h3>
      <p className="text-gray-600 text-sm mb-4">{desc}</p>
      <ul className="space-y-2">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-green-500" />
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WhyChooseCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:border-brand-primary/30 transition group text-center">
      <div className="mb-4 bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors mx-auto">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 text-brand-secondary">{title}</h3>
      <p className="text-gray-600 text-sm">{desc}</p>
    </div>
  );
}

function BlogCard({ title, excerpt, date, image }: { title: string; excerpt: string; date: string; image: string }) {
  return (
    <Link href="/blog" className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition group">
      <div className="h-48 relative overflow-hidden">
        <Image src={image} alt={title} fill className="object-cover group-hover:scale-105 transition duration-500" />
      </div>
      <div className="p-6">
        <p className="text-xs text-gray-500 mb-2">{date}</p>
        <h3 className="text-lg font-bold text-brand-secondary mb-2 group-hover:text-brand-primary transition">{title}</h3>
        <p className="text-gray-600 text-sm">{excerpt}</p>
        <div className="mt-4 flex items-center gap-2 text-brand-primary text-sm font-semibold">
          Read More <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}

function TestimonialCard({ name, location, rating, text, vehicle }: { name: string; location: string; rating: number; text: string; vehicle: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center gap-1 mb-4">
        {Array.from({ length: rating }).map((_, i) => (
          <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
        ))}
      </div>
      <Quote className="w-8 h-8 text-brand-primary/20 mb-4" />
      <p className="text-gray-700 mb-6 italic">{text}</p>
      <div className="border-t border-gray-100 pt-4">
        <p className="font-bold text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">{location} • {vehicle}</p>
      </div>
    </div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 flex items-center justify-between text-left hover:bg-gray-50 transition"
      >
        <div className="flex items-center gap-4 flex-1">
          <HelpCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
          <span className="font-bold text-gray-900">{question}</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 pb-6 pt-0 border-t border-gray-100">
          <p className="text-gray-600 mt-4">{answer}</p>
        </div>
      )}
    </div>
  );
}
