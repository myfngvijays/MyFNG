import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Settings, Truck, Battery, Shield, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      
      <main className="pt-24 pb-20">
        {/* Header */}
        <section className="bg-brand-secondary text-white py-16 mb-16">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Complete Car Care Services</h1>
            <p className="text-blue-100 max-w-2xl mx-auto text-lg">
              From routine maintenance to complex repairs, MyFNG uses AI and expert technicians to keep your car running like new.
            </p>
          </div>
        </section>

        <div className="container mx-auto px-4">
          {/* Service Categories */}
          <div className="space-y-20">
            
            {/* Periodic Service */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <div className="bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary mb-6">
                  <Settings className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-brand-secondary">Periodic Service</h2>
                <p className="text-text-body text-lg mb-6">
                  Keep your car healthy with our manufacturer-recommended service packages. Includes oil change, filter replacement, and comprehensive 40-point inspection.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Engine Oil Replacement (Shell/Castrol)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Oil Filter & Air Filter Replacement</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Brake, Coolant & Fluid Top-up</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Detailed Health Report</span>
                  </li>
                </ul>
                <Link href="/customer/register" className="btn btn-primary">
                  Book Service
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="md:w-1/2">
                <img 
                  src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=1000" 
                  alt="Periodic Service" 
                  className="rounded-2xl shadow-xl w-full object-cover h-[400px]"
                />
              </div>
            </div>

            {/* Denting Painting */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12">
              <div className="md:w-1/2">
                <div className="bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary mb-6">
                  <Truck className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-brand-secondary">Denting & Painting</h2>
                <p className="text-text-body text-lg mb-6">
                  Restore your car's showroom shine. We use premium paints and advanced color-matching technology for a flawless finish.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Grade-A Primer & Paint (DuPont/Nippon)</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>4-Layer Painting Process</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Panel Rubbing & Polishing</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>2 Year Paint Warranty</span>
                  </li>
                </ul>
                <Link href="/customer/register" className="btn btn-primary">
                  Get Estimate
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="md:w-1/2">
                <img 
                  src="https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&q=80&w=1000" 
                  alt="Denting Painting" 
                  className="rounded-2xl shadow-xl w-full object-cover h-[400px]"
                />
              </div>
            </div>

            {/* AC Service */}
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="md:w-1/2">
                <div className="bg-brand-primary/10 w-16 h-16 rounded-xl flex items-center justify-center text-brand-primary mb-6">
                  <Shield className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-4 text-brand-secondary">AC Service & Repair</h2>
                <p className="text-text-body text-lg mb-6">
                  Keep your cabin cool and fresh. Comprehensive AC system diagnostics, gas top-up, and cleaning.
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>AC Gas Top-up / Replacement</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Cooling Coil & Condenser Cleaning</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Vents Cleaning & Sanitization</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="text-green-500 w-5 h-5" />
                    <span>Leakage Testing</span>
                  </li>
                </ul>
                <Link href="/customer/register" className="btn btn-primary">
                  Cool Your Ride
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="md:w-1/2">
                <img 
                  src="https://images.unsplash.com/photo-1527247043581-9a9099575e8b?auto=format&fit=crop&q=80&w=1000" 
                  alt="AC Service" 
                  className="rounded-2xl shadow-xl w-full object-cover h-[400px]"
                />
              </div>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
