'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { 
  CheckCircle, Home, Phone, MessageSquare, 
  Sparkles, Trophy, Star, Heart, PartyPopper
} from 'lucide-react';
import Confetti from 'react-confetti';

function BookingSuccessContent() {
  const searchParams = useSearchParams();
  const leadNumber = searchParams.get('lead');
  const [showConfetti, setShowConfetti] = useState(true);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    });

    // Stop confetti after 5 seconds
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      <Navbar />
      
      {showConfetti && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
        />
      )}

      <div className="container mx-auto px-3 sm:px-4 pt-20 sm:pt-24 md:pt-32 pb-10 sm:pb-12 md:pb-16">
        <div className="max-w-2xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-green-100 animate-fade-in-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 sm:p-7 md:p-8 text-center">
              <div className="relative inline-block mb-3 sm:mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-xl animate-bounce">
                  <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 text-green-600" />
                </div>
                <Sparkles className="absolute -top-1 sm:-top-2 -right-1 sm:-right-2 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-300 animate-spin-slow" />
                <Trophy className="absolute -bottom-1 sm:-bottom-2 -left-1 sm:-left-2 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-300 animate-bounce" />
              </div>
              
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1.5 sm:mb-2">
                Booking Confirmed! 🎉
              </h1>
              <p className="text-green-100 text-sm sm:text-base md:text-lg">
                Your car is in great hands now!
              </p>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-5 md:space-y-6">
              <div className="text-center">
                <p className="text-gray-600 text-sm sm:text-base mb-3 sm:mb-4">
                  We've received your booking successfully!
                </p>
                {leadNumber && (
                  <div className="inline-block bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg sm:rounded-xl px-4 sm:px-5 md:px-6 py-3 sm:py-3.5 md:py-4">
                    <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Your Booking ID</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">{leadNumber}</p>
                  </div>
                )}
              </div>

              {/* What's Next */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-lg sm:rounded-xl p-4 sm:p-5 md:p-6">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600 flex-shrink-0" />
                  <span>What happens next?</span>
                </h3>
                <div className="space-y-2.5 sm:space-y-3">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm font-semibold">
                      1
                    </div>
                    <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                      Our team will call you within <span className="font-semibold">15 minutes</span> to confirm
                    </p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm font-semibold">
                      2
                    </div>
                    <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                      We'll send you booking details via <span className="font-semibold">SMS & Email</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs sm:text-sm font-semibold">
                      3
                    </div>
                    <p className="text-gray-700 text-xs sm:text-sm md:text-base">
                      Track your service progress in <span className="font-semibold">real-time</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <a
                  href="tel:+919152307030"
                  className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 border-gray-200 rounded-lg sm:rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-semibold text-xs sm:text-sm text-gray-900">Call Us</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">+91 91523 07030</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/919167779696"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border-2 border-gray-200 rounded-lg sm:rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                  <div className="text-left min-w-0 flex-1">
                    <p className="font-semibold text-xs sm:text-sm text-gray-900">WhatsApp</p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">+91 91677 79696</p>
                  </div>
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-3 sm:pt-4">
                <Link
                  href="/"
                  className="flex-1 btn bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 md:py-4"
                >
                  <Home className="w-4 h-4 sm:w-5 sm:h-5" />
                  Back to Home
                </Link>
                <Link
                  href="/car-services"
                  className="flex-1 btn border-2 border-gray-300 hover:border-gray-400 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl py-3 sm:py-3.5 md:py-4"
                >
                  View All Services
                </Link>
              </div>

              {/* Thank You Message */}
              <div className="text-center pt-3 sm:pt-4 border-t border-gray-200">
                <Heart className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-red-500 mx-auto mb-1.5 sm:mb-2 animate-pulse" />
                <p className="text-gray-600 text-xs sm:text-sm md:text-base font-medium">
                  Thank you for choosing MyFNG! We're excited to serve you!
                </p>
              </div>
            </div>
          </div>

          {/* Ratings Prompt */}
          <div className="mt-6 sm:mt-7 md:mt-8 text-center animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            <p className="text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3">
              Love our service? Rate us after your experience! ⭐
            </p>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function BookingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <BookingSuccessContent />
    </Suspense>
  );
}
