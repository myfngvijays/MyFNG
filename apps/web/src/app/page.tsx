import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { 
  Wrench, 
  Clock, 
  Shield, 
  Users, 
  MapPin, 
  CheckCircle, 
  Star,
  Phone,
  Mail,
  ArrowRight,
  Truck,
  Battery,
  Key,
  Settings,
  Zap,
  MessageSquare,
  Smartphone,
  Eye
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />

      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-brand-my/5 via-white to-brand-fng/5 overflow-hidden relative">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-brand-secondary/5 rounded-full blur-3xl"></div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2 text-center lg:text-left">
              <div className="inline-block px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-full text-sm font-semibold mb-6 flex items-center gap-2 w-fit mx-auto lg:mx-0">
                <Zap className="w-4 h-4" />
                India's First AI-Powered Car Service
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-brand-secondary leading-tight">
                Smart Car Service <br />
                <span className="text-brand-primary">& Instant RSA</span>
            </h1>
              <p className="text-xl text-text-body mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Book service instantly via our AI Chatbot. No calls, no waiting, just seamless car care. 
                Experience 100% transparency with live photo updates and tracking.
            </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/customer/register" className="btn btn-primary text-lg px-8 py-4 shadow-brand-primary/30 flex items-center justify-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat with AI to Book
                </Link>
                <Link href="/roadside-assistance" className="btn btn-secondary text-lg px-8 py-4 shadow-brand-secondary/30 flex items-center justify-center gap-2">
                  <Phone className="w-5 h-5" />
                  Emergency RSA
              </Link>
              </div>
            </div>
            <div className="lg:w-1/2 relative">
              <div className="relative z-10 bg-white p-2 rounded-2xl shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
                 <img 
                  src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&q=80&w=1000" 
                  alt="Mechanic working on car" 
                  className="rounded-xl w-full h-[400px] object-cover"
                />
              </div>
              {/* Float Card 1 */}
              <div className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl z-20 max-w-xs hidden md:block animate-bounce-slow">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-full">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">AI Verified</p>
                    <p className="text-xs text-gray-500">Automated Quality Checks</p>
                  </div>
                </div>
              </div>
              {/* Float Card 2 */}
              <div className="absolute top-10 -right-6 bg-white p-4 rounded-xl shadow-xl z-20 max-w-xs hidden md:block animate-bounce-slow delay-100">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <MessageSquare className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Instant Booking</p>
                    <p className="text-xs text-gray-500">No Human Intervention</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Experience Section */}
      <section id="ai-experience" className="py-20 bg-background-grey">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <span className="text-brand-primary font-semibold tracking-wider uppercase">The Future of Car Care</span>
            <h2 className="text-4xl font-bold mt-2 mb-4 text-brand-secondary">Why MyFNG is Different</h2>
            <p className="text-xl text-text-body max-w-2xl mx-auto">
              We leverage Artificial Intelligence to provide a seamless, transparent, and efficient experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<MessageSquare className="w-10 h-10 text-brand-primary" />}
              title="Chatbot Booking"
              description="Skip the calls. Book your service, RSA, or consultation directly through our intelligent AI chatbot in seconds."
            />
            <FeatureCard
              icon={<Eye className="w-10 h-10 text-brand-primary" />}
              title="100% Transparency"
              description="See exactly what's happening. Get live photos, videos, and part usage updates directly on your phone."
            />
            <FeatureCard
              icon={<Smartphone className="w-10 h-10 text-brand-primary" />}
              title="No Employee Hassle"
              description="Our automated systems handle scheduling, updates, and billing, ensuring zero miscommunication."
            />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-brand-secondary">Complete Car Care Solutions</h2>
            <p className="text-xl text-text-body max-w-2xl mx-auto">
              Expert services backed by AI precision and human expertise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <ServiceCard
              icon={<Settings className="w-8 h-8 text-brand-primary" />}
              title="Periodic Service"
              description="Comprehensive scheduled maintenance with digital health reports."
            />
            <ServiceCard
              icon={<Truck className="w-8 h-8 text-brand-primary" />}
              title="Denting & Painting"
              description="High-precision body work with color-match technology."
            />
            <ServiceCard
              icon={<Battery className="w-8 h-8 text-brand-primary" />}
              title="Battery & Electrical"
              description="Advanced diagnostics for modern car electronics."
            />
             <ServiceCard
              icon={<Shield className="w-8 h-8 text-brand-primary" />}
              title="AC Service & Repair"
              description="Complete climate control solutions for your comfort."
            />
          </div>
          
          <div className="mt-12 text-center">
            <Link href="/services" className="btn btn-outline">
              View All Services
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </div>
        </div>
      </section>

      {/* RSA Highlight Section */}
      <section id="rsa" className="py-20 bg-brand-secondary text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10">
           <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 100 L100 0 L100 100 Z" fill="white" />
           </svg>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="lg:w-1/2">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-red-500 p-2 rounded-lg">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold tracking-wider uppercase">24/7 Emergency Support</span>
              </div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-white">Stuck on the Road? <br/> We've Got Your Back.</h2>
              <p className="text-xl text-blue-100 mb-8 leading-relaxed">
                Our AI-dispatched RSA network ensures the nearest help reaches you in record time. Track your recovery vehicle live.
            </p>
            
              <div className="grid grid-cols-2 gap-6 mb-8">
                <RSAFeature icon={<Truck />} title="Towing Service" />
                <RSAFeature icon={<Battery />} title="Battery Jumpstart" />
                <RSAFeature icon={<Key />} title="Key Lockout" />
                <RSAFeature icon={<Settings />} title="Flat Tyre Support" />
              </div>
              
              <button className="bg-red-600 hover:bg-red-700 text-white text-lg font-bold py-4 px-8 rounded-lg shadow-lg transition transform hover:-translate-y-1 flex items-center gap-3">
                <Phone className="w-6 h-6" />
                Call RSA Now: 1800-MY-FNG
              </button>
            </div>
            <div className="lg:w-5/12">
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20">
                <h3 className="text-2xl font-bold mb-6 text-center">Why Choose Our RSA?</h3>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="bg-green-500 rounded-full p-1 mt-1">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">AI Dispatching</p>
                      <p className="text-sm text-blue-100">Automatically assigns nearest help</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="bg-green-500 rounded-full p-1 mt-1">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">Live Tracking</p>
                      <p className="text-sm text-blue-100">See your rescuer in real-time</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="bg-green-500 rounded-full p-1 mt-1">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="font-bold">Transparent Pricing</p>
                      <p className="text-sm text-blue-100">No hidden charges, pay what you see</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-background-grey">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-brand-secondary">How It Works</h2>
            <p className="text-xl text-text-body">Automated convenience at your fingertips</p>
            </div>
            
          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Connecting Line (Hidden on Mobile) */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gray-300 -z-0"></div>

            <StepCard 
              number="1" 
              title="Chat to Book" 
              description="Tell our AI chatbot what you need. It books your slot instantly."
            />
            <StepCard 
              number="2" 
              title="Free Pickup" 
              description="Our driver picks up your car. Verify condition digitally."
            />
            <StepCard 
              number="3" 
              title="Live Updates" 
              description="Receive photos and approval requests on WhatsApp/App."
            />
            <StepCard 
              number="4" 
              title="Delivery" 
              description="Pay online and get your car delivered fresh & clean."
            />
          </div>
            </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-brand-primary text-white text-center">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-4xl font-bold mb-6">Ready for the Future of Car Care?</h2>
          <p className="text-xl mb-8 opacity-90">Experience the power of AI-driven service. Simple, Transparent, Reliable.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/customer/register" className="bg-white text-brand-primary hover:bg-gray-100 px-8 py-4 rounded-lg font-bold text-lg shadow-lg transition">
              Start Chat Booking
            </Link>
            <a href="https://myfng.in" target="_blank" rel="noopener noreferrer" className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-8 py-4 rounded-lg font-bold text-lg transition">
              Visit MyFNG.in
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card hover:shadow-xl transition group border border-transparent hover:border-brand-primary/20">
      <div className="mb-4 group-hover:scale-110 transition bg-brand-primary/5 w-16 h-16 rounded-xl flex items-center justify-center">{icon}</div>
      <h3 className="text-xl font-semibold mb-3 text-brand-secondary">{title}</h3>
      <p className="text-text-body leading-relaxed">{description}</p>
    </div>
  );
}

function ServiceCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition border border-gray-100 group hover:border-brand-primary/30">
      <div className="mb-6 bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-brand-secondary">{title}</h3>
      <p className="text-text-body leading-relaxed">{description}</p>
    </div>
  );
}

function RSAFeature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 p-4 rounded-lg backdrop-blur-sm hover:bg-white/20 transition">
      <div className="text-brand-primary bg-white p-2 rounded-full">
        {icon}
      </div>
      <span className="font-semibold">{title}</span>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="relative z-10 text-center bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition group hover:-translate-y-1">
      <div className="w-12 h-12 bg-brand-secondary text-white text-xl font-bold rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-blue-100 group-hover:bg-brand-primary transition">
        {number}
      </div>
      <h3 className="text-lg font-bold mb-2 text-gray-900">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </div>
  );
}
