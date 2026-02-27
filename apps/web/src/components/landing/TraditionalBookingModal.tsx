'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  MapPin, Car, User, Phone, Loader2, Search, CheckCircle, 
  Navigation, ArrowRight, ArrowLeft, X, Send, Smile, PartyPopper,
  Wrench, DollarSign, Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BookingFormData {
  city: any | null;
  carModel: any | null;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  selectedServices: string[]; // Service type IDs
}

export default function TraditionalBookingModal({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [formData, setFormData] = useState<BookingFormData>({
    city: null,
    carModel: null,
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
    selectedServices: []
  });

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  // Location State
  const [cities, setCities] = useState<any[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  
  // Car Model State
  const [carModels, setCarModels] = useState<any[]>([]);
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<any[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);
  const carDropdownRef = useRef<HTMLDivElement>(null);

  // Service Types & Pricing State
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [servicePricing, setServicePricing] = useState<Record<string, number>>({});
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);

  const steps = [
    {
      id: 'step1',
      title: 'Let\'s get started!',
      subtitle: 'Select your location and car model',
      type: 'locationAndCar'
    },
    {
      id: 'step2',
      title: 'Almost there!',
      subtitle: 'Just a few more details',
      type: 'details'
    },
    {
      id: 'step3',
      title: 'Choose your services',
      subtitle: 'Select services with transparent pricing',
      type: 'pricing'
    }
  ];

  // Fetch cities and car models on mount
  useEffect(() => {
    fetchCities();
    fetchCarModels();
  }, []);

  // Auto-detect location when modal opens
  useEffect(() => {
    if (currentStep === 0 && cities.length > 0 && !formData.city) {
      autoDetectLocation();
    }
  }, [currentStep, cities.length]);

  // Fetch service types when step 3 is reached
  useEffect(() => {
    if (currentStep === 2 && formData.city && formData.carModel) {
      fetchServiceTypes();
    }
  }, [currentStep, formData.city, formData.carModel]);

  // Fetch pricing when serviceTypes are loaded
  useEffect(() => {
    if (currentStep === 2 && formData.city && formData.carModel && serviceTypes.length > 0) {
      fetchPricing();
    }
  }, [serviceTypes.length, currentStep, formData.city, formData.carModel]);

  // Filter car suggestions
  useEffect(() => {
    if (carSearchQuery.length > 0) {
      const query = carSearchQuery.toLowerCase();
      const filtered = carModels.filter((car: any) => 
        car.make.toLowerCase().includes(query) || 
        car.model_name.toLowerCase().includes(query) ||
        `${car.make} ${car.model_name}`.toLowerCase().includes(query)
      ).slice(0, 8);
      setCarSuggestions(filtered);
      setShowCarSuggestions(true);
    } else {
      setCarSuggestions([]);
      setShowCarSuggestions(false);
    }
  }, [carSearchQuery, carModels]);

  // Close car dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (carDropdownRef.current && !carDropdownRef.current.contains(event.target as Node)) {
        setShowCarSuggestions(false);
      }
    };

    if (showCarSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCarSuggestions]);

  async function fetchCities() {
    try {
      const supabase = createClient();
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching cities:', error);
        setCities([
          { id: '1', name: 'Mumbai', state: 'Maharashtra' },
          { id: '2', name: 'Pune', state: 'Maharashtra' },
          { id: '3', name: 'Bangalore', state: 'Karnataka' },
          { id: '4', name: 'Delhi', state: 'Delhi' },
        ]);
      } else {
        setCities(citiesData || []);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  }

  async function fetchCarModels() {
    try {
      const supabase = createClient();
      const { data: modelsData, error } = await supabase
        .from('car_models')
        .select('id, make, model_name, variant, class')
        .eq('is_active', true)
        .order('make')
        .order('model_name');
      
      if (error) {
        console.error('Error fetching car models:', error);
        setCarModels([]);
      } else {
        setCarModels(modelsData || []);
      }
    } catch (error) {
      console.error('Error fetching car models:', error);
    }
  }

  async function fetchServiceTypes() {
    setLoadingServiceTypes(true);
    try {
      const supabase = createClient();
      const { data: servicesData, error } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching service types:', error);
        toast.error('Failed to load services. Please try again.');
        setServiceTypes([]);
      } else {
        // Add base_price as 0 if not present in response
        const servicesWithPrice = (servicesData || []).map(service => ({
          ...service,
          base_price: 0 // Default base price
        }));
        setServiceTypes(servicesWithPrice);
      }
    } catch (error) {
      console.error('Error fetching service types:', error);
      toast.error('Failed to load services. Please try again.');
      setServiceTypes([]);
    } finally {
      setLoadingServiceTypes(false);
    }
  }

  async function fetchPricing() {
    if (!formData.city || !formData.carModel || serviceTypes.length === 0) {
      console.log('fetchPricing: Missing requirements', {
        city: formData.city,
        carModel: formData.carModel,
        serviceTypesCount: serviceTypes.length
      });
      return;
    }

    setLoadingPricing(true);
    try {
      const supabase = createClient();
      const cityId = formData.city.id;
      const vehicleClass = formData.carModel.class || null;
      
      console.log('fetchPricing: Starting', { cityId, vehicleClass, serviceTypesCount: serviceTypes.length });
      
      // Get city's zone_id if available
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('zone_id')
        .eq('id', cityId)
        .single();

      if (cityError) {
        console.error('Error fetching city zone:', cityError);
      }

      const zoneId = cityData?.zone_id || null;
      console.log('City zone_id:', zoneId);

      // Fetch pricing for all service types
      // Priority: city_id + class > city_id > zone_id + class > zone_id > class > default (base_price)
      const pricingMap: Record<string, number> = {};

      for (const service of serviceTypes) {
        let price = null;

        // Priority 1: City + Class (most specific) - Get first matching price
        if (vehicleClass) {
          const { data: cityClassPrices, error: cityClassError } = await supabase
            .from('workshop_service_pricing')
            .select('custom_price')
            .eq('service_type_id', service.id)
            .eq('city_id', cityId)
            .eq('class', vehicleClass)
            .eq('is_active', true)
            .limit(1);
          
          if (cityClassError) {
            console.error(`Error fetching city+class pricing for ${service.name}:`, cityClassError);
          }
          
          if (cityClassPrices && cityClassPrices.length > 0 && cityClassPrices[0]?.custom_price) {
            price = parseFloat(cityClassPrices[0].custom_price);
            console.log(`Found city+class price for ${service.name}:`, price);
          }
        }

        // Priority 2: City only (if city+class not found)
        if (!price) {
          const { data: cityPrices, error: cityError } = await supabase
            .from('workshop_service_pricing')
            .select('custom_price')
            .eq('service_type_id', service.id)
            .eq('city_id', cityId)
            .is('class', null)
            .eq('is_active', true)
            .limit(1);
          
          if (cityError) {
            console.error(`Error fetching city pricing for ${service.name}:`, cityError);
          }
          
          if (cityPrices && cityPrices.length > 0 && cityPrices[0]?.custom_price) {
            price = parseFloat(cityPrices[0].custom_price);
            console.log(`Found city price for ${service.name}:`, price);
          }
        }

        // Priority 3: Zone + Class (if city pricing not found)
        if (!price && zoneId && vehicleClass) {
          const { data: zoneClassPrices, error: zoneClassError } = await supabase
            .from('workshop_service_pricing')
            .select('custom_price')
            .eq('service_type_id', service.id)
            .eq('zone_id', zoneId)
            .eq('class', vehicleClass)
            .eq('is_active', true)
            .limit(1);
          
          if (zoneClassError) {
            console.error(`Error fetching zone+class pricing for ${service.name}:`, zoneClassError);
          }
          
          if (zoneClassPrices && zoneClassPrices.length > 0 && zoneClassPrices[0]?.custom_price) {
            price = parseFloat(zoneClassPrices[0].custom_price);
            console.log(`Found zone+class price for ${service.name}:`, price);
          }
        }

        // Priority 4: Zone only (if zone+class not found)
        if (!price && zoneId) {
          const { data: zonePrices, error: zoneError } = await supabase
            .from('workshop_service_pricing')
            .select('custom_price')
            .eq('service_type_id', service.id)
            .eq('zone_id', zoneId)
            .is('class', null)
            .eq('is_active', true)
            .limit(1);
          
          if (zoneError) {
            console.error(`Error fetching zone pricing for ${service.name}:`, zoneError);
          }
          
          if (zonePrices && zonePrices.length > 0 && zonePrices[0]?.custom_price) {
            price = parseFloat(zonePrices[0].custom_price);
            console.log(`Found zone price for ${service.name}:`, price);
          }
        }

        // Priority 5: Class only (if zone pricing not found)
        if (!price && vehicleClass) {
          const { data: classPrices, error: classError } = await supabase
            .from('workshop_service_pricing')
            .select('custom_price')
            .eq('service_type_id', service.id)
            .eq('class', vehicleClass)
            .is('city_id', null)
            .is('zone_id', null)
            .eq('is_active', true)
            .limit(1);
          
          if (classError) {
            console.error(`Error fetching class pricing for ${service.name}:`, classError);
          }
          
          if (classPrices && classPrices.length > 0 && classPrices[0]?.custom_price) {
            price = parseFloat(classPrices[0].custom_price);
            console.log(`Found class price for ${service.name}:`, price);
          }
        }

        // Priority 6: Fallback to base_price from service_types (default 0)
        if (!price) {
          price = parseFloat(service.base_price || '0');
          console.log(`Using default price for ${service.name}:`, price);
        }

        pricingMap[service.id] = Math.round(price);
      }

      console.log('Final pricing map:', pricingMap);
      setServicePricing(pricingMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      // Fallback: use base_price for all services
      const fallbackPricing: Record<string, number> = {};
      serviceTypes.forEach(service => {
        fallbackPricing[service.id] = parseFloat(service.base_price || '0');
      });
      setServicePricing(fallbackPricing);
    } finally {
      setLoadingPricing(false);
    }
  }

  async function autoDetectLocation() {
    if (cities.length === 0) return;

    setIsDetectingLocation(true);
    
    // Check localStorage first
    const storedCity = localStorage.getItem('detected_city');
    if (storedCity) {
      const matchedCity = cities.find(c => 
        c.name.toLowerCase() === storedCity.toLowerCase() ||
        c.name.toLowerCase().includes(storedCity.toLowerCase())
      );
      if (matchedCity) {
        setFormData(prev => ({ ...prev, city: matchedCity }));
        setIsDetectingLocation(false);
        return;
      }
    }

    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
              );
              
              if (response.ok) {
                const data = await response.json();
                const address = data.address || {};
                const cityName = 
                  address.city || 
                  address.town || 
                  address.village || 
                  address.county || 
                  null;
                
                if (cityName && cities.length > 0) {
                  let matchedCity = cities.find(c => 
                    c.name.toLowerCase() === cityName.toLowerCase()
                  );
                  
                  if (!matchedCity) {
                    matchedCity = cities.find(c => 
                      c.name.toLowerCase().includes(cityName.toLowerCase()) ||
                      cityName.toLowerCase().includes(c.name.toLowerCase())
                    );
                  }
                  
                  if (matchedCity) {
                    setFormData(prev => ({ ...prev, city: matchedCity }));
                    localStorage.setItem('detected_city', matchedCity.name);
                  }
                }
              }
            } catch (error) {
              console.error('Reverse geocoding error:', error);
            } finally {
              setIsDetectingLocation(false);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            setIsDetectingLocation(false);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000
          }
        );
      } else {
        setIsDetectingLocation(false);
      }
    } catch (error) {
      console.error('Location detection error:', error);
      setIsDetectingLocation(false);
    }
  }

  const handleCitySelect = (city: any) => {
    setFormData(prev => ({ ...prev, city }));
    localStorage.setItem('detected_city', city.name);
  };

  const handleCarSelect = (car: any) => {
    setFormData(prev => ({ ...prev, carModel: car }));
    setCarSearchQuery(`${car.make} ${car.model_name}`);
    setShowCarSuggestions(false);
  };

  const handleInputChange = (field: keyof BookingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    // Step 1 validation: City and Car Model required
    if (currentStep === 0) {
      if (!formData.city) {
        toast.error('Please select your city');
        return;
      }
      if (!formData.carModel) {
        toast.error('Please select your car model');
        return;
      }
    }

    // Step 2 validation: Name and Phone required
    if (currentStep === 1) {
      if (!formData.customerName.trim()) {
        toast.error('Please enter your name');
        return;
      }
      if (!formData.customerPhone.trim() || formData.customerPhone.length !== 10) {
        toast.error('Please enter a valid 10-digit phone number');
        return;
      }
    }

    // Step 3 validation: At least one service required
    if (currentStep === 2) {
      if (formData.selectedServices.length === 0) {
        toast.error('Please select at least one service');
        return;
      }
    }

    setIsAnimating(true);
    setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
      } else {
        handleSubmit();
      }
      setIsAnimating(false);
    }, 300);
  };

  const handleBack = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(Math.max(0, currentStep - 1));
      setIsAnimating(false);
    }, 300);
  };

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Please enter a coupon code.');
      return;
    }
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          lead_context: {
            subtotal: totalPrice,
            service_type_ids: formData.selectedServices,
            service_items: serviceItemsForCoupon,
            customer_phone: formData.customerPhone,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.valid) {
        throw new Error(json?.error || 'Coupon validation failed.');
      }
      setCouponMeta(json.coupon_meta || null);
      setCouponDiscount(Number(json.discount_amount || 0));
      setCouponError(null);
      toast.success('Coupon applied.');
    } catch (error: any) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError(error?.message || 'Invalid coupon.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const clearCoupon = () => {
    setCouponCode('');
    setCouponMeta(null);
    setCouponDiscount(0);
    setCouponError(null);
  };

  const handleSubmit = async () => {
    if (!formData.city || !formData.carModel || !formData.customerName || !formData.customerPhone) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;

      const response = await fetch('/api/public/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: {
            lead_number: leadNumber,
            created_from: 'WEB',
            status: 'NEW',
            lead_type: 'NORMAL',
            lead_source: 'Website',
            customer_name: formData.customerName,
            customer_phone: formData.customerPhone,
            vehicle_number: formData.vehicleNumber || null,
            city: formData.city.name,
            city_id: formData.city.id,
            vehicle_make: formData.carModel.make,
            model_id: formData.carModel.id,
            vehicle_model: formData.carModel.model_name,
            vehicle_variant: formData.carModel.variant || null,
            lead_priority: 'NORMAL',
            estimated_amount: totalPrice > 0 ? totalPrice : null,
            created_at: new Date().toISOString(),
          },
          coupon: couponMeta
            ? {
                code: couponCode,
                lead_context: {
                  subtotal: totalPrice,
                  service_type_ids: formData.selectedServices,
                  service_items: serviceItemsForCoupon,
                  customer_phone: formData.customerPhone,
                },
              }
            : undefined,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json?.error || 'Failed to create booking');
      }
      const lead = json?.lead;

      setTimeout(() => {
        setIsSubmitting(false);
        setTimeout(() => {
          toast.success('🎉 Booking confirmed! We\'ll contact you shortly.');
          onClose();
          window.location.href = `/booking-success?lead=${lead.lead_number}`;
        }, 1500);
      }, 1000);
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking. Please try again.');
      setIsSubmitting(false);
    }
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  
  const canProceed = currentStep === 0 
    ? formData.city !== null && formData.carModel !== null
    : currentStep === 1
    ? formData.customerName.trim() !== '' && formData.customerPhone.trim().length === 10
    : formData.selectedServices.length > 0;

  const totalPrice = formData.selectedServices.reduce((sum, serviceId) => {
    return sum + (servicePricing[serviceId] || 0);
  }, 0);

  const serviceItemsForCoupon = formData.selectedServices.map((serviceId) => {
    const service = serviceTypes.find((s: any) => s.id === serviceId);
    return {
      service_type_id: serviceId,
      label: service?.name || null,
      price: servicePricing[serviceId] || 0,
    };
  });

  const couponAdjustedTotal = Math.max(totalPrice - (couponDiscount || 0), 0);

  useEffect(() => {
    if (couponMeta && formData.selectedServices.length > 0) {
      setCouponMeta(null);
      setCouponDiscount(0);
      setCouponError('Coupon cleared. Please re-apply after changing services.');
    }
  }, [formData.selectedServices, couponMeta]);

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedServices.includes(serviceId);
      return {
        ...prev,
        selectedServices: isSelected
          ? prev.selectedServices.filter(id => id !== serviceId)
          : [...prev.selectedServices, serviceId]
      };
    });
  };

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary flex items-center justify-center">
            <PartyPopper className="w-10 h-10 text-white animate-bounce" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Submitting your booking...</h3>
          <p className="text-gray-600 mb-6">Please wait a moment</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full animate-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full relative overflow-hidden">
        {/* Progress Bar */}
        <div className="h-1 bg-gray-100">
          <div 
            className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Form Content */}
        <div className="p-8 md:p-12">
          {/* Step Counter */}
          <div className="text-right mb-8">
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Step Content */}
          <div className={`min-h-[400px] flex flex-col justify-center ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-300`}>
            {/* Title & Subtitle */}
            <div className="mb-12">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
                {currentStepData.title}
              </h2>
              <p className="text-lg text-gray-600">
                {currentStepData.subtitle}
              </p>
            </div>

            {/* Step 1: Location + Car Model */}
            {currentStep === 0 && (
              <div className="mb-12 space-y-8">
                {/* Location Section */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Select City</h3>
                  </div>

                  {isDetectingLocation && (
                    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-brand-primary animate-spin" />
                        <p className="text-sm text-blue-700 font-medium">Detecting your location...</p>
                      </div>
                    </div>
                  )}

                  {formData.city && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="text-sm text-green-800 font-medium">
                          Location: <strong>{formData.city.name}</strong>
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {cities.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => handleCitySelect(city)}
                        className={`p-3 rounded-xl border-2 transition-all transform hover:scale-105 ${
                          formData.city?.id === city.id
                            ? 'border-brand-primary bg-gradient-to-br from-brand-primary to-brand-secondary text-white shadow-lg'
                            : 'border-gray-200 bg-white text-text-body hover:border-brand-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2">
                          <MapPin className={`w-4 h-4 ${
                            formData.city?.id === city.id ? 'text-white' : 'text-brand-primary'
                          }`} />
                          <span className="font-semibold text-sm">{city.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={autoDetectLocation}
                    disabled={isDetectingLocation}
                    className="w-full px-4 py-2 bg-white border-2 border-brand-primary text-brand-primary rounded-xl font-semibold hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    {isDetectingLocation ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      <>
                        <Navigation className="w-4 h-4" />
                        Auto Detect Location
                      </>
                    )}
                  </button>
                </div>

                {/* Car Model Section */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                      <Car className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Select Car Model</h3>
                  </div>

                  <div className="relative" ref={carDropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
                      <input
                        type="text"
                        value={carSearchQuery}
                        onChange={(e) => {
                          setCarSearchQuery(e.target.value);
                          if (formData.carModel && e.target.value !== `${formData.carModel.make} ${formData.carModel.model_name}`) {
                            setFormData(prev => ({ ...prev, carModel: null }));
                          }
                        }}
                        onFocus={() => {
                          if (carSearchQuery.length > 0) {
                            setShowCarSuggestions(true);
                          }
                        }}
                        placeholder="Enter Model (e.g. Swift, City, Creta)"
                        className={`w-full pl-14 pr-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                          formData.carModel
                            ? 'border-brand-primary bg-brand-primary/5'
                            : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                        }`}
                        autoFocus
                      />
                      {formData.carModel && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        </div>
                      )}
                    </div>

                    {showCarSuggestions && carSuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto">
                        {carSuggestions.map((car) => (
                          <button
                            key={car.id}
                            type="button"
                            onClick={() => handleCarSelect(car)}
                            className="w-full px-4 py-4 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-text-body">{car.make}</p>
                                <p className="text-sm text-gray-600">
                                  {car.model_name} {car.variant ? `(${car.variant})` : ''}
                                </p>
                              </div>
                              <ArrowRight className="w-5 h-5 text-gray-400" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {formData.carModel && (
                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <p className="text-sm text-green-800 font-medium">
                          Selected: <strong>{formData.carModel.make} {formData.carModel.model_name}</strong>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Name, Phone, Vehicle Number */}
            {currentStep === 1 && (
              <div className="mb-12 space-y-6">
                {/* Name - Required */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <User className="w-4 h-4 text-brand-primary" />
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    placeholder="Enter your full name"
                    className={`w-full px-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      formData.customerName
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                    }`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceed) {
                        handleNext();
                      }
                    }}
                  />
                  {formData.customerName && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 mt-6">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  )}
                </div>

                {/* Phone - Required */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-brand-primary" />
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className={`w-full px-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      formData.customerPhone && formData.customerPhone.length === 10
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceed) {
                        handleNext();
                      }
                    }}
                  />
                  {formData.customerPhone && formData.customerPhone.length === 10 && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 mt-6">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  )}
                  {formData.customerPhone && formData.customerPhone.length < 10 && (
                    <p className="mt-1 text-xs text-gray-500">
                      {formData.customerPhone.length}/10 digits
                    </p>
                  )}
                </div>

                {/* Vehicle Number - Optional */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Car className="w-4 h-4 text-brand-primary" />
                    Vehicle Number
                    <span className="text-xs text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vehicleNumber}
                    onChange={(e) => handleInputChange('vehicleNumber', e.target.value.toUpperCase())}
                    placeholder="e.g., MH12AB1234"
                    className={`w-full px-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all uppercase ${
                      formData.vehicleNumber
                        ? 'border-brand-primary bg-brand-primary/5'
                        : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                    }`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceed) {
                        handleNext();
                      }
                    }}
                  />
                  {formData.vehicleNumber && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 mt-6">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">Optional</span>
                    You can skip this field
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Service Selection with Pricing */}
            {currentStep === 2 && (
              <div className="mb-12">
                {loadingServiceTypes || loadingPricing ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-gray-600">Loading services and pricing...</p>
                  </div>
                ) : serviceTypes.length === 0 ? (
                  <div className="text-center py-12">
                    <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No services available at the moment.</p>
                    <p className="text-sm text-gray-500 mt-2">Please try again later.</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Card */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-bold text-brand-secondary">{formData.city?.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Vehicle</p>
                          <p className="font-bold text-brand-secondary">
                            {formData.carModel?.make} {formData.carModel?.model_name}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Service Types Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {serviceTypes.map((service) => {
                        const isSelected = formData.selectedServices.includes(service.id);
                        const price = servicePricing[service.id] || service.base_price || 0;
                        
                        return (
                          <button
                            key={service.id}
                            onClick={() => handleServiceToggle(service.id)}
                            className={`p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                              isSelected
                                ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                                : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                                    : 'bg-gray-100'
                                }`}>
                                  <Wrench className={`w-6 h-6 ${
                                    isSelected ? 'text-white' : 'text-gray-600'
                                  }`} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-lg text-gray-900">{service.name}</h3>
                                  {service.description && (
                                    <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                                  )}
                                </div>
                              </div>
                              {isSelected && (
                                <CheckCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                              <span className="text-xs text-gray-500">Price</span>
                              <span className="text-2xl font-bold text-brand-primary">
                                ₹{price.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Total Price Display */}
                    {formData.selectedServices.length > 0 && (
                      <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <DollarSign className="w-6 h-6 text-green-600" />
                            <div>
                              <p className="text-sm text-gray-600">Total Price</p>
                              <p className="text-3xl font-bold text-green-700">
                                ₹{couponAdjustedTotal.toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              {formData.selectedServices.length} service{formData.selectedServices.length > 1 ? 's' : ''} selected
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              <Sparkles className="w-3 h-3 inline" /> City & class-based pricing
                            </p>
                          </div>
                        </div>
                        {couponMeta && (
                          <div className="mt-3 text-xs text-green-700">
                            Coupon {couponMeta.code} applied — discount ₹{Number(couponDiscount || 0).toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Coupon */}
                    <div className="mt-4 p-4 border rounded-xl bg-white">
                      <div className="text-sm font-semibold text-gray-900 mb-2">Apply Coupon</div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Enter coupon code"
                          className="flex-1 px-3 py-2 border rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={isValidatingCoupon || !couponCode.trim()}
                          className="px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {isValidatingCoupon ? 'Applying...' : 'Apply'}
                        </button>
                        {couponMeta && (
                          <button
                            type="button"
                            onClick={clearCoupon}
                            className="px-3 py-2 rounded-lg border text-sm font-semibold"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {couponError && <div className="text-xs text-red-600 mt-2">{couponError}</div>}
                      {couponMeta && (
                        <div className="text-xs text-green-700 mt-2">
                          Coupon applied: <strong>{couponMeta.code}</strong>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-gray-100">
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  currentStep === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceed}
                className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
                  canProceed
                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:shadow-2xl hover:shadow-brand-primary/50 hover:scale-105 active:scale-95'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isLastStep ? (
                  <>
                    <Send className="w-5 h-5" />
                    Submit Booking
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Fun Emoji Indicator */}
            {canProceed && !isLastStep && (
              <div className="text-center mt-8 animate-fade-in">
                <Smile className="w-8 h-8 text-yellow-400 mx-auto animate-bounce" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
