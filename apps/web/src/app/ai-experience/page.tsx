import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { MessageSquare, Smartphone, Shield, Eye, Zap, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AIExperiencePage() {
  return (
    <div className="min-h-screen bg-white font-poppins">
      <Navbar />
      
      <main className="pt-16 sm:pt-20 md:pt-24">
        {/* Hero */}
        <section className="bg-gray-900 text-white py-12 sm:py-16 md:py-20 overflow-hidden relative">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=2000')] bg-cover bg-center opacity-20"></div>
          <div className="container mx-auto px-3 sm:px-4 md:px-6 relative z-10 text-center">
            <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-primary/20 border border-brand-primary text-brand-primary rounded-full text-xs sm:text-sm font-semibold mb-4 sm:mb-5 md:mb-6">
              POWERED BY ARTIFICIAL INTELLIGENCE
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-5 md:mb-6 leading-tight px-4">
              Car Care Without the Chaos. <br/> Just <span className="text-brand-primary">Smart AI.</span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 mb-8 sm:mb-9 md:mb-10 max-w-2xl mx-auto px-4">
              We've replaced the confusing calls, hidden charges, and delays with an intelligent system that puts you in control.
            </p>
            <Link href="/customer/register" className="btn btn-primary px-6 sm:px-7 md:px-8 py-3 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-lg">
              Experience the Future
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1.5 sm:ml-2" />
            </Link>
          </div>
        </section>

        {/* Chatbot Feature */}
        <section className="py-12 sm:py-16 md:py-20 bg-white">
          <div className="container mx-auto px-3 sm:px-4 md:px-6">
            <div className="flex flex-col lg:flex-row items-center gap-8 sm:gap-12 md:gap-16">
              <div className="w-full lg:w-1/2 relative">
                 <div className="bg-gray-100 rounded-2xl sm:rounded-3xl p-3 sm:p-4 md:p-6 lg:p-8 shadow-2xl max-w-sm mx-auto border-2 sm:border-4 border-gray-900">
                   {/* Chat Interface Mockup */}
                   <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 h-[300px] sm:h-[350px] md:h-[400px] flex flex-col space-y-2 sm:space-y-3 md:space-y-4 relative overflow-hidden">
                     <div className="bg-gray-100 p-2 sm:p-2.5 md:p-3 rounded-lg rounded-tl-none self-start max-w-[80%]">
                       <p className="text-xs sm:text-sm">Hi! I'm MyFNG Bot. How can I help your car today?</p>
                     </div>
                     <div className="bg-brand-primary text-white p-2 sm:p-2.5 md:p-3 rounded-lg rounded-tr-none self-end max-w-[80%]">
                       <p className="text-xs sm:text-sm">Need a general service for my Swift.</p>
                     </div>
                     <div className="bg-gray-100 p-2 sm:p-2.5 md:p-3 rounded-lg rounded-tl-none self-start max-w-[80%]">
                       <p className="text-xs sm:text-sm">Sure! Periodic Service starts at ₹2999. I have a slot today at 2 PM. Shall I book it?</p>
                     </div>
                     <div className="bg-brand-primary text-white p-2 sm:p-2.5 md:p-3 rounded-lg rounded-tr-none self-end max-w-[80%]">
                       <p className="text-xs sm:text-sm">Yes, please.</p>
                     </div>
                     <div className="bg-gray-100 p-2 sm:p-2.5 md:p-3 rounded-lg rounded-tl-none self-start max-w-[80%]">
                       <p className="text-xs sm:text-sm">Booking Confirmed! ✅ Driver assigned for pickup.</p>
                     </div>
                     
                     {/* Typing indicator */}
                     <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 text-[10px] sm:text-xs text-gray-400 flex items-center gap-1">
                       <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce"></div>
                       <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                       <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                     </div>
                   </div>
                 </div>
              </div>
              <div className="w-full lg:w-1/2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5 md:mb-6">
                  <MessageSquare className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-brand-secondary">Book in Seconds. No Calls.</h2>
                <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-5 md:mb-6">
                  Why wait on hold? Our advanced AI Chatbot understands your needs instantly. Whether it's a service booking, RSA request, or a technical query, get instant answers 24/7.
                </p>
                <ul className="space-y-2 sm:space-y-3">
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Instant Quotes
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Smart Scheduling
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Zero Human Error
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Transparency Feature */}
        <section className="py-12 sm:py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-3 sm:px-4 md:px-6">
            <div className="flex flex-col lg:flex-row-reverse items-center gap-8 sm:gap-12 md:gap-16">
              <div className="w-full lg:w-1/2">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <img src="https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&q=80&w=500" className="rounded-lg sm:rounded-xl shadow-lg w-full h-auto" alt="Workshop view" />
                  <img src="https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&q=80&w=500" className="rounded-lg sm:rounded-xl shadow-lg mt-4 sm:mt-6 md:mt-8 w-full h-auto" alt="Parts check" />
                </div>
              </div>
              <div className="w-full lg:w-1/2">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5 md:mb-6">
                  <Eye className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 text-brand-secondary">100% Transparency. See Everything.</h2>
                <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-4 sm:mb-5 md:mb-6">
                  We believe trust is built with evidence. Our platform forces workshops to upload "Before" and "After" photos/videos of every part changed. You approve everything from your phone.
                </p>
                 <ul className="space-y-2 sm:space-y-3">
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Live Photo Updates
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Digital Job Cards
                  </li>
                  <li className="flex items-center gap-2 sm:gap-3 font-medium text-sm sm:text-base text-gray-700">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" /> Part Verification
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

         {/* No Employee Hassle */}
        <section className="py-12 sm:py-16 md:py-20 bg-white">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 text-center max-w-3xl">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-brand-primary/10 text-brand-primary rounded-lg sm:rounded-xl flex items-center justify-center mb-4 sm:mb-5 md:mb-6 mx-auto">
              <Smartphone className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-5 md:mb-6 text-brand-secondary">No Employee Hassle</h2>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 mb-6 sm:mb-7 md:mb-8 px-4">
              Traditional workshops rely on service advisors who may upsell or miscommunicate. At MyFNG, our central AI manages your job. The mechanic follows the AI's instructions. You deal with the system, not a salesperson.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6 text-left">
              <div className="p-4 sm:p-5 md:p-6 border rounded-lg sm:rounded-xl">
                <h3 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2">Standardized Process</h3>
                <p className="text-xs sm:text-sm text-gray-600">Every car follows the same high-quality checklist.</p>
              </div>
               <div className="p-4 sm:p-5 md:p-6 border rounded-lg sm:rounded-xl">
                <h3 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2">Direct Communication</h3>
                <p className="text-xs sm:text-sm text-gray-600">Your instructions go straight to the mechanic's app.</p>
              </div>
               <div className="p-4 sm:p-5 md:p-6 border rounded-lg sm:rounded-xl sm:col-span-2 lg:col-span-1">
                <h3 className="font-bold text-sm sm:text-base mb-1.5 sm:mb-2">Automated Billing</h3>
                <p className="text-xs sm:text-sm text-gray-600">Pricing is fixed by the system. No surprises.</p>
              </div>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}

