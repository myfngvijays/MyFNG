'use client';

import { useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { 
  Activity, 
  Zap, 
  Shield, 
  Car, 
  CheckCircle, 
  ArrowRight,
  Wrench,
  Battery,
  Droplets,
  Gauge,
  Sparkles,
  Clock,
  ShieldCheck,
  IndianRupee
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const services = [
  {
    id: 1,
    slug: 'periodic-service',
    title: 'Periodic Service',
    bookPrefill: { category: 'PERIODIC SERVICE', query: 'BASIC' },
    icon: Activity,
    description: 'AI-powered scheduled maintenance with digital health reports. Keep your car running smoothly with manufacturer-recommended service packages.',
    longDescription: 'Our Periodic Service ensures your vehicle receives comprehensive maintenance at regular intervals. Using AI-powered diagnostics, we provide detailed health reports and preventive care to extend your car\'s lifespan.',
    features: [
      'Engine Oil Replacement (Shell/Castrol Premium)',
      'Oil Filter & Air Filter Replacement',
      'Brake, Coolant & Fluid Top-up',
      '40-Point Comprehensive Inspection',
      'Battery Health Check',
      'Tire Pressure & Condition Check',
      'Digital Health Report with AI Analysis',
      'Warranty on All Parts & Labor'
    ],
    benefits: [
      'Improved fuel efficiency',
      'Extended engine life',
      'Preventive maintenance',
      'AI-powered diagnostics'
    ],
    image: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=1200',
    duration: '2-3 hours',
    warranty: '6 months / 5,000 km'
  },
  {
    id: 2,
    slug: 'engine-service',
    title: 'Engine Service',
    bookPrefill: { category: 'ENGINE SERVICE', query: 'ENGINE' },
    icon: Zap,
    description: 'Complete engine diagnostics powered by AI. Comprehensive engine care to keep your car\'s heart running perfectly.',
    longDescription: 'Our Engine Service provides thorough diagnostics and maintenance for your vehicle\'s engine. Using advanced AI technology, we identify potential issues before they become costly problems.',
    features: [
      'Complete Engine Diagnostics',
      'Engine Oil Service & Replacement',
      'Oil Filter & Air Filter Change',
      'Performance Check & Tuning',
      'Spark Plug Inspection & Replacement',
      'Timing Belt Check',
      'Cooling System Inspection',
      'Exhaust System Check'
    ],
    benefits: [
      'Optimal engine performance',
      'Early problem detection',
      'Reduced breakdowns',
      'Better fuel economy'
    ],
    image: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=1200',
    duration: '3-4 hours',
    warranty: '6 months / 5,000 km'
  },
  {
    id: 3,
    slug: 'ac-service',
    title: 'AC Service',
    bookPrefill: { category: 'AC SERVICE', query: 'AC' },
    icon: Shield,
    description: 'Complete climate control solutions. Keep your cabin cool and fresh with professional AC maintenance.',
    longDescription: 'Professional AC service ensures optimal cooling performance and air quality. We provide comprehensive AC system maintenance, gas refilling, and cleaning services.',
    features: [
      'AC Gas Top-up / Replacement',
      'Cooling Coil & Condenser Cleaning',
      'AC Filter Replacement',
      'Vents Cleaning & Sanitization',
      'Leakage Testing & Repair',
      'AC Performance Testing',
      'Bacterial & Odor Removal',
      'Complete System Sanitization'
    ],
    benefits: [
      'Better cooling performance',
      'Improved air quality',
      'Reduced energy consumption',
      'Fresh cabin environment'
    ],
    image: 'https://images.unsplash.com/photo-1527247043581-9a9099575e8b?auto=format&fit=crop&q=80&w=1200',
    duration: '2-3 hours',
    warranty: '6 months'
  },
  {
    id: 4,
    slug: 'battery-service',
    title: 'Battery Service',
    bookPrefill: { category: 'BATTERY SERVICE', query: 'BATTERY' },
    icon: Battery,
    description: 'AI-powered battery health analysis. Ensure reliable starts and optimal electrical system performance.',
    longDescription: 'Comprehensive battery service includes health analysis, charging system check, and replacement if needed. Our AI-powered diagnostics predict battery life and prevent unexpected failures.',
    features: [
      'Battery Health Check & Analysis',
      'Charging System Testing',
      'Battery Terminal Cleaning',
      'Voltage & Load Testing',
      'Battery Replacement (if needed)',
      'Alternator & Starter Check',
      'Warranty on New Batteries',
      'Free Installation'
    ],
    benefits: [
      'Reliable vehicle starts',
      'Preventive replacement',
      'Extended battery life',
      'Peace of mind'
    ],
    image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=1200',
    duration: '1-2 hours',
    warranty: '18-24 months'
  },
  {
    id: 5,
    slug: 'brake-service',
    title: 'Brake Service',
    bookPrefill: { category: 'BRAKE SERVICE', query: 'BRAKE' },
    icon: Shield,
    description: 'Complete brake system inspection. Ensure your safety with professional brake maintenance.',
    longDescription: 'Comprehensive brake service ensures your vehicle\'s stopping power and safety. We inspect, repair, and replace brake components to maintain optimal braking performance.',
    features: [
      'Brake Pad Check & Replacement',
      'Brake Fluid Replacement',
      'Disc & Drum Inspection',
      'Brake System Safety Test',
      'ABS System Check',
      'Parking Brake Adjustment',
      'Brake Line Inspection',
      'Complete System Bleeding'
    ],
    benefits: [
      'Enhanced safety',
      'Optimal stopping power',
      'Reduced brake noise',
      'Longer component life'
    ],
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80&w=1200',
    duration: '2-3 hours',
    warranty: '6 months / 10,000 km'
  },
  {
    id: 6,
    slug: 'clutch-service',
    title: 'Clutch Service',
    bookPrefill: { category: 'CLUTCH SERVICE', query: 'CLUTCH' },
    icon: Wrench,
    description: 'Smooth gear shifts and reliable pickup. Diagnose and fix clutch wear with transparent estimates.',
    longDescription:
      'Our Clutch Service includes inspection, wear diagnosis, and replacement (if required) using quality parts. We ensure smooth shifting, reduced vibration, and improved drivability with proper calibration and testing.',
    features: [
      'Clutch System Inspection',
      'Clutch Plate & Pressure Plate Check',
      'Release Bearing Inspection',
      'Hydraulic / Cable Check',
      'Test Drive & Shift Calibration',
      'Replacement with Quality Parts (if needed)',
      'Transparent Estimate Before Work',
      'Warranty on Parts & Labor'
    ],
    benefits: [
      'Smoother gear shifts',
      'Better drivability',
      'Reduced vibration/noise',
      'Prevents breakdowns'
    ],
    image: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6f8?auto=format&fit=crop&q=80&w=1200',
    duration: '3-6 hours',
    warranty: '3 months / 3,000 km'
  },
  {
    id: 7,
    slug: 'tyre-wheel-care',
    title: 'Tyre & Wheel Care',
    bookPrefill: { category: 'TYRE & WHEEL CARE', query: 'TYRE' },
    icon: Car,
    description: 'Professional tyre and wheel services. Maintain optimal grip, handling, and safety.',
    longDescription: 'Complete tyre and wheel care services including rotation, alignment, balancing, and replacement. We ensure your vehicle maintains optimal road contact and handling.',
    features: [
      'Tyre Rotation & Balancing',
      'Wheel Alignment (4-Wheel)',
      'Tyre Pressure Check & Adjustment',
      'Tread Depth Measurement',
      'Tyre Replacement (if needed)',
      'Wheel Balancing',
      'TPMS Sensor Check',
      'Road Hazard Inspection'
    ],
    benefits: [
      'Better fuel efficiency',
      'Extended tyre life',
      'Improved handling',
      'Enhanced safety'
    ],
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=1200',
    duration: '1-2 hours',
    warranty: '6 months'
  },
  {
    id: 8,
    slug: 'detailing-service',
    title: 'Detailing Service',
    bookPrefill: { category: 'DETAILING SERVICE', query: 'DETAIL' },
    icon: Sparkles,
    description: 'Premium car detailing and protection. Restore your car\'s showroom shine.',
    longDescription: 'Premium detailing service that goes beyond a regular wash. We provide comprehensive interior and exterior cleaning, polishing, and protection services.',
    features: [
      'Interior Deep Cleaning',
      'Exterior Polish & Waxing',
      'Ceramic Coating Application',
      'Dashboard & Upholstery Cleaning',
      'Engine Bay Cleaning',
      'Headlight Restoration',
      'Paint Protection Film',
      'Leather Conditioning'
    ],
    benefits: [
      'Showroom finish',
      'Paint protection',
      'Increased resale value',
      'Long-lasting shine'
    ],
    image: 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&q=80&w=1200',
    duration: '4-6 hours',
    warranty: '3-6 months'
  },
  {
    id: 9,
    slug: 'denting-painting',
    title: 'Denting & Painting',
    bookPrefill: { category: 'DENTING PAINTING', query: 'PAINT' },
    icon: Car,
    description: 'High-precision body work. Restore your car\'s appearance with professional denting and painting.',
    longDescription: 'Professional body work services including dent removal, color matching, and painting. We use premium paints and advanced techniques for a flawless finish.',
    features: [
      'Dent Removal & Repair',
      'Color Matching Technology',
      '4-Layer Painting Process',
      'Panel Rubbing & Polishing',
      'Primer & Paint Application',
      'Paint Protection',
      'Quality Check & Inspection',
      '2-Year Paint Warranty'
    ],
    benefits: [
      'Flawless finish',
      'Color match guarantee',
      'Long-lasting paint',
      'Increased resale value'
    ],
    image: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=1200',
    duration: '2-5 days',
    warranty: '2 years'
  }
];

export default function ServicesPage() {
  const [selectedService, setSelectedService] = useState(services[0]);
  const popularServices = ['AC Service', 'Battery Service', 'Brake Service', 'Engine Service', 'Periodic Service'];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Full-Bleed Service Explorer Section */}
      <section className="relative min-h-[85vh] mt-16 overflow-hidden bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
        {/* Background Illustration/Pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-100/20 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200/10 rounded-full blur-3xl"></div>
          <div className="absolute top-20 right-20 w-72 h-72 bg-blue-200/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 h-full">
          {/* Header */}
          <div className="container mx-auto px-4 sm:px-6 pt-12 pb-8">
            <div className="max-w-7xl mx-auto">
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-3">OUR SERVICES</p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4">
                Explore services by <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">category</span>
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mb-8">
                Swipe to browse. Tap a service to preview pricing, timing, and what you get — all upfront.
              </p>
              
              <div className="flex flex-wrap gap-3 mb-8">
                <Link
                  href="#services"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25"
                >
                  Explore All Services
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <button className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-400 transition-all">
                  <Sparkles className="w-5 h-5" />
                  Ask AI
                </button>
              </div>
            </div>
          </div>

          {/* Main Service Explorer - Split View */}
          <div id="services" className="container mx-auto px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid lg:grid-cols-12 gap-6 lg:gap-8">
                
                {/* Left: Sticky Service List */}
                <div className="lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100 p-6 max-h-[70vh] overflow-y-auto">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Browse all services</h2>
                    <p className="text-sm text-gray-500 mb-6">Auto-scrolling • hover to pause</p>
                    
                    <div className="space-y-3">
                      {services.map((service) => {
                        const IconComponent = service.icon;
                        const isSelected = selectedService.id === service.id;
                        
                        return (
                          <button
                            key={service.id}
                            onClick={() => setSelectedService(service)}
                            className={`w-full text-left p-4 rounded-xl transition-all ${
                              isSelected 
                                ? 'bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 shadow-md' 
                                : 'bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
                            }`}
                          >
                            <div className="flex items-start gap-4">
                              <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                                isSelected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
                              } transition-all`}>
                                <IconComponent className="w-6 h-6" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <h3 className={`font-semibold mb-1 ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                  {service.title}
                                </h3>
                                <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                                  {service.description}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <IndianRupee className="w-3 h-3" />
                                    {service.duration.replace(' hours', 'h').replace(' hour', 'h')}
                                  </span>
                                  <span>•</span>
                                  <span>{service.duration}</span>
                                </div>
                              </div>
                              
                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <CheckCircle className="w-5 h-5 text-blue-600" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right: Large Preview Card */}
                <div className="lg:col-span-7">
                  <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                    {/* Featured Badge */}
                    <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-white" />
                        <span className="text-white font-semibold text-sm uppercase tracking-wide">Featured</span>
                      </div>
                      <span className="text-blue-100 text-sm font-medium">{selectedService.title}</span>
                    </div>

                    {/* Service Image */}
                    <div className="relative h-64 bg-gradient-to-br from-gray-100 to-gray-200">
                      <Image
                        src={selectedService.image}
                        alt={selectedService.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                      {/* Big Icon + Title */}
                      <div className="flex items-start gap-6 mb-6">
                        <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white shadow-xl">
                          {(() => {
                            const IconComponent = selectedService.icon;
                            return <IconComponent className="w-10 h-10" />;
                          })()}
                        </div>
                        
                        <div className="flex-1">
                          <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            {selectedService.title}
                          </h2>
                          <p className="text-lg text-gray-600">
                            {selectedService.longDescription}
                          </p>
                        </div>
                      </div>

                      {/* Micro Highlights */}
                      <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <IndianRupee className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Starting From</p>
                          <p className="text-xl font-bold text-gray-900">
                            {selectedService.duration.includes('days') ? '₹3,999+' : '₹' + selectedService.duration.split('-')[0].trim()}
                          </p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <Clock className="w-5 h-5 text-purple-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Avg. Time</p>
                          <p className="text-xl font-bold text-gray-900">{selectedService.duration}</p>
                        </div>
                        
                        <div className="text-center">
                          <div className="flex justify-center mb-2">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <ShieldCheck className="w-5 h-5 text-green-600" />
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 uppercase tracking-wide mb-1">Warranty</p>
                          <p className="text-xl font-bold text-gray-900">{selectedService.warranty}</p>
                        </div>
                      </div>

                      {/* What you get */}
                      <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <h3 className="text-lg font-bold text-gray-900">What you get</h3>
                        </div>
                        
                        <div className="grid sm:grid-cols-2 gap-3">
                          {selectedService.features.slice(0, 6).map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                              <span className="text-sm text-gray-700">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Link
                          href={`/book-service?prefill_category=${encodeURIComponent(selectedService.bookPrefill.category)}&prefill_query=${encodeURIComponent(selectedService.bookPrefill.query)}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-xl hover:scale-[1.02] transition-all"
                        >
                          Quick Book
                          <ArrowRight className="w-5 h-5" />
                        </Link>
                        
                        <Link
                          href={`/services/${selectedService.slug}`}
                          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-4 border-2 border-blue-600 text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-all"
                        >
                          Know More
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Quick Access Chips */}
              <div className="mt-12 mb-8">
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Popular Services</h3>
                    <span className="text-sm text-gray-500">Quick access</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    {popularServices.map((serviceName) => {
                      const service = services.find(s => s.title === serviceName);
                      if (!service) return null;
                      
                      return (
                        <button
                          key={service.id}
                          onClick={() => setSelectedService(service)}
                          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-full hover:border-blue-400 hover:shadow-md transition-all group"
                        >
                          {(() => {
                            const IconComponent = service.icon;
                            return <IconComponent className="w-4 h-4 text-blue-600 group-hover:scale-110 transition-transform" />;
                          })()}
                          <span className="font-medium text-gray-900">{serviceName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
