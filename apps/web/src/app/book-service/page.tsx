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
  pickupRequired: boolean; // true = pickup, false = self come
  selectedWorkshop: any | null; // Selected workshop for self come
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string; // Auto-detected: area, city, state, pincode
  flatNumber: string;
  landmark: string;
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
    pickupRequired: true, // Default: pickup required
    selectedWorkshop: null, // Workshop for self come
    pickupDate: '',
    pickupTime: '',
    pickupAddress: '', // Auto-detected address (area, city, state, pincode)
    flatNumber: '',
    landmark: '',
    paymentMethod: '',
    paymentStatus: 'PAY_LATER'
  });

  // Location State
  const [cities, setCities] = useState<any[]>([]);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isDetectingAddress, setIsDetectingAddress] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const cityDropdownRef = useRef<HTMLDivElement>(null);
  
  // Car Model State
  const [carModels, setCarModels] = useState<any[]>([]);
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [carSuggestions, setCarSuggestions] = useState<any[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);
  const carDropdownRef = useRef<HTMLDivElement>(null);

  // Service Types & Pricing State
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [servicePricing, setServicePricing] = useState<Record<string, number>>({});
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);
  
  // Payment State
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Workshop State (for self come option)
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);

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

  // Fetch workshops when city is selected and pickup is not required (self come)
  useEffect(() => {
    if (formData.city && !formData.pickupRequired) {
      fetchWorkshops();
    } else {
      setWorkshops([]);
      setFormData(prev => ({ ...prev, selectedWorkshop: null }));
    }
  }, [formData.city?.id, formData.pickupRequired]);

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

  // Auto-select first category when categories are loaded
  useEffect(() => {
    if (serviceCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(serviceCategories[0].id);
    }
  }, [serviceCategories.length]);

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
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false);
      }
    };

    if (showCarSuggestions || showCityDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      }
      
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCarSuggestions, showCityDropdown]);

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

  async function fetchWorkshops() {
    if (!formData.city) return;
    
    setLoadingWorkshops(true);
    try {
      const supabase = createClient();
      const { data: workshopsData, error } = await supabase
        .from('workshops')
        .select('id, name, address, city, state, pincode, phone, email, contact_person')
        .eq('is_active', true)
        .eq('is_verified', true)
        .ilike('city', `%${formData.city.name}%`)
        .order('name');
      
      if (error) {
        console.error('Error fetching workshops:', error);
        setWorkshops([]);
      } else {
        setWorkshops(workshopsData || []);
      }
    } catch (error) {
      console.error('Error fetching workshops:', error);
      setWorkshops([]);
    } finally {
      setLoadingWorkshops(false);
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

  // Category mapping based on service names - Precise matching with exclusions
  const getServiceCategory = (serviceName: string): string => {
    const name = serviceName.toLowerCase().trim();
    
    // Helper: Check if service belongs to another specific category (exclusions)
    const hasBrake = name.includes('brake') || name.includes('braking');
    const hasClutch = name.includes('clutch');
    const hasAC = name.match(/\bac\b/i) || name.includes('air conditioning') || name.includes('air conditioner');
    const hasBattery = name.includes('battery') || name.includes('jump start');
    const hasEngine = name.includes('engine') || name.includes('motor');
    const hasTyreWheel = name.includes('tire') || name.includes('tyre') || name.includes('wheel');
    const hasPaint = name.includes('paint') || name.includes('denting');
    const hasCleaning = name.includes('cleaning') || name.includes('wash') || name.includes('detailing');
    
    // Periodic Service (Maintenance packages) - Check first
    // Match exact service package patterns (only if not other specific categories)
    if (!hasAC && !hasBrake && !hasClutch && !hasBattery && !hasEngine &&
        (name.includes('basic service') || name.includes('general service') || 
         name.includes('premium service') || name.includes('platinum service') ||
         name.includes('periodic service') || name.match(/\d+\s*points?/i) ||
         (name.includes('service') && (name.includes('point') || name.match(/\d+/))))) {
      return 'PERIODIC SERVICE';
    }
    
    // AC Service - Must have AC specifically, exclude brake/clutch
    if (hasAC && !hasBrake && !hasClutch && !hasBattery) {
      return 'AC SERVICE';
    }
    
    // Battery Service - Check before engine
    if (hasBattery) {
      return 'BATTERY SERVICE';
    }
    
    // Brake Service - Must be specific to brakes, exclude AC/clutch
    if (hasBrake && !hasAC && !hasClutch) {
      return 'BRAKE SERVICE';
    }
    
    // Clutch Service - Must be specific to clutch, exclude AC/brake
    if (hasClutch && !hasAC && !hasBrake) {
      return 'CLUTCH SERVICE';
    }
    
    // Tyre & Wheel Care - Specific wheel/tire services
    if (hasTyreWheel && !hasBrake && !hasClutch && !hasAC) {
      return 'TYRE & WHEEL CARE';
    }
    
    // Denting Painting - Body work and paint (exclude cleaning/detailing)
    if (hasPaint && !hasCleaning && 
        (name.includes('denting') || 
         name.includes('bonnet') ||
         name.includes('antirust') ||
         (name.includes('coating') && (name.includes('underbody') || name.includes('antirust') || name.includes('body'))))) {
      return 'DENTING PAINTING';
    }
    
    // Detailing Service - Cleaning, wash, polishing, wax
    if (hasCleaning || 
        name.includes('wax') || 
        name.includes('polish') ||
        name.includes('teflon') ||
        (name.includes('3m') && (name.includes('cleaning') || name.includes('wax') || name.includes('polish')))) {
      return 'DETAILING SERVICE';
    }
    
    // Engine Service - Must be engine/oil specific
    if (hasEngine && !hasAC && !hasBrake && !hasClutch) {
      return 'ENGINE SERVICE';
    }
    // Oil change specifically
    if (name.includes('oil change') || (name.includes('oil') && name.includes('change') && !hasCleaning)) {
      return 'ENGINE SERVICE';
    }
    // Transmission service
    if (name.includes('transmission')) {
      return 'ENGINE SERVICE';
    }
    
    // Default category for unmatched services
    return 'OTHER SERVICES';
  };

  async function fetchServiceTypes() {
    setLoadingServiceTypes(true);
    try {
      const supabase = createClient();
      
      // Fetch all active services with error handling
      const { data: servicesData, error, status, statusText } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching service types:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          status,
          statusText
        });
        
        // Show more detailed error message
        const errorMsg = error.message || 'Failed to load services. Please check database permissions.';
        toast.error(errorMsg);
        setServiceTypes([]);
        setServiceCategories([]);
      } else {
        const allServices = (servicesData || []).map((service: any) => {
          // Extract points from service name if available
          const pointsMatch = service.name.match(/(\d+)\s*points?/i);
          const points = pointsMatch ? parseInt(pointsMatch[1]) : null;
          
          const category = getServiceCategory(service.name);
          
          // Debug logging for category assignment
          console.log(`Service: "${service.name}" -> Category: "${category}"`);
          
          return {
            ...service,
            category: category,
            points: points
          };
        });
        
        setServiceTypes(allServices);
        
        // Extract unique categories
        const categories = Array.from(new Set(allServices.map((s: any) => s.category)))
          .map(category => {
            const categoryServices = allServices.filter((s: any) => s.category === category);
            return {
              id: category,
              name: category,
              count: categoryServices.length
            };
          })
          .sort((a, b) => {
            // Sort: PERIODIC SERVICE first, then alphabetical
            if (a.name === 'PERIODIC SERVICE') return -1;
            if (b.name === 'PERIODIC SERVICE') return 1;
            return a.name.localeCompare(b.name);
          });
        
        setServiceCategories(categories);
        
        // Auto-select first category if none selected
        if (!selectedCategory && categories.length > 0) {
          setSelectedCategory(categories[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching service types:', error);
      toast.error('Failed to load services. Please try again.');
      setServiceTypes([]);
      setServiceCategories([]);
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
                
                // Extract only: area, city, state, pincode
                const addressParts = [];
                
                // Area (neighbourhood, suburb, or locality)
                if (address.neighbourhood) {
                  addressParts.push(address.neighbourhood);
                } else if (address.suburb) {
                  addressParts.push(address.suburb);
                } else if (address.locality) {
                  addressParts.push(address.locality);
                }
                
                // City (city, town, or village)
                if (address.city) {
                  addressParts.push(address.city);
                } else if (address.town) {
                  addressParts.push(address.town);
                } else if (address.village) {
                  addressParts.push(address.village);
                }
                
                // State
                if (address.state) {
                  addressParts.push(address.state);
                }
                
                // Pincode
                if (address.postcode) {
                  addressParts.push(address.postcode);
                }
                
                const fullAddress = addressParts.join(', ');
                
                if (fullAddress) {
                  setFormData(prev => ({ ...prev, pickupAddress: fullAddress }));
                  toast.success('Address detected successfully! Please add flat number and landmark.');
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
    setShowCityDropdown(false);
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

    // Step 2 validation: Phone required
    if (currentStep === 1) {
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

    // Step 4 validation: Pickup details or Workshop selection
    if (currentStep === 3) {
      if (formData.pickupRequired) {
        // Pickup required - validate pickup details
        if (!formData.pickupDate) {
          toast.error('Please select a pickup date');
          return;
        }
        if (!formData.pickupTime) {
          toast.error('Please select a pickup time');
          return;
        }
        if (!formData.pickupAddress.trim()) {
          toast.error('Please auto-detect or enter address (area, city, state, pincode)');
          return;
        }
        if (!formData.landmark.trim()) {
          toast.error('Please enter a landmark');
          return;
        }
      } else {
        // Self come - validate workshop selection
        if (!formData.selectedWorkshop) {
          toast.error('Please select a workshop');
          return;
        }
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

    // Combine address fields: pickupAddress (auto-detected) + flatNumber (optional) + landmark (mandatory)
    const addressParts = [formData.pickupAddress.trim()];
    if (formData.flatNumber.trim()) {
      addressParts.unshift(formData.flatNumber.trim()); // Add flat number at start if provided
    }
    addressParts.push(formData.landmark.trim()); // Landmark is mandatory
    const completeAddress = addressParts.filter(part => part.length > 0).join(', ');

    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .insert([{
        lead_number: leadNumber,
        created_from: 'WEB',
        status: 'NEW',
        customer_name: formData.customerName || null,
        customer_phone: formData.customerPhone,
        vehicle_number: formData.vehicleNumber || null,
        city: formData.city.name,
        city_id: formData.city.id,
        vehicle_make: formData.carModel.make,
        model_id: formData.carModel.id,
        vehicle_model: formData.carModel.model_name,
        vehicle_variant: formData.carModel.variant || null,
        service_type_ids: formData.selectedServices.length > 0 ? formData.selectedServices : null,
        pickup_required: formData.pickupRequired,
        assigned_workshop_id: formData.pickupRequired ? null : formData.selectedWorkshop?.id || null,
        address: formData.pickupRequired ? completeAddress : (formData.selectedWorkshop?.address || completeAddress),
        customer_address: formData.pickupRequired ? completeAddress : (formData.selectedWorkshop?.address || completeAddress),
        pickup_address: formData.pickupRequired ? completeAddress : null,
        preferred_slot_start: formData.pickupRequired && formData.pickupDate && formData.pickupTime 
          ? `${formData.pickupDate}T${formData.pickupTime}:00` 
          : null,
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
      // Validate customer details before creating payment order
      if (!formData.customerPhone || !formData.customerPhone.trim()) {
        toast.error('Customer phone number is required for payment');
        setIsProcessingPayment(false);
        return;
      }

      // Use customer name if available, otherwise use a default or phone number
      const customerName = formData.customerName?.trim() || `Customer_${formData.customerPhone.slice(-4)}`;

      // Create payment order
      const response = await fetch('/api/payments/create-booking-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalPrice,
          customerName: customerName,
          customerPhone: formData.customerPhone.trim(),
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
          name: formData.customerName || '',
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
    // Base validation
    if (!formData.city || !formData.carModel || !formData.customerPhone || !formData.paymentMethod) {
      toast.error('Please complete all required fields');
      return;
    }
    
    // Pickup/Workshop validation
    if (formData.pickupRequired) {
      if (!formData.pickupDate || !formData.pickupTime || !formData.pickupAddress) {
        toast.error('Please complete pickup details');
        return;
      }
    } else {
      if (!formData.selectedWorkshop) {
        toast.error('Please select a workshop');
        return;
      }
    }

    // Validate customer phone for payment
    if (formData.paymentStatus === 'PAY_NOW' && totalPrice > 0) {
      if (!formData.customerPhone || !formData.customerPhone.trim() || formData.customerPhone.length !== 10) {
        toast.error('Valid 10-digit phone number is required for payment');
        return;
      }
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
  
  // Helper functions for date selection (Step 4)
  // Always get today's date in India timezone (IST - UTC+5:30)
  const getIndiaDate = () => {
    const now = new Date();
    // Get IST date string (Asia/Kolkata timezone)
    const istDateStr = now.toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // Parse it back to get the correct date
    const [month, day, year] = istDateStr.split('/');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };
  
  const getCurrentDate = () => {
    const today = getIndiaDate();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getNextDate = () => {
    const today = getIndiaDate();
    const next = new Date(today);
    next.setDate(next.getDate() + 1);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getNextNextDate = () => {
    const today = getIndiaDate();
    const next = new Date(today);
    next.setDate(next.getDate() + 2);
    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, '0');
    const day = String(next.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Helper to compare dates in IST
  const compareISTDates = (dateStr1: string, dateStr2: string) => {
    const d1 = new Date(dateStr1 + 'T00:00:00+05:30'); // IST
    const d2 = new Date(dateStr2 + 'T00:00:00+05:30'); // IST
    return d1.getTime() === d2.getTime();
  };
  
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const todayIST = getCurrentDate();
    const tomorrowIST = getNextDate();
    const dayAfterIST = getNextNextDate();
    
    // Parse date and format in IST timezone
    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const istDateStr = date.toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [dayName, monthName, day] = istDateStr.split(' ');
    
    if (compareISTDates(dateStr, todayIST)) return 'Today';
    if (compareISTDates(dateStr, tomorrowIST)) return 'Tomorrow';
    if (compareISTDates(dateStr, dayAfterIST)) {
      return `${dayName}, ${day} ${monthName}`;
    }
    
    return `${dayName}, ${day} ${monthName}`;
  };
  
  // Format date for button labels (shorter format)
  const formatDateForButton = (dateStr: string) => {
    if (!dateStr) return '';
    const todayIST = getCurrentDate();
    const tomorrowIST = getNextDate();
    const dayAfterIST = getNextNextDate();
    
    // Parse date and format in IST timezone
    const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone issues
    const istDateStr = date.toLocaleString('en-US', { 
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    
    const [dayName, monthName, day] = istDateStr.split(' ');
    
    if (compareISTDates(dateStr, todayIST)) {
      return `Today, ${day} ${monthName}`;
    }
    if (compareISTDates(dateStr, tomorrowIST)) {
      return `Tomorrow, ${day} ${monthName}`;
    }
    if (compareISTDates(dateStr, dayAfterIST)) {
      return `${dayName}, ${day} ${monthName}`;
    }
    
    return `${dayName}, ${day} ${monthName}`;
  };
  
  // Generate time slots: 9 AM to 9 PM (hourly) - Display as "hh:mm am/pm - hh:mm am/pm"
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = 9 + i;
    const time24 = `${hour.toString().padStart(2, '0')}:00`;
    const nextHour = hour + 1;
    
    // Format start time
    const startHour = hour === 12 ? 12 : hour > 12 ? hour - 12 : hour;
    const startPeriod = hour >= 12 ? 'PM' : 'AM';
    const startTime = `${startHour}:00 ${startPeriod}`;
    
    // Format end time
    const endHour = nextHour === 12 ? 12 : nextHour > 12 ? nextHour - 12 : nextHour;
    const endPeriod = nextHour >= 12 ? 'PM' : 'AM';
    const endTime = `${endHour}:00 ${endPeriod}`;
    
    // Format as range: "9:00 AM - 10:00 AM"
    const rangeLabel = `${startTime} - ${endTime}`;
    return { value: time24, label: rangeLabel };
  });
  
  const canProceed = currentStep === 0 
    ? formData.city !== null && formData.carModel !== null
    : currentStep === 1
    ? formData.customerPhone.trim().length === 10
    : currentStep === 2
    ? formData.selectedServices.length > 0
    : currentStep === 3
    ? formData.pickupRequired
      ? formData.pickupDate !== '' && formData.pickupTime !== '' && formData.pickupAddress.trim() !== '' && formData.landmark.trim() !== ''
      : formData.selectedWorkshop !== null
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
      
      <div className="container mx-auto px-3 sm:px-4 md:px-6 pt-16 sm:pt-20 md:pt-24 pb-8 sm:pb-12 md:pb-16">
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
            <div className="p-4 sm:p-5 md:p-6 lg:p-8">
              {/* Step Counter */}
              <div className="text-right mb-3 sm:mb-4 md:mb-5">
                <span className="text-xs sm:text-sm text-gray-500">
                  Step {currentStep + 1} of {steps.length}
                  </span>
          </div>

              {/* Step Content */}
              <div className={`min-h-[250px] sm:min-h-[300px] flex flex-col justify-center ${isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} transition-all duration-300`}>
                {/* Title & Subtitle */}
                <div className="mb-4 sm:mb-5 md:mb-6">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1.5 sm:mb-2">
                    {currentStepData.title}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    {currentStepData.subtitle}
                  </p>
        </div>

                {/* Step 1: Location + Car Model */}
                {currentStep === 0 && (
                  <div className="mb-8 sm:mb-10 md:mb-12 space-y-6 sm:space-y-8">
                    {/* Location Section */}
                    <div className="relative" ref={cityDropdownRef}>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Select City</h3>
                  </div>

                      {isDetectingLocation && (
                        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary animate-spin flex-shrink-0" />
                            <p className="text-xs sm:text-sm text-blue-700 font-medium">Detecting your location...</p>
                      </div>
                    </div>
                      )}

                      {formData.city && (
                        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                              <p className="text-xs sm:text-sm text-green-800 font-medium truncate">
                                Location: <strong>{formData.city.name}</strong>
                              </p>
                            </div>
                            <button
                              onClick={() => setShowCityDropdown(!showCityDropdown)}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-white border border-green-300 text-green-700 rounded-lg font-semibold hover:bg-green-100 transition-all flex-shrink-0 whitespace-nowrap"
                            >
                              Change
                            </button>
                        </div>
                    </div>
                      )}

                      {!formData.city && !isDetectingLocation && (
                        <button
                          onClick={autoDetectLocation}
                          disabled={isDetectingLocation}
                          className="w-full px-4 py-2.5 sm:py-3 bg-white border-2 border-brand-primary text-brand-primary rounded-xl font-semibold hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
                        >
                          <Navigation className="w-4 h-4" />
                          Auto Detect Location
                        </button>
                      )}

                      {/* City Dropdown */}
                      {showCityDropdown && cities.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-64 sm:max-h-80 overflow-y-auto">
                          <div className="p-2">
                            {cities.map((city) => (
                              <button
                                key={city.id}
                                type="button"
                                onClick={() => handleCitySelect(city)}
                                className={`w-full px-4 py-3 sm:py-4 text-left hover:bg-blue-50 transition-colors rounded-lg ${
                                  formData.city?.id === city.id ? 'bg-blue-50 border border-brand-primary' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
                                    <div>
                                      <p className="font-semibold text-sm sm:text-base text-text-body">{city.name}</p>
                                      {city.state && (
                                        <p className="text-xs text-gray-600">{city.state}</p>
                                      )}
                                    </div>
                                  </div>
                                  {formData.city?.id === city.id && (
                                    <CheckCircle className="w-5 h-5 text-brand-primary flex-shrink-0" />
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Car Model Section */}
                    <div>
                      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Car className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">Select Car Model</h3>
                  </div>

                      <div className="relative" ref={carDropdownRef}>
                      <div className="relative">
                          <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
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
                            className={`w-full pl-11 sm:pl-14 pr-10 sm:pr-12 py-3 sm:py-4 md:py-5 text-base sm:text-lg md:text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                              formData.carModel
                                ? 'border-brand-primary bg-brand-primary/5'
                                : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                            }`}
                            autoFocus
                        />
                          {formData.carModel && (
                            <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2">
                              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                            </div>
                        )}
                      </div>
                      
                        {showCarSuggestions && carSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-64 sm:max-h-80 overflow-y-auto">
                            {carSuggestions.map((car) => (
                            <button
                              key={car.id}
                              type="button"
                              onClick={() => handleCarSelect(car)}
                                className="w-full px-3 sm:px-4 py-3 sm:py-4 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm sm:text-base text-text-body truncate">{car.make}</p>
                                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                                      {car.model_name} {car.variant ? `(${car.variant})` : ''}
                                    </p>
                                </div>
                                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                        {formData.carModel && (
                          <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-xl">
                            <p className="text-xs sm:text-sm text-green-800 font-medium">
                              Selected: <strong>{formData.carModel.make} {formData.carModel.model_name}</strong>
                            </p>
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Phone, Vehicle Number */}
                {currentStep === 1 && (
                  <div className="mb-8 sm:mb-10 md:mb-12 space-y-4 sm:space-y-6">
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
                        className={`w-full px-3 sm:px-4 py-3 sm:py-4 md:py-5 text-base sm:text-lg md:text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                          formData.customerPhone && formData.customerPhone.length === 10
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
                      {formData.customerPhone && formData.customerPhone.length === 10 && (
                        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 mt-4 sm:mt-6">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
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
                        className={`w-full px-3 sm:px-4 py-3 sm:py-4 md:py-5 text-base sm:text-lg md:text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all uppercase ${
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
                        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 mt-4 sm:mt-6">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
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
                  <div className="mb-8 sm:mb-10 md:mb-12">
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
                        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="w-full sm:w-auto">
                              <p className="text-xs sm:text-sm text-gray-600">Location</p>
                              <p className="font-bold text-sm sm:text-base text-brand-secondary">{formData.city?.name}</p>
                            </div>
                            <div className="w-full sm:w-auto">
                              <p className="text-xs sm:text-sm text-gray-600">Vehicle</p>
                              <p className="font-bold text-sm sm:text-base text-brand-secondary">
                                {formData.carModel?.make} {formData.carModel?.model_name}
                              </p>
                            </div>
                    </div>
                  </div>

                        {/* Category Selection - Simple Filter Style */}
                        {serviceCategories.length > 0 && (
                          <div className="mb-4 sm:mb-6">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-2">Select Service Category</h3>
                            <div className="flex flex-wrap gap-2">
                              {serviceCategories.map((category) => {
                                const isSelected = selectedCategory === category.id;
                                return (
                                  <button
                                    key={category.id}
                                    onClick={() => setSelectedCategory(category.id)}
                                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border transition-all text-sm font-medium ${
                                      isSelected
                                        ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/50 hover:bg-gray-50'
                                    }`}
                                  >
                                    {category.name} <span className="text-xs opacity-75">({category.count})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Service Types Grid - Filtered by Category */}
                        {selectedCategory && (
                          <div className="mb-4 sm:mb-6">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-3">
                              Services in {selectedCategory}
                            </h3>
                            {serviceTypes.filter((service: any) => service.category === selectedCategory).length === 0 ? (
                              <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-600 text-sm">No services available in this category.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {serviceTypes
                                  .filter((service: any) => service.category === selectedCategory)
                                  .map((service) => {
                                  const isSelected = formData.selectedServices.includes(service.id);
                                  const price = servicePricing[service.id] || 0;
                                  
                                  return (
                                    <button
                                      key={service.id}
                                      onClick={() => handleServiceToggle(service.id)}
                                      className={`p-4 sm:p-6 rounded-xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                                        isSelected
                                          ? 'border-brand-primary bg-gradient-to-br from-brand-primary/10 to-brand-secondary/10 shadow-lg'
                                          : 'border-gray-200 bg-white hover:border-brand-primary/50 hover:shadow-md'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                            isSelected
                                              ? 'bg-gradient-to-br from-brand-primary to-brand-secondary'
                                              : 'bg-gray-100'
                                          }`}>
                                            <Wrench className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                              isSelected ? 'text-white' : 'text-gray-600'
                                            }`} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-base sm:text-lg text-gray-900 break-words">{service.name}</h3>
                                            {service.points && (
                                              <p className="text-xs sm:text-sm text-brand-primary font-semibold mt-1">
                                                {service.points} Points
                                              </p>
                                            )}
                                            {service.description && (
                                              <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-2 break-words">{service.description}</p>
                                            )}
                                          </div>
                                        </div>
                                        {isSelected && (
                                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0 ml-2" />
                                        )}
                                      </div>
                                      <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                                        <span className="text-xs text-gray-500">Price</span>
                                        <span className="text-lg sm:text-2xl font-bold text-brand-primary">
                                          {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'Price on request'}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Total Price Display */}
                        {formData.selectedServices.length > 0 && (
                          <div className="p-4 sm:p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0" />
                  <div>
                                  <p className="text-xs sm:text-sm text-gray-600">Total Price</p>
                                  <p className="text-2xl sm:text-3xl font-bold text-green-700">
                                    ₹{totalPrice.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                              <div className="text-left sm:text-right w-full sm:w-auto">
                                <p className="text-xs sm:text-sm text-gray-600">
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

              {/* Step 4: Pickup Details / Self Come Option */}
              {currentStep === 3 && (
                  <div className="mb-8 sm:mb-10 md:mb-12 space-y-5 sm:space-y-6">
                    {/* Pickup Required / Self Come Toggle Switch - Show First */}
                    <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm mb-6">
                      <label className="block text-sm sm:text-base font-bold text-gray-800 mb-4 flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                          <Car className="w-4 h-4 text-white" />
                        </div>
                        Service Preference
                        <span className="text-red-500 text-lg">*</span>
                      </label>
                      
                      {/* Toggle Switch */}
                      <div className="flex items-center justify-between gap-4">
                        {/* Left Label - Pickup Required */}
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            formData.pickupRequired
                              ? 'bg-indigo-500'
                              : 'bg-gray-300'
                          }`}>
                            <Navigation className={`w-5 h-5 ${
                              formData.pickupRequired ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                          <div>
                            <h4 className={`font-bold text-base sm:text-lg transition-all ${
                              formData.pickupRequired ? 'text-indigo-700' : 'text-gray-500'
                            }`}>
                              Pickup Required
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                              We'll pick up your vehicle
                            </p>
                          </div>
                        </div>

                        {/* Toggle Switch */}
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.pickupRequired) {
                              setFormData(prev => ({ ...prev, pickupRequired: false, pickupDate: '', pickupTime: '', pickupAddress: '', flatNumber: '', landmark: '' }));
                            } else {
                              setFormData(prev => ({ ...prev, pickupRequired: true, selectedWorkshop: null }));
                            }
                          }}
                          className={`relative inline-flex h-12 w-24 sm:h-14 sm:w-28 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            formData.pickupRequired
                              ? 'bg-indigo-500 focus:ring-indigo-500'
                              : 'bg-green-500 focus:ring-green-500'
                          }`}
                        >
                          <span
                            className={`inline-block h-10 w-10 sm:h-12 sm:w-12 transform rounded-full bg-white shadow-lg transition-transform ${
                              formData.pickupRequired ? 'translate-x-2 sm:translate-x-3' : 'translate-x-12 sm:translate-x-14'
                            }`}
                          >
                            <div className="flex h-full w-full items-center justify-center">
                              {formData.pickupRequired ? (
                                <Navigation className="h-5 w-5 text-indigo-500" />
                              ) : (
                                <MapPin className="h-5 w-5 text-green-500" />
                              )}
                            </div>
                          </span>
                        </button>

                        {/* Right Label - Self Come */}
                        <div className="flex items-center gap-3 flex-1 justify-end">
                          <div>
                            <h4 className={`font-bold text-base sm:text-lg text-right transition-all ${
                              !formData.pickupRequired ? 'text-green-700' : 'text-gray-500'
                            }`}>
                              Self Come
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 text-right">
                              Visit our workshop
                            </p>
                          </div>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            !formData.pickupRequired
                              ? 'bg-green-500'
                              : 'bg-gray-300'
                          }`}>
                            <MapPin className={`w-5 h-5 ${
                              !formData.pickupRequired ? 'text-white' : 'text-gray-500'
                            }`} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Modern Progress Indicator */}
                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-brand-primary to-brand-secondary rounded-xl flex items-center justify-center shadow-lg">
                          <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900">Step 4 of 5</h3>
                          <p className="text-xs sm:text-sm text-gray-500">
                            {formData.pickupRequired ? 'Pickup Details' : 'Workshop Selection'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((step) => (
                          <div
                            key={step}
                            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full transition-all ${
                              step <= 4
                                ? 'bg-gradient-to-r from-brand-primary to-brand-secondary'
                                : 'bg-gray-300'
                            } ${step === 4 ? 'ring-2 ring-brand-primary/30 ring-offset-2' : ''}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Pickup Details - Only show when pickup required */}
                    {formData.pickupRequired && (
                      <>
                        {/* Pickup Date - With Current/Next/Next Buttons + Calendar Icon */}
                        <div className="relative group">
                          <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                              <label className="block text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
                                  <Calendar className="w-4 h-4 text-white" />
                                </div>
                                Pickup Date
                                {formData.pickupDate && (
                                  <span className="text-lg sm:text-xl font-bold text-blue-600 ml-2">
                                    {new Date(formData.pickupDate).toLocaleDateString('en-GB', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                )}
                                <span className="text-red-500 text-lg">*</span>
                              </label>
                            </div>
                            
                            {/* Date Quick Select Buttons */}
                            <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
                              <button
                                type="button"
                                onClick={() => handleInputChange('pickupDate', getCurrentDate())}
                                className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                                  formData.pickupDate === getCurrentDate()
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md'
                                }`}
                              >
                                {formatDateForButton(getCurrentDate())}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInputChange('pickupDate', getNextDate())}
                                className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                                  formData.pickupDate === getNextDate()
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md'
                                }`}
                              >
                                {formatDateForButton(getNextDate())}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleInputChange('pickupDate', getNextNextDate())}
                                className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                                  formData.pickupDate === getNextNextDate()
                                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg scale-105'
                                    : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-300 hover:shadow-md'
                                }`}
                              >
                                {formatDateForButton(getNextNextDate())}
                              </button>
                              
                              {/* Date Picker Icon next to third button */}
                              <div className="relative">
                                <input
                                  type="date"
                                  value={formData.pickupDate}
                                  onChange={(e) => {
                                    const selectedDate = e.target.value;
                                    const today = getCurrentDate();
                                    if (selectedDate >= today) {
                                      handleInputChange('pickupDate', selectedDate);
                                    } else {
                                      toast.error('Please select today or a future date');
                                    }
                                  }}
                                  min={getCurrentDate()}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  id="date-picker-hidden"
                                />
                                <label
                                  htmlFor="date-picker-hidden"
                                  className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md cursor-pointer hover:shadow-lg transition-all flex-shrink-0"
                                >
                                  <Calendar className="w-5 h-5 text-white" />
                                </label>
                              </div>
                              
                              {/* Display selected date next to calendar icon */}
                              {formData.pickupDate && (
                                <div className="px-3 sm:px-4 py-2 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl">
                                  <p className="text-xs sm:text-sm font-bold text-blue-700">
                                    {new Date(formData.pickupDate).toLocaleDateString('en-GB', { 
                                      day: '2-digit', 
                                      month: '2-digit', 
                                      year: 'numeric' 
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {formData.pickupDate && (
                              <p className="mt-3 text-sm font-semibold text-blue-600">
                                Selected: {formatDateDisplay(formData.pickupDate)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pickup Time - Hourly Slots (9 AM to 9 PM) */}
                        <div className="relative group">
                          <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300">
                            <label className="block text-sm sm:text-base font-bold text-gray-800 mb-4 flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
                                <Clock className="w-4 h-4 text-white" />
                              </div>
                              Pickup Time
                              <span className="text-red-500 text-lg">*</span>
                            </label>
                            
                            {/* Time Slot Grid */}
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                              {timeSlots.map((slot) => {
                                const isSelected = formData.pickupTime === slot.value;
                                return (
                                  <button
                                    key={slot.value}
                                    type="button"
                                    onClick={() => handleInputChange('pickupTime', slot.value)}
                                    className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                                      isSelected
                                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg scale-105 ring-2 ring-purple-300'
                                        : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-purple-300 hover:shadow-md'
                                    }`}
                                  >
                                    {slot.label}
                                  </button>
                                );
                              })}
                            </div>
                            
                            {formData.pickupTime && (
                              <p className="mt-4 text-sm font-semibold text-purple-600 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Selected: {timeSlots.find(s => s.value === formData.pickupTime)?.label}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Pickup Address - Auto Detect (Area, City, State, Pincode) */}
                        <div className="relative group">
                          <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300">
                            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                              <label className="block text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2.5">
                                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                                  <AddressIcon className="w-4 h-4 text-white" />
                                </div>
                                Address (Auto-detected)
                                <span className="text-red-500 text-lg">*</span>
                              </label>
                              <button
                                type="button"
                                onClick={autoDetectAddress}
                                disabled={isDetectingAddress}
                                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-white rounded-xl font-bold text-xs sm:text-sm hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2 shadow-md"
                              >
                                {isDetectingAddress ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Detecting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Navigation className="w-4 h-4" />
                                    <span>Auto Detect</span>
                                  </>
                                )}
                              </button>
                            </div>
                            
                            {isDetectingAddress && (
                              <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl animate-fade-in shadow-sm">
                                <div className="flex items-center gap-3">
                                  <Loader2 className="w-5 h-5 text-brand-primary animate-spin flex-shrink-0" />
                                  <p className="text-sm text-blue-700 font-semibold">Detecting area, city, state, and pincode...</p>
                                </div>
                              </div>
                            )}
                            
                            <div className="relative">
                              <textarea
                                value={formData.pickupAddress}
                                onChange={(e) => handleInputChange('pickupAddress', e.target.value)}
                                placeholder="Area, City, State, Pincode (auto-detected or enter manually)"
                                rows={3}
                                className={`w-full px-4 sm:px-5 py-3.5 sm:py-4 text-sm sm:text-base font-medium border-2 rounded-xl focus:ring-4 outline-none transition-all resize-none shadow-sm ${
                                  formData.pickupAddress
                                    ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100/50 text-gray-900 shadow-md'
                                    : 'border-gray-200 bg-white focus:border-green-500 focus:ring-green-500/20 hover:border-gray-300'
                                }`}
                              />
                              {formData.pickupAddress && (
                                <div className="absolute right-4 top-4">
                                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <p className="mt-3 text-xs sm:text-sm text-gray-500 italic">
                              This field will be auto-filled with area, city, state, and pincode when you click "Auto Detect"
                            </p>
                          </div>
                        </div>

                        {/* Flat Number & Landmark - Only show when address is filled */}
                        {formData.pickupAddress.trim() && (
                          <>
                            {/* Flat Number - Optional */}
                            <div className="relative group">
                              <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md">
                                    <span className="text-white text-xs font-bold">#</span>
                                  </div>
                                  Flat / House Number
                                  <span className="text-xs text-gray-500 font-normal ml-1">(Optional)</span>
                                </label>
                                <input
                                  type="text"
                                  value={formData.flatNumber}
                                  onChange={(e) => handleInputChange('flatNumber', e.target.value)}
                                  placeholder="e.g., Flat 201, House No. 123"
                                  className={`w-full px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-lg font-medium border-2 rounded-xl focus:ring-4 outline-none transition-all shadow-sm ${
                                    formData.flatNumber
                                      ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/50 text-gray-900 shadow-md'
                                      : 'border-gray-200 bg-white focus:border-orange-500 focus:ring-orange-500/20 hover:border-gray-300'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Landmark - Mandatory */}
                            <div className="relative group">
                              <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                <label className="block text-sm sm:text-base font-bold text-gray-800 mb-3 flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                                    <MapPin className="w-4 h-4 text-white" />
                                  </div>
                                  Landmark
                                  <span className="text-red-500 text-lg">*</span>
                                  <span className="text-xs text-gray-600 font-normal ml-1">(Mandatory)</span>
                                </label>
                                <input
                                  type="text"
                                  value={formData.landmark}
                                  onChange={(e) => handleInputChange('landmark', e.target.value)}
                                  placeholder="e.g., Near ABC Mall, Behind XYZ Bank"
                                  className={`w-full px-4 sm:px-5 py-3.5 sm:py-4 text-base sm:text-lg font-medium border-2 rounded-xl focus:ring-4 outline-none transition-all shadow-sm ${
                                    formData.landmark
                                      ? 'border-pink-500 bg-gradient-to-br from-pink-50 to-pink-100/50 text-gray-900 shadow-md'
                                      : 'border-gray-200 bg-white focus:border-pink-500 focus:ring-pink-500/20 hover:border-gray-300'
                                  }`}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* Workshop Selection - Only show when self come is selected */}
                    {!formData.pickupRequired && (
                      <div className="space-y-5 sm:space-y-6">
                        <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-2xl border-2 border-gray-100 p-4 sm:p-5 md:p-6 shadow-sm">
                          <label className="block text-sm sm:text-base font-bold text-gray-800 mb-4 flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-md">
                              <MapPin className="w-4 h-4 text-white" />
                            </div>
                            Select Workshop
                            <span className="text-red-500 text-lg">*</span>
                          </label>

                          {loadingWorkshops ? (
                            <div className="text-center py-8">
                              <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto mb-3" />
                              <p className="text-sm text-gray-600">Loading workshops...</p>
                            </div>
                          ) : workshops.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                              <p className="text-sm font-semibold text-gray-700 mb-1">No workshops available</p>
                              <p className="text-xs text-gray-500">No active workshops found in {formData.city?.name || 'selected city'}</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              {workshops.map((workshop) => {
                                const isSelected = formData.selectedWorkshop?.id === workshop.id;
                                return (
                                  <button
                                    key={workshop.id}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, selectedWorkshop: workshop }))}
                                    className={`p-4 sm:p-5 rounded-xl border-2 transition-all text-left ${
                                      isSelected
                                        ? 'border-green-500 bg-gradient-to-br from-green-50 to-green-100/50 shadow-md ring-2 ring-green-200'
                                        : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-sm'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex-1 min-w-0">
                                        <h4 className={`font-bold text-base sm:text-lg mb-1 ${
                                          isSelected ? 'text-green-700' : 'text-gray-800'
                                        }`}>
                                          {workshop.name}
                                        </h4>
                                        <div className="space-y-1 text-xs sm:text-sm">
                                          {workshop.address && (
                                            <p className={`flex items-start gap-2 ${
                                              isSelected ? 'text-green-700' : 'text-gray-600'
                                            }`}>
                                              <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                              <span className="break-words">{workshop.address}</span>
                                            </p>
                                          )}
                                          {(workshop.city || workshop.state || workshop.pincode) && (
                                            <p className={isSelected ? 'text-green-600' : 'text-gray-500'}>
                                              {[workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ')}
                                            </p>
                                          )}
                                          {workshop.phone && (
                                            <p className={`flex items-center gap-2 ${
                                              isSelected ? 'text-green-700' : 'text-gray-600'
                                            }`}>
                                              <Phone className="w-4 h-4" />
                                              {workshop.phone}
                                            </p>
                                          )}
                                          {workshop.contact_person && (
                                            <p className={isSelected ? 'text-green-600' : 'text-gray-500'}>
                                              Contact: {workshop.contact_person}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {isSelected && (
                                        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
              )}

              {/* Summary Card - Step 4 */}
              {currentStep === 3 && (
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 mb-2 sm:mb-3">Booking Summary</h4>
                    <div className="space-y-2 text-xs sm:text-sm">
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
                      {formData.pickupRequired && formData.pickupDate && (
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
                      {!formData.pickupRequired && formData.selectedWorkshop && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Workshop:</span>
                          <span className="font-semibold">{formData.selectedWorkshop.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
              )}

              {/* Step 5: Payment Options */}
              {currentStep === 4 && (
                <div className="mb-8 sm:mb-10 md:mb-12 space-y-4 sm:space-y-6">
                  {/* Payment Method Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-brand-primary" />
                      Payment Method <span className="text-red-500">*</span>
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4">Final Booking Summary</h4>
                    <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="text-xl sm:text-2xl font-bold text-green-700">
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
                <div className="flex items-center justify-between pt-4 sm:pt-6 md:pt-8 border-t border-gray-100 gap-3 sm:gap-4">
                  <button
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className={`flex items-center gap-1 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm sm:text-base transition-all ${
                      currentStep === 0
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                
                  <button
                    onClick={handleNext}
                    disabled={!canProceed || isProcessingPayment}
                    className={`flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all transform ${
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