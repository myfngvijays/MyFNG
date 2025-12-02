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
              
              <h1 className="text-5xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight animate-fade-in-up delay-100">
                India's First <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-fng to-cyan-400">
                  AI-Powered
                </span> <br />
                Car Care Platform 🚗⚡
              </h1>
              
              <p className="text-lg text-gray-300 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed animate-fade-in-up delay-200">
                Experience the future of car servicing with our AI assistant that understands your car better than you do. 
                Smart diagnostics, transparent pricing, and premium service.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up delay-300">
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="btn bg-brand-primary hover:bg-brand-primary-hover text-white text-lg px-8 py-4 rounded-xl shadow-lg shadow-brand-primary/30 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1"
                >
                  <MessageSquare className="w-5 h-5" />
                  Ask MY FNG AI
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

              <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-400 animate-fade-in-up delay-400">
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
            <div className="lg:w-1/2 relative animate-fade-in-up delay-500">
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
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">AI-Powered Car Care in 3 Simple Steps</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              Experience the future of car servicing with our intelligent platform that makes car care effortless.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <StepCard 
              number="01" 
              title="AI Diagnosis" 
              desc="Our AI analyzes your car details and predicts maintenance needs using advanced machine learning algorithms."
            />
            <StepCard 
              number="02" 
              title="Smart Booking" 
              desc="AI assistant books your slot based on urgency, location, and preferred timing with transparent pricing."
            />
            <StepCard 
              number="03" 
              title="Premium Service" 
              desc="Real-time tracking with AI-powered quality checks and instant updates throughout the service process."
            />
          </div>
        </div>
      </section>

      {/* 3. AI-Powered Pricing */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-brand-primary font-bold tracking-wider uppercase text-sm">AI-Powered Pricing</span>
            <h2 className="text-4xl font-bold mt-2 text-brand-secondary">Smart Service Packages Tailored by AI</h2>
            <p className="text-gray-600 mt-4">Recommended based on your car model & usage.</p>
            
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
            <Link href="/services" className="text-brand-primary font-bold hover:underline flex items-center justify-center gap-2">
              View All Services <ChevronRight className="w-4 h-4" />
            </Link>
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
          <h2 className="text-4xl font-bold text-brand-secondary">AI-Enhanced Premium Workshops</h2>
          <p className="text-gray-600 mt-4">Our AI continuously monitors and rates workshop performance.</p>
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

      {/* Floating Chatbot (Always Visible) */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-brand-primary hover:bg-brand-primary-hover text-white px-6 py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 flex items-center gap-3 group border-4 border-white/20"
        >
          <Bot className="w-6 h-6" />
          <span className="font-semibold">Ask MY FNG AI</span>
        </button>
      </div>

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
