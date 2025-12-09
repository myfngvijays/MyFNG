import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Phone, Clock, MapPin, Shield, CheckCircle, Truck, Battery, Key, Settings, AlertTriangle, Bot, Zap } from 'lucide-react';

export default function RSAPage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      
      <main className="pt-16 sm:pt-20 md:pt-24">
        {/* Hero Section: AI Themed */}
        <section className="relative py-12 sm:py-16 md:py-20 overflow-hidden bg-gradient-to-br from-[#000510] via-brand-secondary to-[#001530] text-white">
           {/* Abstract Background Shapes */}
          <div className="hidden md:block absolute top-0 right-0 -mr-20 -mt-20 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-brand-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="hidden md:block absolute bottom-0 left-0 -ml-20 -mb-20 w-64 md:w-80 lg:w-96 h-64 md:h-80 lg:h-96 bg-red-600/20 rounded-full blur-3xl"></div>
          
          {/* Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

          <div className="container mx-auto px-3 sm:px-4 md:px-6 relative z-10 text-center">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur-md border border-red-500/30 px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold mb-4 sm:mb-5 md:mb-6 animate-fade-in-up">
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
              <span className="text-red-100">AI-POWERED EMERGENCY DISPATCH</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-5 md:mb-6 animate-fade-in-up delay-100 px-4">
              Stuck on the Road? <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-300">
                AI Sends Help Instantly.
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-6 sm:mb-7 md:mb-8 max-w-2xl mx-auto animate-fade-in-up delay-200 px-4">
              India's fastest AI-dispatched Roadside Assistance. Our system locates the nearest recovery vehicle automatically. 
              <span className="block mt-1.5 sm:mt-2 text-white font-semibold">Average arrival time: 28 minutes.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center animate-fade-in-up delay-300 px-4">
               <button className="bg-red-600 hover:bg-red-700 text-white text-base sm:text-lg md:text-xl font-bold py-3 sm:py-3.5 md:py-4 px-6 sm:px-8 md:px-10 rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-1 flex items-center justify-center gap-2 sm:gap-3">
                <Phone className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                <span>Call 1800-MY-FNG</span>
              </button>
              <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-base sm:text-lg md:text-xl font-bold py-3 sm:py-3.5 md:py-4 px-6 sm:px-8 md:px-10 rounded-xl backdrop-blur-md transition flex items-center justify-center gap-2 sm:gap-3">
                <MapPin className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                <span className="whitespace-nowrap">Share Location via WhatsApp</span>
              </button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-12 sm:py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-3 sm:px-4 md:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 -mt-16 sm:-mt-20 md:-mt-24 lg:-mt-32 relative z-20">
              <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-xl text-center border-b-4 border-brand-primary transform hover:-translate-y-2 transition duration-300">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Bot className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-brand-secondary">AI Instant Dispatch</h3>
                <p className="text-sm sm:text-base text-gray-600">No human delay. Our AI assigns the nearest truck immediately upon request.</p>
              </div>
              <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-xl text-center border-b-4 border-brand-primary transform hover:-translate-y-2 transition duration-300 delay-100">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <MapPin className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-brand-secondary">Live GPS Tracking</h3>
                <p className="text-sm sm:text-base text-gray-600">Watch your rescue vehicle approach in real-time on the map.</p>
              </div>
              <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-xl text-center border-b-4 border-brand-primary transform hover:-translate-y-2 transition duration-300 delay-200 sm:col-span-2 lg:col-span-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-brand-secondary">Secure & Transparent</h3>
                <p className="text-sm sm:text-base text-gray-600">Fixed pricing shown upfront. No haggling in emergencies.</p>
              </div>
            </div>

            <div className="mt-12 sm:mt-16 md:mt-20 lg:mt-24">
              <div className="text-center mb-8 sm:mb-10 md:mb-12">
                 <span className="text-brand-primary font-bold tracking-wider uppercase text-xs sm:text-sm">Comprehensive Coverage</span>
                 <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-brand-secondary">Everything We Cover</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                <RSAItem icon={<Truck />} title="Flatbed Towing" desc="Safe transport for major breakdowns" />
                <RSAItem icon={<Battery />} title="Battery Jumpstart" desc="Dead battery revival" />
                <RSAItem icon={<Settings />} title="Flat Tyre Change" desc="Stepney replacement or repair" />
                <RSAItem icon={<Key />} title="Key Lockout" desc="Key retrieval and unlocking" />
                <RSAItem icon={<Settings />} title="Minor Repairs" desc="On-spot fixes for small issues" />
                <RSAItem icon={<Phone />} title="Tele-Assistance" desc="Expert guidance over call" />
                <RSAItem icon={<Zap />} title="EV Charging" desc="Emergency charge for EVs" />
                <RSAItem icon={<Shield />} title="Wrong Fueling" desc="Assistance for fuel mix-ups" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="bg-white py-12 sm:py-16 md:py-20">
           <div className="container mx-auto px-3 sm:px-4 md:px-6 text-center">
             <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-brand-secondary">Simple, Transparent Pricing</h2>
             <p className="text-sm sm:text-base text-gray-600 mb-8 sm:mb-10 md:mb-12 px-4">Pay only for what you need. No subscription required.</p>
             
             <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
               {/* Basic Card */}
               <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition group">
                 <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-gray-800">Jumpstart / Unlock</h3>
                 <div className="text-3xl sm:text-4xl font-bold text-brand-primary mb-3 sm:mb-4">₹499</div>
                 <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-7 md:mb-8 text-gray-600">
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> Battery Jumpstart</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> Key Retrieval</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> ~28 min arrival</li>
                 </ul>
                 <button className="btn btn-outline w-full text-xs sm:text-sm py-2 sm:py-2.5 group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary transition">Book Now</button>
               </div>

               {/* Towing Card */}
               <div className="bg-gradient-to-b from-brand-secondary to-[#001530] p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-2xl border-2 border-brand-primary transform scale-[1.02] sm:scale-105 relative text-white">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs md:text-sm font-bold shadow-lg">MOST POPULAR</div>
                 <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2">City Towing</h3>
                 <div className="text-3xl sm:text-4xl font-bold text-brand-fng mb-3 sm:mb-4">₹1499</div>
                 <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-7 md:mb-8 text-gray-300">
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" /> Flatbed Towing</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" /> Up to 10km included</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 mt-0.5" /> Live GPS Tracking</li>
                 </ul>
                 <button className="btn bg-white text-brand-secondary hover:bg-gray-100 w-full font-bold text-xs sm:text-sm py-2 sm:py-2.5">Book Now</button>
               </div>

               {/* Highway Card */}
               <div className="bg-white p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition group sm:col-span-2 lg:col-span-1">
                 <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-gray-800">Highway Assist</h3>
                 <div className="text-3xl sm:text-4xl font-bold text-brand-primary mb-3 sm:mb-4">₹2499</div>
                 <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-7 md:mb-8 text-gray-600">
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> Priority Highway Support</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> Up to 50km Towing</li>
                   <li className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm"><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0 mt-0.5" /> Medical Assist Coordination</li>
                 </ul>
                 <button className="btn btn-outline w-full text-xs sm:text-sm py-2 sm:py-2.5 group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary transition">Book Now</button>
               </div>
             </div>
           </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function RSAItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-100 rounded-lg sm:rounded-xl hover:shadow-lg transition bg-white group">
      <div className="bg-brand-primary/10 text-brand-primary p-2 sm:p-2.5 md:p-3 rounded-lg sm:rounded-xl group-hover:bg-brand-primary group-hover:text-white transition flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <h4 className="font-bold text-sm sm:text-base text-brand-secondary group-hover:text-brand-primary transition">{title}</h4>
        <p className="text-xs sm:text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );
}
