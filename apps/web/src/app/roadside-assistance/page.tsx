'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import toast from 'react-hot-toast';
import { loadRazorpayScript } from '@/lib/services/paymentService';
import {
  Phone,
  Clock,
  MapPin,
  Shield,
  CheckCircle,
  Truck,
  Battery,
  Key,
  Settings,
  AlertTriangle,
  Bot,
  Zap,
  Loader2,
  X,
} from 'lucide-react';

export default function RSAPage() {
  const subscriptionPlans = useMemo(
    () => [
      {
        key: 'basic',
        title: 'Basic Plan',
        price: 999,
        durationLabel: '1 Year / 2 Service',
        accent: 'bg-amber-500',
        ctaLabel: 'Buy Now',
        features: [
          'Flat tyre Assistance',
          'Battery Jumpstart',
          'Towing',
          'On spot minor repairs',
          'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
        ],
      },
      {
        key: 'standard',
        title: 'Standard',
        price: 2999,
        durationLabel: '5 Years / 10 Service',
        accent: 'bg-gray-400',
        ctaLabel: 'Book Now',
        features: [
          'Flat tyre Assistance',
          'Battery Jumpstart',
          'Towing',
          'On spot minor repairs',
          'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
        ],
      },
      {
        key: 'ultimate',
        title: 'Ultimate',
        price: 4999,
        durationLabel: '15 Years- 30 Services',
        accent: 'bg-orange-500',
        ctaLabel: 'Book Now',
        features: [
          'Flat tyre Assistance',
          'Battery Jumpstart',
          'Towing',
          'On spot minor repairs',
          'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
        ],
      },
      {
        key: 'family',
        title: 'Family',
        price: 9990,
        durationLabel: '15 Years- 50 Services',
        accent: 'bg-sky-400',
        ctaLabel: 'Book Now',
        features: [
          'Upto 3 Vehicles',
          'Flat tyre Assistance',
          'Battery Jumpstart',
          'Towing',
          'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
        ],
      },
      {
        key: 'premium',
        title: 'Premium',
        price: 9990,
        durationLabel: '1 Years/ Unlimited Service - 20% OFF',
        accent: 'bg-red-500',
        ctaLabel: 'Buy Now',
        features: [
          'No capping on free services',
          '1 Night Hotel Accommodation',
          'Cab Arrangement (Free up to 50 km)',
          'No capping on free services',
        ],
      },
    ],
    []
  );

  const terms = useMemo(
    () => [
      'Members are entitled to 2 free services per year under all plans, excluding the Premium Plan.',
      "Towing distance is calculated on a round-trip basis (from the service provider’s location to the vehicle’s location and then to the destination).",
      'Key Unlock Assistance is subject to the type of lock system used in the vehicle.',
      'On-Spot Minor Repairs are limited to small fixes that can be completed without requiring extensive tools or garage equipment.',
      'Hotel accommodation is subject to availability and limited to one night.',
      'Cab arrangement is limited to 50 km and additional charges may apply for distances exceeding this limit.',
      'Ambulance service is provided in case of accidents only and is subject to availability.',
    ],
    []
  );

  const [selectedPlan, setSelectedPlan] = useState<(typeof subscriptionPlans)[number] | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paying, setPaying] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationText, setLocationText] = useState<string>('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Preload Razorpay SDK (best-effort)
  useEffect(() => {
    loadRazorpayScript().catch(() => {});
  }, []);

  // Auto-detect location for onboarding (no change option)
  useEffect(() => {
    if (!showCheckout) return;
    if (locationText) return;

    let cancelled = false;
    async function detect() {
      try {
        if (!('geolocation' in navigator)) return;
        setLocationLoading(true);
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (cancelled) return;
                setLocationCoords({ lat, lng });

                // Reverse geocode (best-effort; if blocked, still keep coords)
                const res = await fetch(
                  `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`
                );
                if (res.ok) {
                  const data: any = await res.json();
                  const a = data?.address || {};
                  const city =
                    a.city || a.town || a.village || a.county || a.state_district || a.municipality || a.suburb || '';
                  const state = a.state || '';
                  const pin = a.postcode || '';
                  const display =
                    [city, state].filter(Boolean).join(', ') + (pin ? ` - ${pin}` : '') || (data?.display_name || '');
                  if (!cancelled && display) setLocationText(display);
                }
              } catch {
                // ignore
              } finally {
                resolve();
              }
            },
            () => resolve(),
            { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
          );
        });
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, [showCheckout, locationText]);

  async function startSubscriptionPayment(plan: (typeof subscriptionPlans)[number]) {
    if (paying) return;
    if (!customerName.trim() || customerPhone.trim().length < 10) {
      toast.error('Please enter name and 10-digit mobile number');
      return;
    }
    if (!vehicleNumber.trim()) {
      toast.error('Please enter vehicle number');
      return;
    }

    setPaying(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || typeof window === 'undefined' || !(window as any).Razorpay) {
        throw new Error('Payment gateway not available');
      }

      const res = await fetch('/api/payments/create-booking-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          bookingType: 'RSA_SUBSCRIPTION',
          planKey: plan.key,
          planTitle: plan.title,
          notes: {
            vehicle_number: vehicleNumber.trim(),
            location_text: locationText || null,
            location_lat: locationCoords?.lat ?? null,
            location_lng: locationCoords?.lng ?? null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create payment order');
      const order = data?.order;
      if (!order?.orderId) throw new Error('Order ID missing');

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'MyFNG Roadside Assistance',
        description: `${plan.title} Subscription`,
        order_id: order.orderId,
        prefill: {
          name: customerName.trim(),
          email: customerEmail.trim(),
          contact: customerPhone.trim(),
        },
        theme: { color: '#3B82F6' },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verify = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verify?.verified) {
              throw new Error(verify?.message || verify?.error || 'Payment verification failed');
            }
            toast.success('Payment successful. Subscription booked!');
            setShowCheckout(false);
            setSelectedPlan(null);
          } catch (e: any) {
            console.error('Verify error:', e);
            toast.error(e?.message || 'Payment verification failed');
          }
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled');
          },
        },
      };

      const rz = new (window as any).Razorpay(options);
      rz.open();
    } catch (e: any) {
      console.error('Subscription payment error:', e);
      toast.error(e?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

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
              <a
                href="tel:18003093431"
                className="bg-red-600 hover:bg-red-700 text-white text-base sm:text-lg md:text-xl font-bold py-3 sm:py-3.5 md:py-4 px-6 sm:px-8 md:px-10 rounded-xl shadow-lg shadow-red-600/30 transition transform hover:-translate-y-1 flex items-center justify-center gap-2 sm:gap-3"
              >
                <Phone className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" />
                <span>Call 1800-309-3431</span>
              </a>
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
             {/* Subscription Pricing (RoadServe-style) */}
             <div>
               <div className="text-center mb-8 sm:mb-10">
                 <p className="text-xs sm:text-sm font-bold tracking-wide text-brand-primary uppercase">Our Pricing</p>
                 <h3 className="text-2xl sm:text-3xl font-extrabold text-brand-secondary mt-2">Best Plans for You</h3>
                 <p className="text-sm sm:text-base text-gray-600 mt-2 max-w-3xl mx-auto px-4">
                   Subscription packages which suits your car as well as your pocket. Get your car serviced at our garages and save 15% on labour charges.
                 </p>
               </div>

               <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5 md:gap-6">
                 {subscriptionPlans.map((plan) => (
                   <div key={plan.key} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
                     <div className={`h-2 ${plan.accent}`} />
                     <div className="p-5 sm:p-6 flex-1 flex flex-col text-left">
                       <h4 className="text-xl font-extrabold text-brand-secondary">{plan.title}</h4>
                       <div className="mt-2 flex items-baseline gap-2">
                         <span className="text-3xl font-black text-red-600">₹ {plan.price}</span>
                       </div>
                       <p className="mt-2 text-sm font-bold text-red-600">{plan.durationLabel}</p>

                       <ul className="mt-4 space-y-2 text-sm text-gray-800">
                         {plan.features.map((f, idx) => (
                           <li key={idx} className="flex items-start gap-2">
                             <CheckCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                             <span>{f}</span>
                           </li>
                         ))}
                 </ul>

                       <div className="mt-6">
                         <button
                           type="button"
                           className="btn btn-primary w-full text-sm py-2.5 justify-center"
                           onClick={() => {
                             setSelectedPlan(plan);
                             setShowCheckout(true);
                           }}
                         >
                           {plan.ctaLabel}
                         </button>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="max-w-6xl mx-auto mt-10 bg-gray-50 rounded-2xl border border-gray-200 p-5 sm:p-6 text-left">
                 <h4 className="text-lg sm:text-xl font-extrabold text-brand-secondary mb-3">Terms &amp; Conditions</h4>
                 <ul className="space-y-2 text-sm text-gray-700">
                   {terms.map((t, idx) => (
                     <li key={idx} className="flex items-start gap-2">
                       <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                       <span>{t}</span>
                     </li>
                   ))}
                 </ul>
               </div>
             </div>
           </div>
        </section>
      </main>
      <Footer />

      {/* Checkout modal for subscription (collect customer details) */}
      {showCheckout && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Razorpay-like onboarding header */}
            <div className="p-4 sm:p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <div className="text-left">
                <p className="text-[11px] sm:text-xs font-semibold opacity-90">Secure checkout</p>
                <h3 className="text-lg sm:text-xl font-extrabold">Complete Payment</h3>
                <p className="text-xs sm:text-sm opacity-90 mt-1">
                  {selectedPlan ? `${selectedPlan.title} • ₹${selectedPlan.price}` : 'RSA subscription'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!paying) {
                    setShowCheckout(false);
                    setSelectedPlan(null);
                  }
                }}
                className="p-2 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Minimal “review” row like onboarding */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Plan</p>
                    <p className="font-bold text-gray-900 truncate">{selectedPlan?.title || '-'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Amount</p>
                    <p className="font-extrabold text-gray-900">₹{selectedPlan?.price ?? '-'}</p>
                  </div>
                </div>
              </div>

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary"
                  placeholder="Enter your name"
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary"
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Car Number</label>
                <input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary uppercase"
                  placeholder="e.g., DL01AB1234"
                />
              </div>

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Detected Location</label>
                <div className="relative">
                  <input
                    value={
                      locationLoading
                        ? 'Detecting location…'
                        : locationText || (locationCoords ? `${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)}` : 'Location not available')
                    }
                    readOnly
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800"
                  />
                  {locationLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Location auto-detected for dispatch. (No manual change)
                </p>
              </div>

              <div className="text-left">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Email <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                </label>
                <input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="button"
                disabled={paying || !selectedPlan}
                onClick={() => {
                  if (selectedPlan) startSubscriptionPayment(selectedPlan);
                }}
                className="w-full py-3 text-base font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {paying ? 'Opening Payment...' : 'Pay with Razorpay'}
              </button>

              {!selectedPlan && <p className="text-xs text-gray-500 text-left">Select a subscription plan to proceed.</p>}
            </div>
          </div>
        </div>
      )}
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
