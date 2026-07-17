'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTrackedRouter } from '@/lib/useTrackedRouter';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { createClient } from '@/lib/supabase/client';
import { getCurrentOrStoredUtmParams, getLeadSourceFromUtm } from '@/lib/utm';
import { 
  User, Phone, Car, ArrowRight, Loader2, CheckCircle, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

function BookingDetailsContent() {
  const router = useTrackedRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    vehicle_number: ''
  });

  // Pre-filled data from previous step
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [selectedCarModel, setSelectedCarModel] = useState<any>(null);

  useEffect(() => {
    // Get data from sessionStorage or URL params
    const cityData = sessionStorage.getItem('booking_city');
    const carModelData = sessionStorage.getItem('booking_car_model');
    
    if (cityData) {
      try {
        setSelectedCity(JSON.parse(cityData));
      } catch (e) {
        console.error('Error parsing city data:', e);
      }
    }
    
    if (carModelData) {
      try {
        setSelectedCarModel(JSON.parse(carModelData));
      } catch (e) {
        console.error('Error parsing car model data:', e);
      }
    }

    // Also try to get from URL params
    const cityId = searchParams.get('city');
    const modelId = searchParams.get('model');
    
    if (cityId && !selectedCity) {
      fetchCity(cityId);
    }
    
    if (modelId && !selectedCarModel) {
      fetchCarModel(modelId);
    }
  }, [searchParams]);

  async function fetchCity(cityId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('id', cityId)
        .single();
      
      if (!error && data) {
        setSelectedCity(data);
      }
    } catch (error) {
      console.error('Error fetching city:', error);
    }
  }

  async function fetchCarModel(modelId: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('car_models')
        .select('id, make, model_name, variant, class')
        .eq('id', modelId)
        .single();
      
      if (!error && data) {
        setSelectedCarModel(data);
      }
    } catch (error) {
      console.error('Error fetching car model:', error);
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!selectedCity || !selectedCarModel) {
      toast.error('Please complete the previous step first');
      router.push('/book-service');
      return;
    }

    setLoading(true);
    try {
      // Generate lead number
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;
      const utmParams = getCurrentOrStoredUtmParams();
      const leadSource = getLeadSourceFromUtm(utmParams.utm_source, utmParams.utm_medium);

      const response = await fetch('/api/public/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          utm: utmParams,
          lead: {
            lead_number: leadNumber,
            created_from: 'WEB',
            status: 'NEW',
            lead_type: 'NORMAL',
            lead_source: leadSource,
            customer_name: formData.customer_name || null,
            customer_phone: formData.customer_phone || null,
            city: selectedCity.name,
            city_id: selectedCity.id,
            vehicle_number: formData.vehicle_number || null,
            vehicle_make: selectedCarModel.make,
            model_id: selectedCarModel.id,
            vehicle_model: selectedCarModel.model_name,
            vehicle_variant: selectedCarModel.variant || null,
            lead_priority: 'NORMAL',
            created_at: new Date().toISOString(),
            meta: utmParams,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to create booking');
      const lead = json?.lead;

      // Success!
      toast.success('🎉 Booking confirmed! We\'ll contact you shortly.');
      
      // Clear session storage
      sessionStorage.removeItem('booking_city');
      sessionStorage.removeItem('booking_car_model');
      
      // Redirect to success page
      setTimeout(() => {
        router.push(`/booking-success?lead=${lead.lead_number}`);
      }, 1500);

    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-16">
        {/* Header */}
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-brand-secondary mb-4">
            Almost There!
          </h1>
          <p className="text-xl text-text-body">
            A few optional details to complete your booking
          </p>
        </div>

        {/* Main Form Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="p-8 md:p-12">
              
              {/* Summary Section */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                <h3 className="text-lg font-bold text-brand-secondary mb-4">Booking Summary</h3>
                <div className="space-y-2 text-sm">
                  {selectedCity && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-text-body"><strong>City:</strong> {selectedCity.name}</span>
                    </div>
                  )}
                  {selectedCarModel && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-text-body"><strong>Car:</strong> {selectedCarModel.make} {selectedCarModel.model_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Fields */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-text-body mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-primary" />
                    Your Name
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-body mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-brand-primary" />
                    Mobile Number
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                  />
                  {formData.customer_phone && formData.customer_phone.length < 10 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.customer_phone.length}/10 digits
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-body mb-2 flex items-center gap-2">
                    <Car className="w-4 h-4 text-brand-primary" />
                    Vehicle Number
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_number}
                    onChange={(e) => handleInputChange('vehicle_number', e.target.value.toUpperCase())}
                    placeholder="e.g., MH12AB1234"
                    className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-primary/20 focus:border-brand-primary transition-all uppercase"
                  />
                </div>
              </div>

              {/* Info Message */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> All fields are optional. You can skip any field and continue. 
                  We'll contact you using the provided information.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => router.back()}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all font-semibold flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  Back
                </button>
                
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-8 py-4 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-lg transition-all transform hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Complete Booking
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function BookingDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
        <Navbar />
        <div className="container mx-auto px-4 pt-32 pb-16">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          </div>
        </div>
        <Footer />
      </div>
    }>
      <BookingDetailsContent />
    </Suspense>
  );
}
