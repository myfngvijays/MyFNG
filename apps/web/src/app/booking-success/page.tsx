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

      <div className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-2xl mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-green-100 animate-fade-in-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl animate-bounce">
                  <CheckCircle className="w-14 h-14 text-green-600" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-300 animate-spin-slow" />
                <Trophy className="absolute -bottom-2 -left-2 w-8 h-8 text-yellow-300 animate-bounce" />
              </div>
              
              <h1 className="text-4xl font-bold text-white mb-2">
                Booking Confirmed! 🎉
              </h1>
              <p className="text-green-100 text-lg">
                Your car is in great hands now!
              </p>
            </div>

            {/* Body */}
            <div className="p-8 space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  We've received your booking successfully!
                </p>
                {leadNumber && (
                  <div className="inline-block bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl px-6 py-4">
                    <p className="text-sm text-gray-600 mb-1">Your Booking ID</p>
                    <p className="text-2xl font-bold text-blue-600">{leadNumber}</p>
                  </div>
                )}
              </div>

              {/* What's Next */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-600" />
                  What happens next?
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <p className="text-gray-700">
                      Our team will call you within <span className="font-semibold">15 minutes</span> to confirm
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <p className="text-gray-700">
                      We'll send you booking details via <span className="font-semibold">SMS & Email</span>
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <p className="text-gray-700">
                      Track your service progress in <span className="font-semibold">real-time</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <Phone className="w-6 h-6 text-blue-600" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">Call Us</p>
                    <p className="text-sm text-gray-600">+91 98765 43210</p>
                  </div>
                </a>

                <a
                  href="https://wa.me/919876543210"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
                >
                  <MessageSquare className="w-6 h-6 text-green-600" />
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">WhatsApp</p>
                    <p className="text-sm text-gray-600">Chat with us</p>
                  </div>
                </a>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/"
                  className="flex-1 btn bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 py-4"
                >
                  <Home className="w-5 h-5" />
                  Back to Home
                </Link>
                <Link
                  href="/services"
                  className="flex-1 btn border-2 border-gray-300 hover:border-gray-400 font-semibold rounded-xl py-4"
                >
                  View All Services
                </Link>
              </div>

              {/* Thank You Message */}
              <div className="text-center pt-4 border-t border-gray-200">
                <Heart className="w-8 h-8 text-red-500 mx-auto mb-2 animate-pulse" />
                <p className="text-gray-600 font-medium">
                  Thank you for choosing MyFNG! We're excited to serve you!
                </p>
              </div>
            </div>
          </div>

          {/* Ratings Prompt */}
          <div className="mt-8 text-center animate-fade-in-up" style={{animationDelay: '0.5s'}}>
            <p className="text-gray-600 mb-3">
              Love our service? Rate us after your experience! ⭐
            </p>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-8 h-8 text-yellow-400 fill-yellow-400" />
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
