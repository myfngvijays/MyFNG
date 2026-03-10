'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { createClient } from '@/lib/supabase/client';
import { loadRazorpayScript } from '@/lib/services/paymentService';
import { getFallbackChecklistTemplate } from '@/lib/services/customerServiceChecklist';
import { formatDateDMY, formatDateTime } from "@/lib/utils";
import {
  MapPin, Car, User, Phone, Loader2, Search, CheckCircle, 
  Navigation, ArrowRight, ArrowLeft, Send, Smile, PartyPopper,
  Wrench, DollarSign, Sparkles, Calendar, Clock, MapPin as AddressIcon,
  X
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
    paymentMethod: 'CASH',
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
  const formCardRef = useRef<HTMLDivElement>(null);

  // Service Types & Pricing State
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // UI: search inside current category
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  // UI: service details modal (step 3)
  const [detailsService, setDetailsService] = useState<any | null>(null);
  const [serviceChecklistTemplates, setServiceChecklistTemplates] = useState<
    Record<string, { title?: string; points?: number; items: any[] }>
  >({});
  const [selectedOilType, setSelectedOilType] = useState<'semi' | 'full'>('semi');
  const [bookingPrefillApplied, setBookingPrefillApplied] = useState(false);
  const [bookingPrefillParams, setBookingPrefillParams] = useState<{ category?: string; query?: string } | null>(null);
  const [servicePricing, setServicePricing] = useState<Record<string, number>>({});
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [loadingServiceTypes, setLoadingServiceTypes] = useState(false);
  
  // Payment State
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMeta, setCouponMeta] = useState<any | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  
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
      title: 'Choose your plan',
      subtitle: 'Select a service package for your vehicle',
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

  // Reset search when category changes
  useEffect(() => {
    if (currentStep !== 2) return;
    // keep searchQuery if you want; but clearing avoids confusion between categories
    // setServiceSearchQuery('');
  }, [currentStep, selectedCategory]);

  // Read booking prefill params (client-side) to avoid useSearchParams() build constraint
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    const prefillCategory = sp.get('prefill_category') || undefined;
    const prefillQuery = sp.get('prefill_query') || undefined;
    if (prefillCategory || prefillQuery) {
      setBookingPrefillParams({ category: prefillCategory, query: prefillQuery });
    }
  }, []);

  // Prefill service selection when coming from /services "Book Now"
  useEffect(() => {
    if (bookingPrefillApplied) return;
    if (currentStep !== 2) return; // only when selecting services
    if (!serviceTypes.length) return;

    const prefillCategory = bookingPrefillParams?.category || null;
    const prefillQuery = bookingPrefillParams?.query || null;
    if (!prefillCategory && !prefillQuery) return;

    const categoryWanted = prefillCategory ? String(prefillCategory) : null;
    const queryWanted = prefillQuery ? String(prefillQuery).toLowerCase() : null;

    const candidates = serviceTypes
      .filter((s: any) => (categoryWanted ? s.category === categoryWanted : true))
      .filter((s: any) => (queryWanted ? String(s.name || '').toLowerCase().includes(queryWanted) : true));

    const pick = candidates[0] || null;
    if (pick?.id) {
      if (categoryWanted) setSelectedCategory(categoryWanted);
      setFormData((prev) => ({
        ...prev,
        selectedServices: prev.selectedServices.includes(pick.id)
          ? prev.selectedServices
          : [...prev.selectedServices, pick.id],
      }));
      setBookingPrefillApplied(true);
    }
  }, [bookingPrefillApplied, currentStep, serviceTypes.length, bookingPrefillParams]);

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
      const cityName = String(formData.city?.name || '').trim();
      const stateName = String(formData.city?.state || '').trim();
      const selectedCityLower = cityName.toLowerCase();

      const escapeForOrFilter = (value: string) => value.replace(/[\(\),]/g, ' ').trim();
      const cityTerm = escapeForOrFilter(cityName);
      const stateTerm = escapeForOrFilter(stateName);

      const cityOrClause = [
        cityTerm ? `city.ilike.*${cityTerm}*` : '',
        cityTerm ? `address.ilike.*${cityTerm}*` : '',
        stateTerm ? `state.ilike.*${stateTerm}*` : '',
      ]
        .filter(Boolean)
        .join(',');

      const runWorkshopQuery = async (verifiedOnly: boolean) => {
        let query = supabase
          .from('workshops')
          .select('id, name, workshop_name, near_area_google_map, address, city, state, pincode, phone, email, contact_person')
          .order('name')
          .limit(5);

        if (verifiedOnly) {
          query = query.eq('is_verified', true);
        }
        if (cityOrClause) {
          query = query.or(cityOrClause);
        }
        return query;
      };

      const filterToSelectedCity = (rows: any[] = []) => {
        if (!selectedCityLower) return rows;
        return rows.filter((w: any) => String(w?.city || '').toLowerCase().includes(selectedCityLower));
      };

      // Primary: same area/city + verified (top 5)
      let { data: primaryData, error: primaryError } = await runWorkshopQuery(true);

      // If schema doesn't have is_verified, retry without that filter.
      if (primaryError && primaryError.code === '42703') {
        const retry = await runWorkshopQuery(false);
        primaryData = retry.data;
        primaryError = retry.error;
      }

      if (primaryError) {
        console.error('Error fetching workshops:', primaryError);
        setWorkshops([]);
        return;
      }

      // Fallback: same area/city without verified-only restriction
      const strictPrimary = filterToSelectedCity(primaryData || []);
      if (strictPrimary.length === 0) {
        const { data: fallbackData, error: fallbackError } = await runWorkshopQuery(false);
        if (fallbackError) {
          console.error('Error fetching fallback workshops:', fallbackError);
          setWorkshops([]);
          return;
        }
        const strictFallback = filterToSelectedCity(fallbackData || []);
        setWorkshops(strictFallback.slice(0, 5));
        return;
      }

      setWorkshops(strictPrimary.slice(0, 5));
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

        // Fetch customer-facing checklist templates (DB-driven) for auto “Show more”.
        // If the table doesn't exist / isn't accessible yet, we silently ignore and use fallbacks.
        try {
          const ids = (allServices || []).map((s: any) => s.id).filter(Boolean);
          if (ids.length > 0) {
            const { data: tplRows, error: tplError } = await supabase
              .from('service_type_checklist_templates')
              .select('service_type_id, title, points, checklist_items')
              .in('service_type_id', ids);

            if (!tplError && tplRows) {
              const map: Record<string, { title?: string; points?: number; items: any[] }> = {};
              (tplRows as any[]).forEach((r: any) => {
                const sid = r?.service_type_id;
                const items = Array.isArray(r?.checklist_items) ? r.checklist_items : [];
                if (sid && items.length > 0) {
                  map[sid] = {
                    title: r?.title || undefined,
                    points: typeof r?.points === 'number' ? r.points : undefined,
                    items,
                  };
                }
              });
              setServiceChecklistTemplates(map);
            }
          }
        } catch (e) {
          // ignore (no template table / no permissions)
        }
        
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
    // Auto-continue from step 1 once city + car model are selected.
    if (currentStep === 0 && formData.city) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(1);
        setIsAnimating(false);
      }, 220);
    }
  };

  const handleInputChange = (field: keyof BookingFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isValidIndianMobile = (rawPhone: string) => {
    const phone = String(rawPhone || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) return false;
    if (/^(\d)\1{9}$/.test(phone)) return false; // 1111111111, 2222222222...
    if (/^[6-9]0{9}$/.test(phone)) return false; // 9000000000 type
    if (/^(0123456789|1234567890|9876543210)$/.test(phone)) return false;
    if (new Set(phone.split('')).size <= 2) return false; // overly repetitive patterns
    return true;
  };

  const scrollToStepTop = () => {
    if (typeof window === 'undefined') return;
    const top = (formCardRef.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 84;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
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
      if (!isValidIndianMobile(formData.customerPhone)) {
        toast.error('Please enter a valid Indian mobile number');
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

    // Step 5 validation: payment timing required
    if (currentStep === 4) {
      if (!formData.paymentStatus) {
        toast.error('Please choose when to pay');
        return;
      }
    }

    setIsAnimating(true);
    setTimeout(() => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(currentStep + 1);
        scrollToStepTop();
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
      scrollToStepTop();
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

  const createLead = async (paymentData?: any) => {
    const leadNumber = `L-${Date.now().toString().slice(-8)}`;

    // Combine address fields: pickupAddress (auto-detected) + flatNumber (optional) + landmark (mandatory)
    const addressParts = [formData.pickupAddress.trim()];
    if (formData.flatNumber.trim()) {
      addressParts.unshift(formData.flatNumber.trim()); // Add flat number at start if provided
    }
    addressParts.push(formData.landmark.trim()); // Landmark is mandatory
    const completeAddress = addressParts.filter(part => part.length > 0).join(', ');

    const payload = {
      lead: {
        lead_number: leadNumber,
        created_from: 'WEB',
        status: 'NEW',
        lead_type: 'NORMAL',
        lead_source: 'Website',
        customer_name: formData.customerName?.trim() || `Customer_${formData.customerPhone.slice(-4)}`,
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
        workshop_id: formData.pickupRequired ? null : formData.selectedWorkshop?.id || null,
        address: formData.pickupRequired ? completeAddress : (formData.selectedWorkshop?.address || completeAddress),
        customer_address: formData.pickupRequired ? completeAddress : (formData.selectedWorkshop?.address || completeAddress),
        pickup_address: formData.pickupRequired ? completeAddress : null,
        preferred_slot_start: formData.pickupRequired && formData.pickupDate && formData.pickupTime 
          ? `${formData.pickupDate}T${formData.pickupTime}:00` 
          : null,
        estimated_amount: totalPrice > 0 ? totalPrice : null,
        lead_priority: 'NORMAL',
        created_at: new Date().toISOString(),
        payment_mode: formData.paymentMethod || null,
        payment_status: formData.paymentStatus || null,
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
    };

    const response = await fetch('/api/public/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.error || 'Failed to create booking');
    }
    return json?.lead;
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment gateway is loading. Please wait...');
      return;
    }

    if (couponAdjustedTotal <= 0) {
      try {
        const lead = await createLead();
        toast.success('🎉 Booking confirmed! We\'ll contact you shortly.');
        router.push(`/booking-success?lead=${lead?.lead_number}`);
      } catch (error: any) {
        console.error('Error creating booking:', error);
        toast.error('Failed to create booking. Please try again.');
      } finally {
        setIsProcessingPayment(false);
      }
      return;
    }

    if (totalPrice <= 0) {
      toast.error('Invalid amount. Please select services.');
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Validate customer details before creating payment order
      if (!isValidIndianMobile(formData.customerPhone)) {
        toast.error('Valid Indian mobile number is required for payment');
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
          amount: couponAdjustedTotal,
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
    if (!formData.city || !formData.carModel || !formData.customerPhone || !formData.paymentStatus) {
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
      if (!isValidIndianMobile(formData.customerPhone)) {
        toast.error('Valid Indian mobile number is required for payment');
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
  // Always compute "today" using IST calendar date.
  const getIndiaDate = () => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());

    const day = Number(parts.find((p) => p.type === 'day')?.value || '1');
    const month = Number(parts.find((p) => p.type === 'month')?.value || '1');
    const year = Number(parts.find((p) => p.type === 'year')?.value || '1970');
    return new Date(year, month - 1, day);
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

  const formatISTDayMonth = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00+05:30');
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
    }).format(date);
  };

  const formatISTWithWeekday = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00+05:30');
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  };
  
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const todayIST = getCurrentDate();
    const tomorrowIST = getNextDate();
    const dayAfterIST = getNextNextDate();

    if (compareISTDates(dateStr, todayIST)) return 'Today';
    if (compareISTDates(dateStr, tomorrowIST)) return 'Tomorrow';
    if (compareISTDates(dateStr, dayAfterIST)) {
      return formatISTWithWeekday(dateStr);
    }

    return formatISTWithWeekday(dateStr);
  };
  
  // Format date for button labels (shorter format)
  const formatDateForButton = (dateStr: string) => {
    if (!dateStr) return '';
    const todayIST = getCurrentDate();
    const tomorrowIST = getNextDate();
    const dayAfterIST = getNextNextDate();

    if (compareISTDates(dateStr, todayIST)) {
      return `Today, ${formatISTDayMonth(dateStr)}`;
    }
    if (compareISTDates(dateStr, tomorrowIST)) {
      return `Tomorrow, ${formatISTDayMonth(dateStr)}`;
    }
    if (compareISTDates(dateStr, dayAfterIST)) {
      return formatISTWithWeekday(dateStr);
    }

    return formatISTWithWeekday(dateStr);
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
    ? isValidIndianMobile(formData.customerPhone)
    : currentStep === 2
    ? formData.selectedServices.length > 0
    : currentStep === 3
    ? formData.pickupRequired
      ? formData.pickupDate !== '' && formData.pickupTime !== '' && formData.pickupAddress.trim() !== '' && formData.landmark.trim() !== ''
      : formData.selectedWorkshop !== null
    : formData.paymentStatus !== '';

  const totalPrice = formData.selectedServices.reduce((sum, serviceId) => {
    return sum + (servicePricing[serviceId] || 0);
  }, 0);
  const selectedServiceNames = formData.selectedServices
    .map((serviceId) => serviceTypes.find((s: any) => String(s.id) === String(serviceId))?.name)
    .filter(Boolean) as string[];

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

  const activeCategoryId = selectedCategory || serviceCategories[0]?.id || null;
  const isPeriodicCategory = String(activeCategoryId || '').toUpperCase() === 'PERIODIC SERVICE';
  const showReferencePlanUi = isPeriodicCategory;
  const activeCategoryServices = activeCategoryId ? serviceTypes.filter((s: any) => s.category === activeCategoryId) : [];
  const getOilTypeForService = (service: any): 'semi' | 'full' | 'unknown' => {
    const text = `${String(service?.name || '')} ${String(service?.description || '')}`.toLowerCase();

    const hasSemi =
      text.includes('semi synthetic') ||
      text.includes('semi-synthetic') ||
      text.includes('(semi)') ||
      /\bsemi\b/.test(text);

    const hasFull =
      text.includes('fully synthetic') ||
      text.includes('full synthetic') ||
      text.includes('synthetic full') ||
      text.includes('(fully)') ||
      text.includes('(full)') ||
      /\bfully\b/.test(text) ||
      /\bfull\b/.test(text);

    // If both keywords appear in a generic description, don't guess.
    if (hasSemi && hasFull) return 'unknown';
    if (hasFull) return 'full';
    if (hasSemi) return 'semi';
    return 'unknown';
  };
  const filteredCategoryServices = activeCategoryServices.filter((service: any) => {
    if (!isPeriodicCategory) return true;
    const oilType = getOilTypeForService(service);
    if (oilType === 'unknown') return false;
    return oilType === selectedOilType;
  });

  const sortedByPrice = [...filteredCategoryServices].sort((a: any, b: any) => {
    const pa = servicePricing[a?.id] ?? Number.POSITIVE_INFINITY;
    const pb = servicePricing[b?.id] ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });

  const pickPlanServices = () => {
    if (isPeriodicCategory) {
      const getPeriodicRank = (serviceName: string) => {
        const name = String(serviceName || '').toLowerCase();
        if (name.includes('basic')) return 0;
        if (name.includes('general')) return 1;
        if (name.includes('premium')) return 2;
        if (name.includes('platinum')) return 3;
        return 99;
      };

      const periodicSorted = [...sortedByPrice].sort((a: any, b: any) => {
        const ra = getPeriodicRank(a?.name);
        const rb = getPeriodicRank(b?.name);
        if (ra !== rb) return ra - rb;
        const pa = Number(a?.points || 0);
        const pb = Number(b?.points || 0);
        return pa - pb;
      });

      const chosenByRank = new Map<number, any>();
      for (const service of periodicSorted) {
        const rank = getPeriodicRank(service?.name);
        if (rank >= 0 && rank <= 3 && !chosenByRank.has(rank)) {
          chosenByRank.set(rank, service);
        }
      }

      const picked: any[] = [];
      [0, 1, 2, 3].forEach((rank) => {
        const s = chosenByRank.get(rank);
        if (s) picked.push(s);
      });

      for (const s of periodicSorted) {
        if (picked.length >= 4) break;
        if (!picked.find((x) => String(x?.id) === String(s?.id))) {
          picked.push(s);
        }
      }
      return picked.slice(0, 4);
    }

    if (sortedByPrice.length <= 4) return sortedByPrice;
    const low = sortedByPrice[0];
    const q1 = sortedByPrice[Math.floor((sortedByPrice.length - 1) * 0.33)];
    const q2 = sortedByPrice[Math.floor((sortedByPrice.length - 1) * 0.66)];
    const high = sortedByPrice[sortedByPrice.length - 1];
    const byId = new Map<string, any>();
    [low, q1, q2, high].forEach((s) => s?.id && byId.set(String(s.id), s));
    const picked = Array.from(byId.values());
    // ensure exactly 4 by filling from sorted list
    for (const s of sortedByPrice) {
      if (picked.length >= 4) break;
      const id = String(s?.id || '');
      if (id && !byId.has(id)) {
        byId.set(id, s);
        picked.push(s);
      }
    }
    return picked.slice(0, 4);
  };

  const planServices = pickPlanServices();
  const planIds = new Set(planServices.map((s: any) => String(s?.id)));
  const remainingServices = sortedByPrice.filter((s: any) => !planIds.has(String(s?.id)));
  const visibleRemainingServices = remainingServices;
  const selectedInActiveCategory = activeCategoryId
    ? serviceTypes.find((s: any) => String(s?.category) === String(activeCategoryId) && formData.selectedServices.includes(s.id))
    : null;

  const getEtaLabelFromPoints = (points?: number) => {
    const p = Number(points || 0);
    if (!Number.isFinite(p) || p <= 0) return null;
    if (p >= 60) return '6h';
    if (p >= 50) return '5h';
    if (p >= 30) return '4h';
    if (p >= 15) return '2h';
    return '2h';
  };

  const getChecklistForService = (service: any) => {
    const db = serviceChecklistTemplates?.[service?.id];
    if (db?.items?.length) {
      return {
        source: 'db' as const,
        title: db.title || 'Checklist',
        points: typeof db.points === 'number' ? db.points : undefined,
        items: db.items as any[],
      };
    }
    const fallback = getFallbackChecklistTemplate(service?.name || '');
    return {
      source: 'fallback' as const,
      title: fallback?.title || 'Checklist',
      points: typeof fallback?.points === 'number' ? fallback.points : undefined,
      items: (fallback?.items || []) as any[],
    };
  };

  const normalizeChecklistItem = (it: any): { name: string; category?: string } | null => {
    if (!it) return null;
    if (typeof it === 'string') return { name: it };
    const name = String(it?.name || it?.title || it?.label || '').trim();
    if (!name) return null;
    const category = it?.category ? String(it.category).trim() : undefined;
    return { name, category: category || undefined };
  };

  const getPointsFromServiceName = (name: string): number => {
    const match = String(name || '').match(/(\d+)\s*points?/i);
    return match ? Number(match[1]) : 0;
  };

  const getActualServicePoints = (service: any, checklistPoints?: number): number => {
    const fromName = getPointsFromServiceName(String(service?.name || ''));
    if (isPeriodicCategory && fromName > 0) return fromName;
    return Number(service?.points) || Number(checklistPoints) || fromName || 0;
  };

  const getChecklistUniqueItems = (service: any) => {
    const c = getChecklistForService(service);
    const normalized = (c.items || []).map(normalizeChecklistItem).filter(Boolean) as Array<{ name: string; category?: string }>;
    const seen = new Set<string>();
    const unique: Array<{ name: string; category?: string }> = [];
    for (const n of normalized) {
      const key = n.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(n);
    }
    return { ...c, unique };
  };

  const getChecklistPreview = (service: any, limit: number) => {
    const c = getChecklistUniqueItems(service);
    return { ...c, preview: c.unique.slice(0, limit), totalCount: c.unique.length };
  };

  const getPeriodicChecklistPreview = (service: any, allPeriodicPlans: any[], limit: number) => {
    const current = getChecklistUniqueItems(service);
    const sortedPlans = [...allPeriodicPlans].sort((a: any, b: any) => {
      const pa = getActualServicePoints(a);
      const pb = getActualServicePoints(b);
      return pa - pb;
    });
    const currentIdx = sortedPlans.findIndex((s: any) => String(s?.id) === String(service?.id));
    if (currentIdx <= 0) {
      const basePreview = current.unique.slice(0, limit);
      return { ...current, preview: basePreview, totalCount: current.unique.length, newCount: basePreview.length };
    }

    const prevPlan = sortedPlans[currentIdx - 1];
    const prev = getChecklistUniqueItems(prevPlan);
    const prevSet = new Set(prev.unique.map((it) => it.name.toLowerCase()));
    const onlyNew = current.unique.filter((it) => !prevSet.has(it.name.toLowerCase()));
    const preview = (onlyNew.length > 0 ? onlyNew : current.unique).slice(0, limit);

    return { ...current, preview, totalCount: current.unique.length, newCount: onlyNew.length };
  };

  const getPeriodicNewPointsCount = (service: any, allPeriodicPlans: any[]) => {
    const sortedPlans = [...allPeriodicPlans].sort((a: any, b: any) => getActualServicePoints(a) - getActualServicePoints(b));
    const currentIdx = sortedPlans.findIndex((s: any) => String(s?.id) === String(service?.id));
    const currentPoints = getActualServicePoints(service);
    if (currentIdx <= 0) {
      return Math.max(currentPoints - 5, 0);
    }
    const prevPoints = getActualServicePoints(sortedPlans[currentIdx - 1]);
    return Math.max(currentPoints - prevPoints, 0);
  };

  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => {
      const isSelected = prev.selectedServices.includes(serviceId);
      const targetService = serviceTypes.find((s: any) => String(s?.id) === String(serviceId));
      if (!targetService?.category) {
        return {
          ...prev,
          selectedServices: isSelected
            ? prev.selectedServices.filter(id => id !== serviceId)
            : [...prev.selectedServices, serviceId]
        };
      }

      const selectedFromOtherCategories = prev.selectedServices.filter((id) => {
        const s = serviceTypes.find((it: any) => String(it?.id) === String(id));
        return String(s?.category) !== String(targetService.category);
      });

      if (isSelected) {
        return {
          ...prev,
          selectedServices: prev.selectedServices.filter(id => id !== serviceId)
        };
      }

      return {
        ...prev,
        // Keep a single selected package per category.
        selectedServices: [...selectedFromOtherCategories, serviceId]
      };
    });
  };
  
  const ensureServiceSelected = (serviceId: string) => {
    setFormData((prev) => {
      if (prev.selectedServices.includes(serviceId)) return prev;
      const targetService = serviceTypes.find((s: any) => String(s?.id) === String(serviceId));
      if (!targetService?.category) return { ...prev, selectedServices: [...prev.selectedServices, serviceId] };

      const selectedFromOtherCategories = prev.selectedServices.filter((id) => {
        const s = serviceTypes.find((it: any) => String(it?.id) === String(id));
        return String(s?.category) !== String(targetService.category);
      });
      return { ...prev, selectedServices: [...selectedFromOtherCategories, serviceId] };
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
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-brand-primary via-brand-primary to-brand-secondary pt-20 sm:pt-24 md:pt-28 pb-16 sm:pb-20 md:pb-24">
        <div className="container mx-auto px-4 sm:px-4 md:px-6">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-1 sm:mb-2">
              Book Service Now
            </h1>
            <p className="text-sm sm:text-base text-white/80 mb-4 sm:mb-5">
              {currentStepData.subtitle || 'Select your location and car model'}
            </p>
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-all duration-300 ${
                    index <= currentStep ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 md:px-6 -mt-10 sm:-mt-14 md:-mt-16 pb-8 sm:pb-12 md:pb-16 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div ref={formCardRef} className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
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
                  {currentStepData.subtitle ? (
                    <p className="text-sm sm:text-base text-gray-600">
                      {currentStepData.subtitle}
                    </p>
                  ) : null}
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
                            const selectedLabel = formData.carModel
                              ? `${formData.carModel.make} ${formData.carModel.model_name}`
                              : '';
                            if (carSearchQuery.length > 0 && (!formData.carModel || carSearchQuery !== selectedLabel)) {
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
                      
                        {showCarSuggestions &&
                          carSuggestions.length > 0 &&
                          (!formData.carModel ||
                            carSearchQuery !== `${formData.carModel.make} ${formData.carModel.model_name}`) && (
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

                    {/* Trust Badge */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/50 rounded-xl">
                      <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-purple-800">
                        No login required. Book in under 2 minutes.
                      </p>
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
                          formData.customerPhone && isValidIndianMobile(formData.customerPhone)
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
                      {formData.customerPhone && isValidIndianMobile(formData.customerPhone) && (
                        <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 mt-4 sm:mt-6">
                          <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                        </div>
                      )}
                      {formData.customerPhone && formData.customerPhone.length < 10 && (
                        <p className="mt-1 text-xs text-gray-500">
                          {formData.customerPhone.length}/10 digits
                        </p>
                      )}
                      {formData.customerPhone.length === 10 && !isValidIndianMobile(formData.customerPhone) && (
                        <p className="mt-1 text-xs text-red-500">
                          Enter a valid Indian mobile number (starts with 9/8/7/6; invalid repetitive numbers are not allowed).
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
                        {/* "Choose your service" sub-heading (shown once, smaller font) */}
                        <div className="mb-3">
                          <div className="text-sm sm:text-base font-bold text-gray-700">Choose your service</div>
                        </div>

                        {/* Category pills (horizontal) */}
                        {serviceCategories.length > 0 && (
                          <div className="mb-4 sm:mb-6">
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {serviceCategories.map((category) => {
                                const isSelected = activeCategoryId === category.id;
                                return (
                                  <button
                                    key={category.id}
                                    onClick={() => {
                                      setSelectedCategory(category.id);
                                      setServiceSearchQuery('');
                                      setDetailsService(null);
                                    }}
                                    className={`whitespace-nowrap px-4 py-2 rounded-full border transition-all text-sm font-semibold ${
                                      isSelected
                                        ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/50'
                                    }`}
                                  >
                                    {category.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {filteredCategoryServices.length === 0 ? (
                          <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
                            <Search className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-700 font-semibold">No services found</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {isPeriodicCategory
                                ? 'Selected oil type me service available nahi hai. Switch change karke dekhiye.'
                                : 'Try a different keyword or change category'}
                            </p>
                              </div>
                            ) : (
                          <>
                            {/* Plans */}
                            <div className="mb-5 sm:mb-7">
                              {showReferencePlanUi && (
                                <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
                                  <div className="text-base font-extrabold text-gray-900 mb-2">Select Oil Type</div>
                                  <div className="grid grid-cols-2 rounded-full bg-white p-1 shadow-sm border border-gray-200 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setSelectedOilType('semi')}
                                        className={`rounded-full w-full px-3 py-2 text-xs font-bold transition-all ${
                                          selectedOilType === 'semi'
                                            ? 'bg-brand-primary text-white shadow'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                      >
                                        Semi-Synthetic
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedOilType('full')}
                                        className={`rounded-full w-full px-3 py-2 text-xs font-bold transition-all ${
                                          selectedOilType === 'full'
                                            ? 'bg-brand-primary text-white shadow'
                                            : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                      >
                                        Fully-Synthetic
                                      </button>
                                  </div>
                                </div>
                              )}
                              <div className={`grid ${showReferencePlanUi ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-4'} gap-3 sm:gap-5`}>
                                {planServices.map((service: any, idx: number) => {
                                  const isSelected = formData.selectedServices.includes(service.id);
                                  const isLockedByOtherSelection =
                                    !!selectedInActiveCategory && String(selectedInActiveCategory.id) !== String(service.id);
                                  const price = servicePricing[service.id] || 0;
                                  const checklist = showReferencePlanUi
                                    ? getPeriodicChecklistPreview(service, planServices, 6)
                                    : getChecklistPreview(service, 6);
                                  const items = checklist.preview;
                                  const visiblePointItems = showReferencePlanUi ? items.slice(0, 5) : items;
                                  const eta = getEtaLabelFromPoints(Number(service.points) || checklist.points);
                                  const planLabel =
                                    idx === 0 ? 'Basic' : idx === 1 ? 'Standard' : idx === 2 ? 'Premium' : 'Comprehensive';
                                  const serviceNameLower = String(service?.name || '').toLowerCase();
                                  const periodicTitleFromName =
                                    serviceNameLower.includes('basic')
                                      ? 'Basic Service'
                                      : serviceNameLower.includes('general')
                                        ? 'General Service'
                                        : serviceNameLower.includes('premium')
                                          ? 'Premium Service'
                                          : serviceNameLower.includes('platinum')
                                            ? 'Platinum Service'
                                            : service.name;
                                  const displayTitle = showReferencePlanUi ? periodicTitleFromName : service.name;
                                  const pointsValue = getActualServicePoints(service, checklist.points);
                                  const newPointsCount = showReferencePlanUi
                                    ? getPeriodicNewPointsCount(service, planServices)
                                    : Number((checklist as any).newCount || 0);
                                  
                                  return (
                              <div
                                      key={service.id}
                                      className={`relative border-2 bg-white shadow-sm transition-all h-full flex flex-col ${
                                        showReferencePlanUi ? 'rounded-3xl p-5 sm:p-6' : 'rounded-2xl p-5 sm:p-6'
                                      } ${
                                        isSelected ? 'border-brand-primary shadow-lg' : 'border-gray-200 hover:border-brand-primary/50 hover:shadow-md'
                                      }`}
                                    >
                                {!showReferencePlanUi && idx === 1 && (
                                  <div className="absolute left-5 right-5 -top-3">
                                    <div className="mx-auto w-fit rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-4 py-1 text-xs font-extrabold text-white shadow">
                                      MOST POPULAR
                                          </div>
                                  </div>
                                )}

                                      {showReferencePlanUi ? (
                                        <>
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-lg sm:text-xl leading-[1.15] font-extrabold text-gray-900 break-words">{displayTitle}</div>
                                              <div className="mt-1 text-xs sm:text-sm font-bold text-brand-primary">
                                                {pointsValue > 0 ? `${pointsValue} Activity Points` : 'Activity Points Included'}
                                              </div>
                                            </div>
                                            {/* Price at top-right corner on mobile only */}
                                            <div className="text-right flex-shrink-0 sm:hidden">
                                              <div className="text-lg font-extrabold leading-none text-gray-900">
                                                {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'NA'}
                                              </div>
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="inline-flex items-center gap-2">
                                              <span className="text-xs font-extrabold tracking-wide uppercase text-gray-600">{planLabel}</span>
                                              {isSelected ? (
                                                <span className="text-[11px] font-extrabold text-white bg-brand-primary px-2 py-0.5 rounded-full">
                                                  Selected
                                                </span>
                                              ) : null}
                                            </div>
                                            <div className="mt-1 text-lg font-extrabold text-gray-900 break-words">{displayTitle}</div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                                              {eta ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                                                  <Clock className="w-3.5 h-3.5" /> {eta}
                                                </span>
                                              ) : null}
                                              {service.points ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                                                  <CheckCircle className="w-3.5 h-3.5" /> {service.points} pts
                                                </span>
                                              ) : null}
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <button
                                              type="button"
                                              onClick={() => setDetailsService({ service, checklistTemplate: checklist, price })}
                                              className="text-xs font-bold text-brand-primary hover:text-brand-secondary underline underline-offset-4"
                                            >
                                              View checklist
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      <div className="mt-4">
                                        {!showReferencePlanUi && (
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-gray-700">What you get</div>
                                            {checklist.source === 'fallback' ? (
                                              <span className="text-[10px] font-bold text-gray-500">Standard</span>
                                            ) : (
                                              <span className="text-[10px] font-bold text-green-700">Official</span>
                                            )}
                                          </div>
                                        )}
                                        <div className={`${showReferencePlanUi ? 'space-y-2' : 'space-y-2'}`}>
                                  {visiblePointItems.length > 0 ? (
                                    visiblePointItems.map((it: any, i: number) => (
                                      <div key={`${it?.name || ''}-${i}`} className={`flex items-start gap-2 ${showReferencePlanUi ? 'text-[13px]' : 'text-sm'} text-gray-700`}>
                                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                        <span className="break-words line-clamp-2">
                                          {it?.name || String(it)}
                                          {!showReferencePlanUi && it?.category ? (
                                            <span className="ml-2 text-[10px] font-bold text-gray-400">{it.category}</span>
                                          ) : null}
                                        </span>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm text-gray-600">Standard maintenance & inspection included.</div>
                                            )}
                                          {showReferencePlanUi ? (
                                            <button
                                              type="button"
                                              onClick={() => setDetailsService({ service, checklistTemplate: checklist, price })}
                                              className="text-[13px] font-bold text-brand-primary hover:text-brand-secondary mt-1"
                                            >
                                              View all points
                                            </button>
                                          ) : null}
                                        </div>
                                </div>

                                <div className={`mt-auto pt-4 ${showReferencePlanUi ? 'flex flex-col items-start gap-2' : 'border-t border-gray-200 flex items-end justify-between gap-3'}`}>
                                  {showReferencePlanUi ? (
                                    <div className="text-2xl font-extrabold text-gray-900">
                                      {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'NA'}
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="text-xs text-gray-500">{`Total for ${formData.city?.name}`}</div>
                                      <div className="text-xl font-extrabold text-gray-900">
                                        {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'Price on request'}
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                          onClick={() => {
                                            if (isLockedByOtherSelection) return;
                                            if (!isSelected) {
                                              handleServiceToggle(service.id);
                                              setTimeout(() => handleNext(), 150);
                                              return;
                                            }
                                            handleNext();
                                          }}
                                          className={`font-extrabold text-sm transition-all ${
                                      showReferencePlanUi
                                        ? `px-5 py-2.5 rounded-full self-start ${
                                            isSelected
                                              ? 'bg-brand-primary text-white'
                                              : 'bg-brand-primary text-white hover:bg-brand-secondary'
                                          }`
                                        : `px-4 py-2.5 rounded-xl ${
                                            isSelected
                                              ? 'bg-brand-primary text-white'
                                              : 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-md shadow-brand-primary/20 hover:shadow-lg hover:shadow-brand-primary/30'
                                          }`
                                    } ${isLockedByOtherSelection ? 'opacity-50 cursor-not-allowed hover:shadow-none hover:bg-brand-primary' : ''}`}
                                    disabled={isLockedByOtherSelection}
                                  >
                                    {showReferencePlanUi ? (isSelected ? 'Continue' : 'Select Package') : (isSelected ? 'Continue' : 'Select')}
                                  </button>
                                </div>
                              </div>
                            );
                                })}
                              </div>
                            </div>

                            {/* More services (same card layout as plans) */}
                            {!showReferencePlanUi && remainingServices.length > 0 && (
                              <div className="mt-6">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="text-sm font-extrabold text-gray-900">More services</div>
                                  <div className="text-xs text-gray-500">{remainingServices.length} services</div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                                  {visibleRemainingServices.map((service: any) => {
                                    const isSelected = formData.selectedServices.includes(service.id);
                                    const price = servicePricing[service.id] || 0;
                                    const checklist = getChecklistPreview(service, 6);
                                    const items = checklist.preview;
                                    const eta = getEtaLabelFromPoints(Number(service.points) || checklist.points);

                                    return (
                                      <div
                                        key={service.id}
                                        className={`relative rounded-2xl border-2 bg-white p-5 sm:p-6 shadow-sm transition-all h-full ${
                                          isSelected ? 'border-brand-primary shadow-lg' : 'border-gray-200 hover:border-brand-primary/50 hover:shadow-md'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="mt-1 text-lg font-extrabold text-gray-900 break-words">{service.name}</div>
                                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                                              {eta ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                                                  <Clock className="w-3.5 h-3.5" /> {eta}
                                                </span>
                                              ) : null}
                                              {service.points ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                                                  <CheckCircle className="w-3.5 h-3.5" /> {service.points} pts
                                                </span>
                                              ) : null}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => setDetailsService({ service, checklistTemplate: checklist, price })}
                                            className="text-xs font-bold text-brand-primary hover:text-brand-secondary underline underline-offset-4"
                                          >
                                            View checklist
                                          </button>
                                        </div>

                                        <div className="mt-4">
                                          <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-gray-700">What you get</div>
                                            {checklist.source === 'fallback' ? (
                                              <span className="text-[10px] font-bold text-gray-500">Standard</span>
                                            ) : (
                                              <span className="text-[10px] font-bold text-green-700">Official</span>
                                            )}
                                          </div>
                                          <div className="space-y-2">
                                            {items.length > 0 ? (
                                              items.map((it: any, i: number) => (
                                                <div key={`${it?.name || ''}-${i}`} className="flex items-start gap-2 text-sm text-gray-700">
                                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                                  <span className="break-words">{it?.name || String(it)}</span>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="text-sm text-gray-600">Standard maintenance & inspection included.</div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="mt-6 pt-4 border-t border-gray-200 flex items-end justify-between gap-3">
                                          <div>
                                            <div className="text-xs text-gray-500">Total for {formData.city?.name}</div>
                                            <div className="text-xl font-extrabold text-gray-900">
                                              {price > 0 ? `₹${price.toLocaleString('en-IN')}` : 'Price on request'}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!isSelected) {
                                                handleServiceToggle(service.id);
                                                return;
                                              }
                                              handleNext();
                                            }}
                                            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all ${
                                              isSelected
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-md shadow-brand-primary/20 hover:shadow-lg hover:shadow-brand-primary/30'
                                            }`}
                                          >
                                            {isSelected ? 'Continue' : 'Select'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Step actions (organized + clear) */}
                            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={handleBack}
                                className="flex items-center gap-2 px-4 py-3 rounded-xl font-extrabold text-sm text-gray-700 hover:bg-gray-50 transition-all border border-gray-200"
                              >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                              </button>
                              <button
                                type="button"
                                onClick={handleNext}
                                disabled={!canProceed || isProcessingPayment}
                                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-extrabold text-sm transition-all ${
                                  canProceed && !isProcessingPayment
                                    ? 'bg-gradient-to-r from-brand-primary to-brand-secondary text-white shadow-lg shadow-brand-primary/30 hover:shadow-xl hover:shadow-brand-primary/40'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                Continue
                                <ArrowRight className="w-4 h-4" />
                              </button>
                  </div>
                          </>
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
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                        {/* Left Label - Pickup Required */}
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, pickupRequired: true, selectedWorkshop: null }))}
                          className="min-w-0 text-left"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all ${
                              formData.pickupRequired
                                ? 'bg-indigo-500'
                                : 'bg-gray-300'
                            }`}>
                              <Navigation className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                formData.pickupRequired ? 'text-white' : 'text-gray-500'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <h4 className={`font-bold text-sm sm:text-lg transition-all ${
                                formData.pickupRequired ? 'text-indigo-700' : 'text-gray-500'
                              }`}>
                                Pickup Required
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-tight">
                                We&apos;ll pick up your vehicle
                              </p>
                            </div>
                          </div>
                        </button>

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
                          className={`relative inline-flex h-11 w-20 sm:h-14 sm:w-28 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            formData.pickupRequired
                              ? 'bg-indigo-500 focus:ring-indigo-500'
                              : 'bg-green-500 focus:ring-green-500'
                          }`}
                        >
                          <span
                            className={`inline-block h-9 w-9 sm:h-12 sm:w-12 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${
                              formData.pickupRequired ? 'translate-x-1.5 sm:translate-x-3' : 'translate-x-10 sm:translate-x-14'
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
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, pickupRequired: false, pickupDate: '', pickupTime: '', pickupAddress: '', flatNumber: '', landmark: '' }))}
                          className="min-w-0 text-right"
                        >
                          <div className="flex items-center justify-end gap-2 sm:gap-3">
                            <div className="min-w-0">
                              <h4 className={`font-bold text-sm sm:text-lg transition-all ${
                                !formData.pickupRequired ? 'text-green-700' : 'text-gray-500'
                              }`}>
                                Self Come
                              </h4>
                              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 leading-tight">
                                Visit our workshop
                              </p>
                            </div>
                            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-all ${
                              !formData.pickupRequired
                                ? 'bg-green-500'
                                : 'bg-gray-300'
                            }`}>
                              <MapPin className={`w-4 h-4 sm:w-5 sm:h-5 ${
                                !formData.pickupRequired ? 'text-white' : 'text-gray-500'
                              }`} />
                            </div>
                          </div>
                        </button>
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
                                    {formatDateDMY(formData.pickupDate)}
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
                                    {formatDateDMY(formData.pickupDate)}
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
                        {formData.pickupDate ? (
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
                        ) : (
                          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600">
                            Select a pickup date to choose a time slot.
                          </div>
                        )}

                        {/* Pickup Address - Auto Detect (Area, City, State, Pincode) */}
                        {formData.pickupDate && formData.pickupTime ? (
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
                        ) : (
                          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm text-gray-600">
                            Select a pickup time to enter your address.
                          </div>
                        )}

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
                            <div>
                              <p className="mb-3 text-xs font-semibold text-gray-500">
                                Showing up to 5 workshops near {formData.city?.name || 'your selected area'}
                              </p>
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
                                          {workshop.workshop_name || workshop.name}
                                        </h4>
                                        <div className="space-y-1 text-xs sm:text-sm">
                                          {(workshop.city || workshop.state || workshop.pincode) && (
                                            <p className={isSelected ? 'text-green-600' : 'text-gray-500'}>
                                              {[workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ')}
                                            </p>
                                          )}
                                          {workshop.near_area_google_map && (
                                            <a
                                              href={workshop.near_area_google_map}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className={`flex items-center gap-2 underline underline-offset-2 ${
                                                isSelected ? 'text-green-700' : 'text-gray-600'
                                              }`}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <MapPin className="w-4 h-4" />
                                              <span className="cursor-pointer">View map</span>
                                            </a>
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
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-600 shrink-0">Location:</span>
                        <span className="font-semibold text-right break-words">{formData.city?.name || '—'}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-600 shrink-0">Vehicle:</span>
                        <span className="font-semibold text-right break-words">
                          {formData.carModel ? `${formData.carModel.make} ${formData.carModel.model_name}` : '—'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-600 shrink-0">Services:</span>
                        <span className="font-semibold text-right break-words leading-tight">
                          {selectedServiceNames.length > 0 ? selectedServiceNames.join(', ') : '—'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-gray-600 shrink-0">Estimated Price:</span>
                        <span className="font-extrabold text-right text-green-700">
                          {totalPrice > 0 ? `₹${totalPrice.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </div>
                      {formData.pickupRequired && formData.pickupDate && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-600 shrink-0">Pickup:</span>
                          <span className="font-semibold text-right break-words">
                            {formatDateDMY(formData.pickupDate)} at {formData.pickupTime}
                          </span>
                        </div>
                      )}
                      {!formData.pickupRequired && formData.selectedWorkshop && (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-gray-600 shrink-0">Workshop:</span>
                          <span className="font-semibold text-right break-words">
                            {formData.selectedWorkshop.workshop_name || formData.selectedWorkshop.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
              )}

              {/* Step 5: Payment Options */}
              {currentStep === 4 && (
                <div className="mb-8 sm:mb-10 md:mb-12 space-y-4 sm:space-y-6">
                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-brand-primary" />
                      When to Pay?
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, paymentStatus: 'PAY_LATER', paymentMethod: 'CASH' }))
                        }
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
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, paymentStatus: 'PAY_NOW', paymentMethod: 'RAZORPAY' }))
                        }
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

                  {/* Coupon */}
                  <div className="mt-4 sm:mt-6 p-4 sm:p-5 bg-white border-2 border-gray-200 rounded-xl">
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 mb-3">
                      Apply Coupon <span className="text-xs font-semibold text-gray-500">(Optional)</span>
                    </h4>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
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
                    {couponError && (
                      <div className="text-xs text-red-600 mt-2">{couponError}</div>
                    )}
                    {couponMeta && (
                      <div className="mt-2 text-xs text-green-700">
                        Coupon applied: <strong>{couponMeta.code}</strong>
                      </div>
                    )}
                  </div>

                  {/* Final Summary */}
                  <div className="mt-4 sm:mt-6 p-4 sm:p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 mb-3 sm:mb-4">Final Booking Summary</h4>
                    <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-gray-600">Total Amount:</span>
                        <span className="text-xl sm:text-2xl font-bold text-green-700">
                          ₹{couponAdjustedTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                      {couponMeta && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Coupon Applied:</span>
                            <span className="font-semibold">{couponMeta.code}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Discount:</span>
                            <span className="font-semibold text-green-700">
                              -₹{Number(couponDiscount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          {couponMeta?.free_service?.matched_label && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Free Service:</span>
                              <span className="font-semibold">{couponMeta.free_service.matched_label}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Flow:</span>
                        <span className="font-semibold">
                          {formData.paymentStatus === 'PAY_NOW' ? 'Razorpay Checkout' : 'Pay After Service'}
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
                <div className={`flex items-center justify-between pt-4 sm:pt-6 md:pt-8 border-t border-gray-100 gap-3 sm:gap-4 ${currentStep === 2 ? 'hidden' : ''}`}>
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
                    Back
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

      {/* Step 3: Service Details Modal */}
      {currentStep === 2 && detailsService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetailsService(null)} />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg sm:text-xl font-extrabold text-gray-900 truncate">
                  {detailsService.service?.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                  <span>Checklist</span>
                  {detailsService?.checklistTemplate?.points ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" /> {detailsService.checklistTemplate.points} pts
                    </span>
                  ) : null}
                  {detailsService?.checklistTemplate?.source ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ${
                        detailsService.checklistTemplate.source === 'db'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {detailsService.checklistTemplate.source === 'db' ? 'Official' : 'Standard'}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsService(null)}
                className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
              <div className="lg:col-span-8 p-4 sm:p-6">
                {(() => {
                  const raw = detailsService.checklistTemplate?.items || [];
                  const normalized = raw
                    .map((it: any) => {
                      if (!it) return null;
                      if (typeof it === 'string') return { name: it, category: 'General' };
                      const name = String(it?.name || it?.title || it?.label || '').trim();
                      if (!name) return null;
                      const category = String(it?.category || 'General').trim() || 'General';
                      return { name, category };
                    })
                    .filter(Boolean) as Array<{ name: string; category: string }>;

                  const groups = new Map<string, Array<{ name: string; category: string }>>();
                  for (const it of normalized) {
                    const key = it.category || 'General';
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(it);
                  }

                  // Highlight "new" checkpoints vs previous plan (15 -> 30 -> 60 etc.)
                  const planDiff = (() => {
                    const currentId = String(detailsService?.service?.id || '');
                    if (!currentId) return null;

                    // Only compare within the 3 plan cards for the active category (keeps expectations sane).
                    const plans = (planServices || [])
                      .map((s: any) => {
                        const c = getChecklistForService(s);
                        const points = Number(s?.points) || Number(c?.points) || 0;
                        return { id: String(s?.id || ''), name: String(s?.name || ''), points, checklist: c };
                      })
                      .filter((p) => p.id && Number.isFinite(p.points) && p.points > 0)
                      .sort((a, b) => a.points - b.points);

                    const idx = plans.findIndex((p) => p.id === currentId);
                    if (idx <= 0) return null;
                    const prev = plans[idx - 1];
                    const prevSet = new Set<string>();
                    (prev.checklist?.items || [])
                      .map((it: any) => normalizeChecklistItem(it))
                      .filter(Boolean)
                      .forEach((it: any) => prevSet.add(String(it.name).toLowerCase()));

                    return {
                      prevName: prev.name || 'previous plan',
                      prevPoints: prev.points,
                      prevSet,
                    };
                  })();

                  const newCount = planDiff?.prevSet
                    ? normalized.reduce((acc, it) => acc + (planDiff.prevSet.has(it.name.toLowerCase()) ? 0 : 1), 0)
                    : 0;

                  const categories = Array.from(groups.keys());
                  return (
                    <div className="space-y-5">
                      {planDiff?.prevSet ? (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-extrabold">
                              +{newCount} New Checkpoints
                            </div>
                            <div className="text-xs font-bold text-emerald-800">
                              vs {planDiff.prevPoints} pts plan
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-emerald-800">
                            Highlighted items are new in this plan.
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 lg:hidden bg-green-50 border border-green-200 rounded-xl p-3">
                            <div className="text-xl font-extrabold text-gray-900">
                              {detailsService.price > 0 ? `₹${detailsService.price.toLocaleString('en-IN')}` : '—'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                ensureServiceSelected(detailsService.service.id);
                                setDetailsService(null);
                                setTimeout(() => handleNext(), 0);
                              }}
                              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-extrabold text-xs bg-green-600 hover:bg-green-700 text-white shadow"
                            >
                              Proceed to Book
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="lg:hidden mb-2">
                          <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl p-3">
                            <div className="text-xl font-extrabold text-gray-900">
                              {detailsService.price > 0 ? `₹${detailsService.price.toLocaleString('en-IN')}` : '—'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                ensureServiceSelected(detailsService.service.id);
                                setDetailsService(null);
                                setTimeout(() => handleNext(), 0);
                              }}
                              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-extrabold text-xs bg-green-600 hover:bg-green-700 text-white shadow"
                            >
                              Proceed to Book
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {categories.map((cat) => (
                        <div key={cat}>
                          <div className="text-xs font-extrabold uppercase tracking-wider text-gray-500 mb-2">
                            {cat}
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:gap-3">
                            {groups.get(cat)!.map((it, idx) => (
                              (() => {
                                const isNew = planDiff?.prevSet ? !planDiff.prevSet.has(it.name.toLowerCase()) : false;
                                return (
                              <div
                                key={`${cat}-${idx}-${it.name}`}
                                className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${
                                  isNew
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                    : 'border-gray-200 bg-gray-50 text-gray-800'
                                }`}
                              >
                                <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isNew ? 'text-emerald-600' : 'text-green-600'}`} />
                                <span className="break-words flex-1">{it.name}</span>
                              </div>
                                );
                              })()
                            ))}
                          </div>
                        </div>
                      ))}
                      {!normalized.length ? (
                        <div className="text-sm text-gray-600">No checklist available for this service.</div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>

              <div className="lg:col-span-4 p-4 sm:p-6 border-t lg:border-t-0 lg:border-l border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="text-xs text-green-700 font-semibold">Estimated Total</div>
                <div className="mt-1 text-3xl font-extrabold text-gray-900">
                  {detailsService.price > 0 ? `₹${detailsService.price.toLocaleString('en-IN')}` : '—'}
                </div>
                <div className="mt-1 text-xs text-green-600">*Excluding taxes & parts (if any)</div>

                <button
                  type="button"
                  onClick={() => {
                    ensureServiceSelected(detailsService.service.id);
                    setDetailsService(null);
                    setTimeout(() => handleNext(), 0);
                  }}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-extrabold text-sm sm:text-base bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30"
                >
                  Proceed to Book
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="mt-3 text-xs text-green-600 text-center">
                  You can change your package later before payment.
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}