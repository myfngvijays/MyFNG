'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { createClient } from '@/lib/supabase/client';
import { loadRazorpayScript } from '@/lib/services/paymentService';
import { 
  MapPin, Car, User, Phone, Loader2, Search, CheckCircle, 
  Navigation, ArrowRight, ArrowLeft, Send, Smile, PartyPopper,
  Wrench, DollarSign, Sparkles, Calendar, Clock, MapPin as AddressIcon,
  CreditCard, Wallet, Smartphone, Banknote
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BookingFormData {
  city: any | null;
  carModel: any | null;
  customerName: string;
  customerPhone: string;
  vehicleNumber: string;
  selectedServices: string[]; // Service type IDs
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  paymentMethod: string;
  paymentStatus: string; // 'PAY_NOW' | 'PAY_LATER'
}

export default function BookServicePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const [formData, setFormData] = useState<BookingFormData>({
    city: null,
    carModel: null,
    customerName: '',
    customerPhone: '',
    vehicleNumber: '',
    selectedServices: [],
    pickupDate: '',
    pickupTime: '',
    pickupAddress: '',
    paymentMethod: '',
    paymentStatus: 'PAY_LATER'
  });

  // Location State
  const [cities, setCities] = useState<any[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isDetectingAddress, setIsDetectingAddress] = useState(false);
  
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
  
  // Payment State
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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
    },
    {
      id: 'step4',
      title: 'Pickup Details',
      subtitle: 'When and where should we pick up your vehicle?',
      type: 'pickup'
    },
    {
      id: 'step5',
      title: 'Payment Options',
      subtitle: 'Choose your preferred payment method',
      type: 'payment'
    }
  ];

  // Fetch cities and car models on mount (in parallel)
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchCities(), fetchCarModels()]);
    };
    loadData();
  }, []);

  // Load Razorpay script when component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      loadRazorpayScript().then((loaded) => {
        setRazorpayLoaded(loaded);
        if (!loaded) {
          console.warn('Razorpay script failed to load');
        }
      });
    }
  }, []);

  // Auto-detect location when step 1 is active (only once)
  useEffect(() => {
    if (currentStep === 0 && cities.length > 0 && !formData.city) {
      const timer = setTimeout(() => {
        autoDetectLocation();
      }, 500); // Small delay to avoid blocking initial render
      return () => clearTimeout(timer);
    }
  }, [currentStep, cities.length]);

  // Fetch service types and pricing when step 3 is reached
  useEffect(() => {
    if (currentStep === 2 && formData.city && formData.carModel) {
      fetchServiceTypes().then(() => {
        // Pricing will be fetched after serviceTypes are loaded
      });
    }
  }, [currentStep, formData.city?.id, formData.carModel?.id]);

  // Fetch pricing when serviceTypes are loaded (debounced)
  useEffect(() => {
    if (currentStep === 2 && formData.city && formData.carModel && serviceTypes.length > 0) {
      const timer = setTimeout(() => {
        fetchPricing();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [serviceTypes.length, currentStep, formData.city?.id, formData.carModel?.id]);

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
      console.log('🚗 Fetching car models from database...');
      const supabase = createClient();
      const { data: modelsData, error } = await supabase
        .from('car_models')
        .select('id, make, model_name, variant, class')
        .eq('is_active', true)
        .order('make')
        .order('model_name');
      
      if (error) {
        console.error('❌ Error fetching car models:', error);
        console.error('Error details:', { message: error.message, code: error.code, details: error.details });
        setCarModels([]);
      } else {
        console.log(`✅ Car models fetched successfully: ${modelsData?.length || 0} models`);
        setCarModels(modelsData || []);
      }
    } catch (error) {
      console.error('❌ Exception fetching car models:', error);
      setCarModels([]);
    }
  }

  async function fetchServiceTypes() {
    setLoadingServiceTypes(true);
    try {
      const supabase = createClient();
      // Fetch all active services and filter for the 4 we need
      const { data: servicesData, error } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true);
      
      if (error) {
        console.error('Error fetching service types:', error);
        toast.error('Failed to load services. Please try again.');
        setServiceTypes([]);
      } else {
        // Filter and sort in specific order: Basic Service, General, Premium, Platinum
        const servicePatterns = [
          { pattern: /basic service/i, order: 1, points: 15 },
          { pattern: /general service/i, order: 2, points: 30 },
          { pattern: /premium service/i, order: 3, points: 50 },
          { pattern: /platinum service/i, order: 4, points: 60 }
        ];
        
        const matchedServices = (servicesData || [])
          .map(service => {
            const match = servicePatterns.find(sp => sp.pattern.test(service.name));
            if (match) {
              return {
                ...service,
                order: match.order,
                points: match.points
              };
            }
            return null;
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.order - b.order) as any[];
        
        setServiceTypes(matchedServices);
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
      return;
    }

    setLoadingPricing(true);
    try {
      const supabase = createClient();
      const cityId = formData.city.id;
      const vehicleClass = formData.carModel.class || null;
      
      // Get city's zone_id if available
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('zone_id')
        .eq('id', cityId)
        .maybeSingle();

      const zoneId = cityData?.zone_id || null;

      // Simplified pricing: city + class > city > zone + class > zone > class > default
      const pricingMap: Record<string, number> = {};

      // Fetch all pricing in parallel for better performance
      const pricingPromises = serviceTypes.map(async (service) => {
        let price = null;

        try {
          // Priority 1: City + Class
          if (vehicleClass) {
            const { data, error } = await supabase
              .from('workshop_service_pricing')
              .select('custom_price')
              .eq('service_type_id', service.id)
              .eq('city_id', cityId)
              .eq('class', vehicleClass)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (!error && data?.custom_price) {
              price = parseFloat(data.custom_price);
            }
          }

          // Priority 2: City only
          if (!price) {
            const { data, error } = await supabase
              .from('workshop_service_pricing')
              .select('custom_price')
              .eq('service_type_id', service.id)
              .eq('city_id', cityId)
              .is('class', null)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (!error && data?.custom_price) {
              price = parseFloat(data.custom_price);
            }
          }

          // Priority 3: Zone + Class
          if (!price && zoneId && vehicleClass) {
            const { data, error } = await supabase
              .from('workshop_service_pricing')
              .select('custom_price')
              .eq('service_type_id', service.id)
              .eq('zone_id', zoneId)
              .eq('class', vehicleClass)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (!error && data?.custom_price) {
              price = parseFloat(data.custom_price);
            }
          }

          // Priority 4: Zone only
          if (!price && zoneId) {
            const { data, error } = await supabase
              .from('workshop_service_pricing')
              .select('custom_price')
              .eq('service_type_id', service.id)
              .eq('zone_id', zoneId)
              .is('class', null)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (!error && data?.custom_price) {
              price = parseFloat(data.custom_price);
            }
          }

          // Priority 5: Class only
          if (!price && vehicleClass) {
            const { data, error } = await supabase
              .from('workshop_service_pricing')
              .select('custom_price')
              .eq('service_type_id', service.id)
              .eq('class', vehicleClass)
              .is('city_id', null)
              .is('zone_id', null)
              .eq('is_active', true)
              .limit(1)
              .maybeSingle();
            
            if (!error && data?.custom_price) {
              price = parseFloat(data.custom_price);
            }
          }
        } catch (err) {
          // Silently handle errors - use default price
          console.debug(`Pricing fetch error for ${service.name}:`, err);
        }

        // Default: 0 if no pricing found
        return { serviceId: service.id, price: price || 0 };
      });

      const results = await Promise.allSettled(pricingPromises);
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const { serviceId, price } = result.value;
          pricingMap[serviceId] = Math.round(price);
        } else {
          // If a promise failed, use default price of 0
          console.debug('Pricing promise failed:', result.reason);
        }
      });

      // Set default price of 0 for any services that weren't processed
      serviceTypes.forEach(service => {
        if (!(service.id in pricingMap)) {
          pricingMap[service.id] = 0;
        }
      });

      setServicePricing(pricingMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
      // Fallback: set all prices to 0
      const fallbackPricing: Record<string, number> = {};
      serviceTypes.forEach(service => {
        fallbackPricing[service.id] = 0;
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

  async function autoDetectAddress() {
    setIsDetectingAddress(true);
    
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
              );
              
              if (response.ok) {
                const data = await response.json();
                const address = data.address || {};
                
                // Build full address string
                const addressParts = [];
                if (address.house_number) addressParts.push(address.house_number);
                if (address.road) addressParts.push(address.road);
                if (address.neighbourhood) addressParts.push(address.neighbourhood);
                if (address.suburb) addressParts.push(address.suburb);
                if (address.city || address.town || address.village) {
                  addressParts.push(address.city || address.town || address.village);
                }
                if (address.state_district) addressParts.push(address.state_district);
                if (address.state) addressParts.push(address.state);
                if (address.postcode) addressParts.push(address.postcode);
                
                const fullAddress = addressParts.join(', ');
                
                if (fullAddress) {
                  setFormData(prev => ({ ...prev, pickupAddress: fullAddress }));
                  toast.success('Address detected successfully!');
                } else {
                  toast.error('Could not detect address. Please enter manually.');
                }
              } else {
                toast.error('Failed to fetch address. Please enter manually.');
              }
            } catch (error) {
              console.error('Reverse geocoding error:', error);
              toast.error('Failed to detect address. Please enter manually.');
            } finally {
              setIsDetectingAddress(false);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            toast.error('Location access denied. Please enter address manually.');
            setIsDetectingAddress(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        toast.error('Geolocation not supported. Please enter address manually.');
        setIsDetectingAddress(false);
      }
    } catch (error) {
      console.error('Address detection error:', error);
      toast.error('Failed to detect address. Please enter manually.');
      setIsDetectingAddress(false);
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

    // Step 4 validation: Pickup details required
    if (currentStep === 3) {
      if (!formData.pickupDate) {
        toast.error('Please select a pickup date');
        return;
      }
      if (!formData.pickupTime) {
        toast.error('Please select a pickup time');
        return;
      }
      if (!formData.pickupAddress.trim()) {
        toast.error('Please enter pickup address');
        return;
      }
    }

    // Step 5 validation: Payment method required
    if (currentStep === 4) {
      if (!formData.paymentMethod) {
        toast.error('Please select a payment method');
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

  const createLead = async (paymentData?: any) => {
    const supabase = createClient();
    const leadNumber = `L-${Date.now().toString().slice(-8)}`;

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .insert([{
        lead_number: leadNumber,
        created_from: 'WEB',
        status: 'NEW',
        customer_name: formData.customerName,
        customer_phone: formData.customerPhone,
        vehicle_number: formData.vehicleNumber || null,
        city: formData.city.name,
        city_id: formData.city.id,
        vehicle_make: formData.carModel.make,
        model_id: formData.carModel.id,
        vehicle_model: formData.carModel.model_name,
        vehicle_variant: formData.carModel.variant || null,
        service_type_ids: formData.selectedServices.length > 0 ? formData.selectedServices : null,
        address: formData.pickupAddress,
        customer_address: formData.pickupAddress,
        estimated_amount: totalPrice > 0 ? totalPrice : null,
        lead_priority: 'NORMAL',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (leadError) throw leadError;
    return lead;
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment gateway is loading. Please wait...');
      return;
    }

    if (totalPrice <= 0) {
      toast.error('Invalid amount. Please select services.');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Create payment order
      const response = await fetch('/api/payments/create-booking-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalPrice,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          customerEmail: '', // Optional
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment order');
      }

      const { order } = await response.json();

      // Initialize Razorpay checkout with custom verification
      if (typeof window === 'undefined' || !(window as any).Razorpay) {
        toast.error('Payment gateway not available. Please refresh the page.');
        setIsProcessingPayment(false);
        return;
      }

      const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!RAZORPAY_KEY_ID) {
        toast.error('Payment gateway not configured.');
        setIsProcessingPayment(false);
        return;
      }

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'MyFNG Workshop',
        description: 'Service Booking Payment',
        order_id: order.orderId,
        handler: async function (response: any) {
          // Verify payment using booking verification endpoint
          try {
            const verifyResponse = await fetch('/api/payments/verify-booking', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.verified) {
              // Payment successful - create lead
              try {
                const lead = await createLead(response);
                setIsProcessingPayment(false);
                setIsSubmitting(false);
                toast.success('🎉 Payment successful! Booking confirmed.');
                router.push(`/booking-success?lead=${lead.lead_number}&payment=success`);
              } catch (error: any) {
                console.error('Error creating lead after payment:', error);
                toast.error('Payment successful but failed to create booking. Please contact support.');
                setIsProcessingPayment(false);
                setIsSubmitting(false);
              }
            } else {
              toast.error('Payment verification failed. Please contact support.');
              setIsProcessingPayment(false);
            }
          } catch (error: any) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed. Please contact support.');
            setIsProcessingPayment(false);
          }
        },
        prefill: {
          name: formData.customerName,
          email: '', // Optional
          contact: formData.customerPhone,
        },
        theme: {
          color: '#3B82F6', // Brand primary color
        },
        modal: {
          ondismiss: function () {
            toast.error('Payment cancelled');
            setIsProcessingPayment(false);
          },
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      toast.error(error.message || 'Failed to initialize payment. Please try again.');
      setIsProcessingPayment(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.city || !formData.carModel || !formData.customerName || !formData.customerPhone || 
        !formData.pickupDate || !formData.pickupTime || !formData.pickupAddress || !formData.paymentMethod) {
      toast.error('Please complete all required fields');
      return;
    }

    // If Pay Now is selected, initiate payment
    if (formData.paymentStatus === 'PAY_NOW' && totalPrice > 0) {
      await handlePayment();
      return;
    }

    // If Pay Later, create lead directly
    setIsSubmitting(true);
    
    try {
      const lead = await createLead();
      
      setTimeout(() => {
        setIsSubmitting(false);
        toast.success('🎉 Booking confirmed! We\'ll contact you shortly.');
        router.push(`/booking-success?lead=${lead.lead_number}`);
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
    : currentStep === 2
    ? formData.selectedServices.length > 0
    : currentStep === 3
    ? formData.pickupDate !== '' && formData.pickupTime !== '' && formData.pickupAddress.trim() !== ''
    : formData.paymentMethod !== '';

  const totalPrice = formData.selectedServices.reduce((sum, serviceId) => {
    return sum + (servicePricing[serviceId] || 0);
  }, 0);
                  
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Progress Bar */}
            <div className="h-2 bg-gray-100">
              <div 
                className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            
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
                                      {service.points && (
                                        <p className="text-sm text-brand-primary font-semibold mt-1">
                                          {service.points} Points
                                        </p>
                                      )}
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
                                    {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'Price on request'}
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
                                    ₹{totalPrice.toLocaleString('en-IN')}
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
                </div>
              )}
                      </>
                    )}
                </div>
              )}

              {/* Step 4: Pickup Details */}
              {currentStep === 3 && (
                <div className="mb-12 space-y-6">
                  {/* Pickup Date */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-brand-primary" />
                      Pickup Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.pickupDate}
                      onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full px-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                        formData.pickupDate
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
                    {formData.pickupDate && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 mt-6">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </div>
                    )}
                  </div>

                  {/* Pickup Time */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-primary" />
                      Pickup Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.pickupTime}
                      onChange={(e) => handleInputChange('pickupTime', e.target.value)}
                      className={`w-full px-4 py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                        formData.pickupTime
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && canProceed) {
                          handleNext();
                        }
                      }}
                    />
                    {formData.pickupTime && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 mt-6">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </div>
                    )}
                  </div>

                  {/* Pickup Address */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <AddressIcon className="w-4 h-4 text-brand-primary" />
                        Pickup Address <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={autoDetectAddress}
                        disabled={isDetectingAddress}
                        className="text-xs text-brand-primary hover:text-brand-secondary font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        {isDetectingAddress ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Detecting...
                          </>
                        ) : (
                          <>
                            <Navigation className="w-3 h-3" />
                            Auto Detect
                          </>
                        )}
                      </button>
                    </div>
                    
                    {isDetectingAddress && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                          <p className="text-xs text-blue-700 font-medium">Detecting your current location...</p>
                        </div>
                      </div>
                    )}
                    
                    <textarea
                      value={formData.pickupAddress}
                      onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                      placeholder="Enter complete address with landmark or click 'Auto Detect'"
                      rows={4}
                      className={`w-full px-4 py-5 text-lg border-2 rounded-xl focus:ring-2 outline-none transition-all resize-none ${
                        formData.pickupAddress
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey && canProceed) {
                          handleNext();
                        }
                      }}
                    />
                    {formData.pickupAddress && (
                      <div className="absolute right-4 top-20">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      Include street, area, landmark for easy pickup. You can edit the auto-detected address.
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <h4 className="font-bold text-gray-900 mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Location:</span>
                        <span className="font-semibold">{formData.city?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vehicle:</span>
                        <span className="font-semibold">{formData.carModel?.make} {formData.carModel?.model_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Services:</span>
                        <span className="font-semibold">{formData.selectedServices.length} selected</span>
                      </div>
                      {formData.pickupDate && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Pickup:</span>
                          <span className="font-semibold">
                            {new Date(formData.pickupDate).toLocaleDateString('en-IN', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })} at {formData.pickupTime}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Payment Options */}
              {currentStep === 4 && (
                <div className="mb-12 space-y-6">
                  {/* Payment Method Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-brand-primary" />
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Cash Payment */}
                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentMethod', 'CASH')}
                        className={`p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                          formData.paymentMethod === 'CASH'
                            ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                            formData.paymentMethod === 'CASH'
                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                              : 'bg-gray-100'
                          }`}>
                            <Banknote className={`w-7 h-7 ${
                              formData.paymentMethod === 'CASH' ? 'text-white' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Cash</h3>
                            <p className="text-sm text-gray-600 mt-1">Pay in cash on delivery</p>
                          </div>
                          {formData.paymentMethod === 'CASH' && (
                            <CheckCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* UPI Payment */}
                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentMethod', 'UPI')}
                        className={`p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                          formData.paymentMethod === 'UPI'
                            ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                            formData.paymentMethod === 'UPI'
                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                              : 'bg-gray-100'
                          }`}>
                            <Smartphone className={`w-7 h-7 ${
                              formData.paymentMethod === 'UPI' ? 'text-white' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">UPI</h3>
                            <p className="text-sm text-gray-600 mt-1">Pay via UPI (PhonePe, GPay, etc.)</p>
                          </div>
                          {formData.paymentMethod === 'UPI' && (
                            <CheckCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Card Payment */}
                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentMethod', 'CARD')}
                        className={`p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                          formData.paymentMethod === 'CARD'
                            ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                            formData.paymentMethod === 'CARD'
                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                              : 'bg-gray-100'
                          }`}>
                            <CreditCard className={`w-7 h-7 ${
                              formData.paymentMethod === 'CARD' ? 'text-white' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Card</h3>
                            <p className="text-sm text-gray-600 mt-1">Debit/Credit card payment</p>
                          </div>
                          {formData.paymentMethod === 'CARD' && (
                            <CheckCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Wallet Payment */}
                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentMethod', 'WALLET')}
                        className={`p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                          formData.paymentMethod === 'WALLET'
                            ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-14 h-14 rounded-lg flex items-center justify-center ${
                            formData.paymentMethod === 'WALLET'
                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                              : 'bg-gray-100'
                          }`}>
                            <Wallet className={`w-7 h-7 ${
                              formData.paymentMethod === 'WALLET' ? 'text-white' : 'text-gray-600'
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900">Wallet</h3>
                            <p className="text-sm text-gray-600 mt-1">Pay via digital wallet</p>
                          </div>
                          {formData.paymentMethod === 'WALLET' && (
                            <CheckCircle className="w-6 h-6 text-brand-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-brand-primary" />
                      When to Pay?
                    </label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentStatus', 'PAY_LATER')}
                        className={`p-5 rounded-xl border-2 transition-all ${
                          formData.paymentStatus === 'PAY_LATER'
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full border-2 ${
                            formData.paymentStatus === 'PAY_LATER'
                              ? 'border-brand-primary bg-brand-primary'
                              : 'border-gray-300'
                          }`} />
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">Pay Later</p>
                            <p className="text-xs text-gray-600">Pay after service completion</p>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInputChange('paymentStatus', 'PAY_NOW')}
                        className={`p-5 rounded-xl border-2 transition-all ${
                          formData.paymentStatus === 'PAY_NOW'
                            ? 'border-brand-primary bg-brand-primary/10'
                            : 'border-gray-200 bg-white hover:border-brand-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full border-2 ${
                            formData.paymentStatus === 'PAY_NOW'
                              ? 'border-brand-primary bg-brand-primary'
                              : 'border-gray-300'
                          }`} />
                          <div className="text-left">
                            <p className="font-semibold text-gray-900">Pay Now</p>
                            <p className="text-xs text-gray-600">Pay immediately</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Final Summary */}
                  <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <h4 className="font-bold text-gray-900 mb-4">Final Booking Summary</h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="text-2xl font-bold text-green-700">
                          ₹{totalPrice.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method:</span>
                        <span className="font-semibold">
                          {formData.paymentMethod === 'CASH' ? 'Cash' :
                           formData.paymentMethod === 'UPI' ? 'UPI' :
                           formData.paymentMethod === 'CARD' ? 'Card' :
                           formData.paymentMethod === 'WALLET' ? 'Wallet' : 'Not selected'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Timing:</span>
                        <span className="font-semibold">
                          {formData.paymentStatus === 'PAY_NOW' ? 'Pay Now' : 'Pay Later'}
                        </span>
                      </div>
                    </div>
                  </div>
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
                    disabled={!canProceed || isProcessingPayment}
                    className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all transform ${
                      canProceed && !isProcessingPayment
                        ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white hover:shadow-2xl hover:shadow-brand-primary/50 hover:scale-105 active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isLastStep ? (
                      <>
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing Payment...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            {formData.paymentStatus === 'PAY_NOW' && totalPrice > 0 ? 'Pay & Book' : 'Submit Booking'}
                          </>
                        )}
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
      </div>

      <Footer />
    </div>
  );
}