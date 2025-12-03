'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { 
  MessageSquare, 
  Zap, 
  CheckCircle, 
  Star, 
  ChevronRight, 
  Camera, 
  Bot, 
  ArrowRight, 
  Shield, 
  Clock, 
  MapPin, 
  Activity, 
  Car
} from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const [plateNumber, setPlateNumber] = useState('');
  const [activeCarType, setActiveCarType] = useState<'hatchback' | 'sedan' | 'suv'>('sedan');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Pricing Data based on Car Type
  const pricingData = {
    hatchback: { basic: '₹1,999', premium: '₹3,999', comprehensive: '₹6,999' },
    sedan: { basic: '₹2,499', premium: '₹4,999', comprehensive: '₹8,999' },
    suv: { basic: '₹3,499', premium: '₹6,499', comprehensive: '₹10,999' }
  };

  return (
    <div className="min-h-screen bg-white font-poppins text-text-body selection:bg-brand-primary/20">
      <Navbar />

      {/* 1. Hero Section: AI-Powered & Futuristic */}
      <section className="relative pt-32 pb-24 overflow-hidden bg-[#000510] text-white">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-primary/20 rounded-full blur-[100px] -mr-20 -mt-20 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/30 rounded-full blur-[100px] -ml-20 -mb-20"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            
            {/* Left Content */}
            <div className="lg:w-1/2 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-full text-brand-fng text-sm font-semibold mb-6 animate-fade-in-up">
                <Bot className="w-4 h-4" />
                Powered by Advanced AI Technology
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight animate-fade-in-up-delay-100">
                Book Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-fng to-cyan-400">
                  AI-Powered
                </span> <br />
                Car Service 🚗⚡
              </h1>
              
              <p className="text-lg text-gray-300 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up-delay-200">
                Get ready to experience hassle-free car maintenance with MY FNG. 
                Our AI chatbot understands your car better than you do - book services directly without any employee interaction. 
                <span className="text-white font-semibold">100% transparent pricing</span> powered by AI.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up-delay-300">
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="btn bg-brand-primary hover:bg-brand-primary-hover text-white text-lg px-8 py-4 rounded-xl shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1"
                >
                  <MessageSquare className="w-5 h-5" />
                  Book Service with AI
                </button>
                
                <div className="flex items-center bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-1 pr-2">
                  <div className="px-3 text-gray-400">
                    <Camera className="w-5 h-5" />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Scan Number Plate" 
                    className="bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 text-sm w-40 sm:w-48"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                  />
                  <button className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition">
                    <ArrowRight className="w-4 h-4 text-brand-fng" />
                  </button>
                </div>
              </div>

              <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-400 animate-fade-in-up-delay-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  AI Assistant Online
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-brand-fng" />
                  100% Transparent Pricing
                </div>
              </div>
            </div>

            {/* Right Visual: AI Analysis Card */}
            <div className="lg:w-1/2 relative animate-fade-in-up-delay-500">
              <div className="relative z-10">
                <img 
                  src="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=1000" 
                  alt="Futuristic Car" 
                  className="rounded-3xl shadow-2xl border border-white/10 w-full object-cover h-[500px]"
                />
                
                {/* Overlay: AI Car Analysis */}
                <div className="absolute -bottom-10 -left-10 bg-white/10 backdrop-blur-xl border border-white/20 p-6 rounded-2xl shadow-2xl max-w-xs w-full hidden md:block">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-brand-fng" /> AI Car Analysis
                    </h3>
                    <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">Live</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 mb-1">
                        <span>Engine Health</span>
                        <span className="text-white font-bold">85%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 w-[85%]"></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-xs text-gray-300 mb-1">
                        <span>Service Due</span>
                        <span className="text-white font-bold">60%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 w-[60%]"></div>
                      </div>
                    </div>

                    <div className="bg-brand-primary/20 rounded-lg p-3 flex items-center gap-3 mt-2">
                      <Clock className="w-8 h-8 text-brand-fng" />
                      <div>
                        <p className="text-xs text-gray-300">Next Service</p>
                        <p className="text-white font-bold">in 15 days</p>
                      </div>
                    </div>
                    
                    <button className="w-full py-2 text-xs font-bold text-brand-fng border border-brand-fng/30 rounded-lg hover:bg-brand-fng/10 transition">
                      View Full Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works */}
      <section className="py-20 bg-gray-50">
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

      {/* 3. AI-Powered Pricing */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">AI-Powered Pricing</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">Transparent Pricing - No Hidden Charges</h2>
            <p className="text-gray-600 mt-4">
              Our AI analyzes your car model and recommends the perfect service package. 
              <span className="font-semibold text-brand-secondary">100% transparent pricing</span> - see exactly what you pay for.
            </p>
            
            {/* Car Type Selector */}
            <div className="inline-flex bg-gray-100 p-1.5 rounded-full mt-8">
              {['hatchback', 'sedan', 'suv'].map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveCarType(type as any)}
                  className={`px-6 py-2 rounded-full text-sm font-bold transition-all capitalize ${
                    activeCarType === type 
                      ? 'bg-brand-primary text-white shadow-md' 
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
            {/* Basic Package */}
            <PricingCard 
              title="Basic Care"
              price={pricingData[activeCarType].basic}
              time="2-3 hours"
              features={[
                'AI-powered engine diagnostics',
                'Oil & filter change',
                'Basic car wash',
                'Tire pressure check',
                'Battery health scan'
              ]}
              activeCar={activeCarType}
            />

            {/* Premium Package - Highlighted */}
            <div className="relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                MOST POPULAR
              </div>
              <PricingCard 
                title="Premium Care"
                price={pricingData[activeCarType].premium}
                save="Save ₹1,000"
                time="4-5 hours"
                isPremium={true}
                features={[
                  'Complete AI health analysis',
                  'Premium oil & filter change',
                  'Deep interior & exterior cleaning',
                  'AC service & sanitization',
                  'Brake system inspection',
                  'Wheel alignment check'
                ]}
                activeCar={activeCarType}
              />
            </div>

            {/* Comprehensive Package */}
            <PricingCard 
              title="Comprehensive Care"
              price={pricingData[activeCarType].comprehensive}
              save="Save ₹2,000"
              time="6-8 hours"
              features={[
                'Advanced AI predictive analysis',
                'Synthetic oil & premium filters',
                'Paint protection & ceramic coating',
                'Complete engine detailing',
                'Suspension system check',
                'Electrical system diagnosis',
                'Interior protection treatment'
              ]}
              activeCar={activeCarType}
            />
          </div>
          
          <div className="text-center mt-12">
            <Link href="/services" className="btn btn-primary text-lg px-10 py-4 rounded-xl inline-flex items-center gap-2">
              Book Service Now <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-sm text-gray-500 mt-4">
              Or chat with our AI assistant for instant booking - <span className="font-semibold">no employee needed!</span>
            </p>
          </div>
        </div>
      </section>

      {/* 4. Live Service Tracking Timeline */}
      <section className="py-20 bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row gap-16">
            <div className="lg:w-1/2">
              <span className="text-brand-fng font-bold tracking-wider uppercase text-sm">Live Service Tracking</span>
              <h2 className="text-4xl font-bold mt-2 mb-6">Real-Time AI Service Monitoring</h2>
              <p className="text-gray-400 mb-10">
                Watch your car's service journey unfold in real-time with AI-powered updates, photos, and quality checks.
              </p>

              {/* Timeline */}
              <div className="space-y-8 border-l-2 border-gray-700 ml-3 pl-8 relative">
                <TimelineItem 
                  time="09:30 AM"
                  title="Vehicle Pickup"
                  desc="AI detected optimal traffic window for pickup"
                  status="completed"
                />
                <TimelineItem 
                  time="10:15 AM"
                  title="AI Diagnosis"
                  desc="Advanced scanning: AI identified 3 maintenance items"
                  status="completed"
                />
                 <TimelineItem 
                  time="11:00 AM"
                  title="Service in Progress"
                  desc="Expert technicians at work. AI monitoring quality."
                  status="active"
                />
                <TimelineItem 
                  time="02:30 PM"
                  title="AI Quality Check"
                  desc="Automated quality verification pending"
                  status="pending"
                />
                <TimelineItem 
                  time="03:15 PM"
                  title="Ready for Delivery"
                  desc="AI will optimize delivery route"
                  status="pending"
                />
              </div>
            </div>

            {/* Live Updates Card */}
            <div className="lg:w-1/2">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 sticky top-24">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-xl">Live Updates</h3>
                  <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full animate-pulse">● Live</span>
                </div>

                <div className="space-y-4">
                  <LiveUpdateCard 
                    title="Engine Oil Change"
                    status="Completed"
                    desc="Premium synthetic oil installed. AI verified quality."
                    color="green"
                  />
                  <LiveUpdateCard 
                    title="Brake System Check"
                    status="In Progress"
                    desc="AI analyzing brake pad wear. Est: 30 mins."
                    color="yellow"
                  />
                  <LiveUpdateCard 
                    title="Car Wash & Detailing"
                    status="Pending"
                    desc="Scheduled after mechanical work completion."
                    color="gray"
                  />
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-sm text-gray-400 mb-2">Live Location</p>
                  <div className="flex items-center gap-3 text-white font-medium">
                    <MapPin className="w-5 h-5 text-brand-fng" />
                    Elite Auto Care, Bandra West
                  </div>
                  <div className="h-32 bg-gray-800 rounded-xl mt-4 w-full relative overflow-hidden">
                     <div className="absolute inset-0 bg-gray-700 opacity-50"></div>
                     <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
                       [Map Placeholder]
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Trusted Workshops */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center mb-12">
          <h2 className="text-4xl font-bold text-brand-secondary">How Can I Find a MY FNG Service Center Near Me?</h2>
          <p className="text-gray-600 mt-4">
            Our AI-powered platform connects you to premium workshops across Mumbai. 
            <span className="font-semibold text-brand-secondary">AI continuously monitors</span> and rates workshop performance for quality assurance.
          </p>
        </div>

        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8">
          <WorkshopCard 
            name="Elite Auto Care"
            location="Bandra West"
            rating="4.9"
            services="156 Services"
            image="https://images.unsplash.com/photo-1625047509248-ec889cbff17f?auto=format&fit=crop&q=80&w=400"
          />
          <WorkshopCard 
            name="Tech Motors Hub"
            location="Andheri East"
            rating="4.8"
            services="203 Services"
            image="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&q=80&w=400"
          />
          <WorkshopCard 
            name="Premium Auto Solutions"
            location="Juhu"
            rating="4.9"
            services="187 Services"
            image="https://images.unsplash.com/photo-1503376763036-066120622c74?auto=format&fit=crop&q=80&w=400"
          />
        </div>
        
        {/* Stats */}
        <div className="container mx-auto px-4 mt-20 border-t border-gray-200 pt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <StatBox number="10,000+" label="Cars Serviced" />
            <StatBox number="4.9" label="Average Rating" />
            <StatBox number="50+" label="Partner Workshops" />
            <StatBox number="99.5%" label="Customer Satisfaction" />
          </div>
        </div>
      </section>

      {/* 6. RSA Section with AI Theme */}
      <section className="py-20 bg-gradient-to-br from-brand-secondary via-[#001530] to-[#000510] text-white relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[100px] -mr-20 -mt-20 animate-pulse"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-red-500/20 backdrop-blur-md border border-red-500/30 rounded-full text-red-300 text-sm font-semibold mb-6">
                <Activity className="w-4 h-4 animate-pulse" />
                24/7 AI-POWERED EMERGENCY DISPATCH
              </div>
              
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">
                Stuck on the Road? <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-300">
                  AI Sends Help Instantly
                </span>
              </h2>
              
              <p className="text-lg text-gray-300 mb-8 leading-relaxed">
                India's fastest AI-dispatched Roadside Assistance. Our system automatically locates 
                the nearest recovery vehicle. <span className="text-white font-semibold">Average arrival: 28 minutes.</span>
              </p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <RSAService icon={<Car className="w-5 h-5" />} title="Towing" />
                <RSAService icon={<Zap className="w-5 h-5" />} title="Jumpstart" />
                <RSAService icon={<Shield className="w-5 h-5" />} title="Flat Tyre" />
                <RSAService icon={<Activity className="w-5 h-5" />} title="Lockout" />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button className="bg-red-600 hover:bg-red-700 text-white text-lg font-bold py-4 px-8 rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-1 flex items-center justify-center gap-3">
                  <MessageSquare className="w-5 h-5" />
                  Call 1800-MY-FNG
                </button>
                <Link href="/roadside-assistance" className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-lg font-bold py-4 px-8 rounded-xl backdrop-blur-md transition flex items-center justify-center gap-3">
                  <MapPin className="w-5 h-5" />
                  Share Location
                </Link>
              </div>
            </div>

            <div className="lg:w-1/2 w-full">
              {/* RSA Tracking Card */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-xs text-gray-400">RSA Request #RSA-2024-882</p>
                    <p className="font-bold text-lg">Battery Jumpstart - Honda City</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">ETA</p>
                    <p className="font-bold text-brand-fng text-xl">12 min</p>
                  </div>
                </div>
                
                <div className="space-y-4 relative">
                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-white/20"></div>

                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white z-10">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                    <p className="font-semibold text-sm">Request Received</p>
                    <p className="text-xs text-gray-400">Just now • AI analyzing location</p>
                  </div>
                  
                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white z-10">
                      <Car className="w-3 h-3 text-white" />
                    </div>
                    <p className="font-semibold text-sm">Nearest Vehicle Assigned</p>
                    <p className="text-xs text-gray-400">30 sec ago • Driver: Rajesh</p>
                  </div>

                  <div className="relative pl-10">
                    <div className="absolute left-0 top-1 w-6 h-6 bg-brand-fng rounded-full flex items-center justify-center border-2 border-white z-10 animate-pulse">
                      <MapPin className="w-3 h-3 text-white" />
                    </div>
                    <p className="font-semibold text-sm text-brand-fng">En Route</p>
                    <p className="text-xs text-gray-400">Live • 2.5 km away</p>
                    <div className="h-24 bg-gray-800 rounded-lg mt-2 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gray-700 opacity-50"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
                        [Live Map Tracking]
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Car Service Types Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">Complete Car Care</span>
            <h2 className="text-4xl font-bold mt-2 mb-4 text-brand-secondary">What Services Does MY FNG Offer?</h2>
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
            <ServiceTypeCard 
              icon={<Zap className="w-8 h-8" />}
              title="Clutch Service"
              desc="Expert clutch repair and replacement"
              features={['Clutch Inspection', 'Plate Replacement', 'Cable Adjustment', 'Warranty']}
            />
          </div>

          <div className="text-center mt-12">
            <Link href="/services" className="btn btn-primary text-lg px-10 py-4 rounded-xl">
              Explore All Services <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
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
