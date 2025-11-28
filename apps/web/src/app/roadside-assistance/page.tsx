import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Phone, Clock, MapPin, Shield, CheckCircle, Truck, Battery, Key, Settings, AlertTriangle } from 'lucide-react';

export default function RSAPage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      
      <main className="pt-24">
        {/* Hero Section */}
        <section className="bg-brand-secondary text-white py-20 relative overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 text-center">
            <div className="inline-flex items-center gap-2 bg-red-500 px-4 py-1 rounded-full text-sm font-bold mb-6 animate-pulse">
              <AlertTriangle className="w-4 h-4" />
              24/7 EMERGENCY SERVICE
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Stuck on the Road? <br/> We're On Our Way.
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              India's fastest AI-dispatched Roadside Assistance. Average arrival time of 30 minutes. Track your rescuer live.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
               <button className="bg-red-600 hover:bg-red-700 text-white text-xl font-bold py-4 px-10 rounded-lg shadow-lg transition transform hover:-translate-y-1 flex items-center justify-center gap-3">
                <Phone className="w-6 h-6" />
                Call 1800-MY-FNG
              </button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 -mt-32 relative z-20">
              <div className="bg-white p-8 rounded-xl shadow-xl text-center border-b-4 border-brand-primary">
                <div className="w-16 h-16 bg-blue-100 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">30 Mins Response</h3>
                <p className="text-gray-600">Our AI dispatch system finds the nearest recovery vehicle instantly.</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-xl text-center border-b-4 border-brand-primary">
                <div className="w-16 h-16 bg-blue-100 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Live Tracking</h3>
                <p className="text-gray-600">See exactly where help is and when it will arrive on your phone.</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-xl text-center border-b-4 border-brand-primary">
                <div className="w-16 h-16 bg-blue-100 text-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">Secure & Safe</h3>
                <p className="text-gray-600">Verified professionals and transparent pricing. No haggling.</p>
              </div>
            </div>

            <div className="mt-24">
              <h2 className="text-3xl font-bold text-center mb-12 text-brand-secondary">Services Covered</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <RSAItem icon={<Truck />} title="Flatbed Towing" desc="Safe transport for major breakdowns" />
                <RSAItem icon={<Battery />} title="Battery Jumpstart" desc="Dead battery revival" />
                <RSAItem icon={<Settings />} title="Flat Tyre Change" desc="Stepney replacement or repair" />
                <RSAItem icon={<Key />} title="Key Lockout" desc="Key retrieval and unlocking" />
                <RSAItem icon={<Settings />} title="Minor Repairs" desc="On-spot fixes for small issues" />
                <RSAItem icon={<Phone />} title="Tele-Assistance" desc="Expert guidance over call" />
                <RSAItem icon={<Truck />} title="Fuel Delivery" desc="Emergency fuel top-up" />
                <RSAItem icon={<Shield />} title="Wrong Fueling" desc="Assistance for fuel mix-ups" />
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="bg-gray-50 py-20">
           <div className="container mx-auto px-4 text-center">
             <h2 className="text-3xl font-bold mb-4 text-brand-secondary">Simple, Transparent Pricing</h2>
             <p className="text-gray-600 mb-12">Pay only for what you need. No subscription required.</p>
             
             <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8">
               {/* Basic Card */}
               <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition">
                 <h3 className="text-xl font-bold mb-2">Jumpstart / Unlock</h3>
                 <div className="text-4xl font-bold text-brand-primary mb-4">₹499</div>
                 <ul className="space-y-3 text-left mb-8 text-gray-600">
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Battery Jumpstart</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Key Retrieval</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> 30 min arrival</li>
                 </ul>
                 <button className="btn btn-outline w-full">Book Now</button>
               </div>

               {/* Towing Card */}
               <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition border-2 border-brand-primary transform scale-105 relative">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-brand-primary text-white px-4 py-1 rounded-full text-sm font-bold">MOST POPULAR</div>
                 <h3 className="text-xl font-bold mb-2">City Towing</h3>
                 <div className="text-4xl font-bold text-brand-primary mb-4">₹1499</div>
                 <ul className="space-y-3 text-left mb-8 text-gray-600">
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Flatbed Towing</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Up to 10km</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Live Tracking</li>
                 </ul>
                 <button className="btn btn-primary w-full">Book Now</button>
               </div>

               {/* Highway Card */}
               <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition">
                 <h3 className="text-xl font-bold mb-2">Highway Assist</h3>
                 <div className="text-4xl font-bold text-brand-primary mb-4">₹2499</div>
                 <ul className="space-y-3 text-left mb-8 text-gray-600">
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Priority Support</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Up to 50km Towing</li>
                   <li className="flex gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> Medical Assist Coordination</li>
                 </ul>
                 <button className="btn btn-outline w-full">Book Now</button>
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
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition bg-white">
      <div className="bg-brand-secondary/10 text-brand-secondary p-3 rounded-lg">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600">{desc}</p>
      </div>
    </div>
  );
}

