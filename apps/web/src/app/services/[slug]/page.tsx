'use client';

import { useEffect, useState } from 'react';
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
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';

const services = [
  {
    id: 1,
    slug: 'periodic-service',
    title: 'Car Periodic Service',
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
    title: 'Car Engine Service',
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
    title: 'Car AC Service',
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
    title: 'Car Battery Service',
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

export default function ServiceDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const service = services.find(s => s.slug === slug);
  const IconComponent = service?.icon;

  if (!service) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Service Not Found</h1>
            <p className="text-gray-600 mb-6">The service you're looking for doesn't exist.</p>
            <Link href="/services" className="btn btn-primary">
              View All Services
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-800 text-white py-12 sm:py-16 md:py-20 mt-16 sm:mt-18 md:mt-20">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 text-gray-200 hover:text-white mb-4 sm:mb-5 md:mb-6 transition text-sm sm:text-base"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to All Services
            </Link>
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
              {IconComponent && (
                <div className="bg-white/10 backdrop-blur-sm p-3 sm:p-4 rounded-xl">
                  <IconComponent className="w-8 h-8 sm:w-10 sm:h-10" />
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">{service.title}</h1>
            </div>
            <p className="text-base sm:text-lg md:text-xl text-gray-200 max-w-2xl">
              {service.longDescription}
            </p>
          </div>
        </div>
      </section>

      {/* Service Details */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 md:gap-12">
              {/* Content */}
              <div>
                {/* Service Info */}
                <div className="flex flex-wrap gap-4 sm:gap-6 mb-6 sm:mb-7 md:mb-8">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Activity className="w-5 h-5 text-brand-primary" />
                    <span className="font-semibold">{service.duration}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Shield className="w-5 h-5 text-brand-primary" />
                    <span className="font-semibold">{service.warranty}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="mb-6 sm:mb-7 md:mb-8">
                  <h3 className="text-lg sm:text-xl font-bold text-brand-secondary mb-3 sm:mb-4">What's Included:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {service.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-xs sm:text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Benefits */}
                <div className="mb-6 sm:mb-7 md:mb-8">
                  <h3 className="text-lg sm:text-xl font-bold text-brand-secondary mb-3 sm:mb-4">Benefits:</h3>
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {service.benefits.map((benefit, idx) => (
                      <span
                        key={idx}
                        className="bg-green-50 text-green-700 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold"
                      >
                        {benefit}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CTA Button */}
                <Link
                  href="/book-service"
                  className="btn btn-primary inline-flex items-center gap-2 text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4"
                >
                  Book {service.title}
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              </div>

              {/* Image */}
              <div>
                <div className="relative h-[300px] sm:h-[400px] md:h-[500px] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-brand-primary to-brand-secondary text-white">
        <div className="container mx-auto px-3 sm:px-4 md:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Ready to Book {service.title}?</h2>
          <p className="text-base sm:text-lg md:text-xl text-blue-100 mb-6 sm:mb-7 md:mb-8 max-w-2xl mx-auto px-4">
            Get transparent pricing, expert service, and AI-powered booking. Book now and experience the MyFNG difference.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4">
            <Link href="/book-service" className="btn btn-white text-sm sm:text-base md:text-lg px-6 sm:px-7 md:px-8 py-2.5 sm:py-3 md:py-4">
              Book Service Now
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
            </Link>
            <Link href="/contact" className="btn btn-outline-white text-sm sm:text-base md:text-lg px-6 sm:px-7 md:px-8 py-2.5 sm:py-3 md:py-4">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
