'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { createClient } from '@/lib/supabase/client';
import { 
  User, Phone, Mail, MapPin, Car, Wrench, Calendar,
  Clock, DollarSign, AlertCircle, CheckCircle, ArrowRight, 
  Navigation, Sparkles, Trophy, Target, ChevronRight,
  CreditCard, Package, Gift, Zap, ShieldCheck, Star,
  Smile, ThumbsUp, Rocket, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function BookServicePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const [formData, setFormData] = useState({
    // Step 1: Customer Details
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city_id: '',
    pincode: '',
    
    // Step 2: Vehicle Details
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    // Step 3: Service Details
    service_types: [] as string[],
    service_addons: [] as string[],
    problem_description: '',
    
    // Step 4: Pickup & Scheduling
    pickup_required: false,
    pickup_address: '',
    preferred_date: '',
    preferred_time: '',
    
    // Step 5: Additional
    coupon_code: '',
    payment_mode: 'CASH',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Options data
  const [cities, setCities] = useState<any[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [allCarModels, setAllCarModels] = useState<any[]>([]); // All models for search
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingPickupLocation, setLoadingPickupLocation] = useState(false);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  
  // Car search autocomplete
  const [carSearchQuery, setCarSearchQuery] = useState('');
  const [carSearchSuggestions, setCarSearchSuggestions] = useState<any[]>([]);
  const [showCarSuggestions, setShowCarSuggestions] = useState(false);
  const [selectedCarModel, setSelectedCarModel] = useState<any>(null);
  
  // Price calculation
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);

  // Fetch options on mount
  useEffect(() => {
    fetchOptionsData();
  }, []);

  // Fetch all car models for search on mount
  useEffect(() => {
    fetchAllCarModels();
  }, []);

  // Calculate price when mobile number is entered and services are selected
  useEffect(() => {
    if (formData.customer_phone && formData.customer_phone.length === 10) {
      calculatePrice();
    } else {
      setEstimatedPrice(null);
    }
  }, [formData.customer_phone, formData.service_types, formData.service_addons, serviceTypes, serviceAddons]);

  // Filter car suggestions based on search query
  useEffect(() => {
    if (carSearchQuery.length > 0) {
      const query = carSearchQuery.toLowerCase();
      const filtered = allCarModels.filter((car: any) => 
        car.make.toLowerCase().includes(query) || 
        car.model_name.toLowerCase().includes(query) ||
        `${car.make} ${car.model_name}`.toLowerCase().includes(query)
      ).slice(0, 10); // Limit to 10 suggestions
      setCarSearchSuggestions(filtered);
      setShowCarSuggestions(true);
    } else {
      setCarSearchSuggestions([]);
      setShowCarSuggestions(false);
    }
  }, [carSearchQuery, allCarModels]);

  async function fetchOptionsData() {
    try {
      const supabase = createClient();
      
      // Fetch cities
      const { data: citiesData } = await supabase
        .from('cities')
        .select('*')
        .order('name');
      
      console.log('📍 Cities loaded:', citiesData?.length || 0);
      
      if (citiesData && citiesData.length > 0) {
        setCities(citiesData);
      } else {
        console.warn('⚠️ No cities found in database, using fallback cities');
        // Fallback cities if database is empty
        const fallbackCities = [
          { id: '11111111-1111-1111-1111-111111111111', name: 'Mumbai', state: 'Maharashtra' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Navi Mumbai', state: 'Maharashtra' },
          { id: '33333333-3333-3333-3333-333333333333', name: 'Thane', state: 'Maharashtra' },
          { id: '44444444-4444-4444-4444-444444444444', name: 'Pune', state: 'Maharashtra' },
          { id: '55555555-5555-5555-5555-555555555555', name: 'Delhi', state: 'Delhi' },
          { id: '66666666-6666-6666-6666-666666666666', name: 'Bangalore', state: 'Karnataka' },
          { id: '77777777-7777-7777-7777-777777777777', name: 'Hyderabad', state: 'Telangana' },
          { id: '88888888-8888-8888-8888-888888888888', name: 'Chennai', state: 'Tamil Nadu' },
        ];
        setCities(fallbackCities as any);
        toast('ℹ️ Using default cities. Database may need setup.', { duration: 3000 });
      }
      
      // Fetch makes from car_models table
      const { data: makesData, error: makesError } = await supabase
        .from('car_models')
        .select('make')
        .eq('is_active', true)
        .order('make');
      
      console.log('🚗 Car makes loaded:', makesData?.length || 0);
      
      if (!makesError && makesData && makesData.length > 0) {
        const uniqueMakes = [...new Set(makesData.map((m: any) => m.make))];
        setMakes(uniqueMakes);
      } else {
        console.warn('⚠️ No car makes found, using fallback');
        // Fallback makes if database is empty
        setMakes([
          'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda',
          'Toyota', 'Ford', 'Volkswagen', 'Renault', 'Nissan',
          'Kia', 'MG', 'Skoda', 'Jeep', 'BMW', 'Mercedes-Benz', 'Audi'
        ]);
      }
      
      // Fetch service types
      const { data: servicesData, error: servicesError } = await supabase
        .from('service_types')
        .select('id, name, description, base_price, is_active')
        .eq('is_active', true)
        .order('name');
      
      console.log('🔧 Service types loaded:', servicesData?.length || 0);
      
      if (!servicesError && servicesData && servicesData.length > 0) {
        setServiceTypes(servicesData);
      } else {
        console.warn('⚠️ No service types found, using fallback');
        // Fallback service types with base prices
        setServiceTypes([
          { id: 'd0000001-0001-0001-0001-000000000001', name: 'General Service', description: 'Regular maintenance & checkup', base_price: 1500 },
          { id: 'd0000001-0001-0001-0001-000000000002', name: 'AC Service', description: 'AC repair & gas filling', base_price: 1200 },
          { id: 'd0000001-0001-0001-0001-000000000003', name: 'Oil Change', description: 'Engine oil replacement', base_price: 800 },
          { id: 'd0000001-0001-0001-0001-000000000004', name: 'Brake Service', description: 'Brake pad & disk service', base_price: 2000 },
          { id: 'd0000001-0001-0001-0001-000000000005', name: 'Battery Replacement', description: 'New battery installation', base_price: 3500 },
          { id: 'd0000001-0001-0001-0001-000000000006', name: 'Tire Service', description: 'Tire rotation & alignment', base_price: 1000 },
          { id: 'd0000001-0001-0001-0001-000000000007', name: 'Denting & Painting', description: 'Body work & paint job', base_price: 5000 },
          { id: 'd0000001-0001-0001-0001-000000000008', name: 'Car Wash & Detailing', description: 'Exterior & interior cleaning', base_price: 600 },
        ]);
      }
      
      // Fetch addons
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, description, price, is_active')
        .eq('is_active', true)
        .order('name');
      
      console.log('🎁 Service addons loaded:', addonsData?.length || 0);
      
      if (!addonsError && addonsData && addonsData.length > 0) {
        setServiceAddons(addonsData);
      } else {
        console.warn('⚠️ No service addons found, using fallback');
        // Fallback service addons with prices
        setServiceAddons([
          { id: 'e0000001-0001-0001-0001-000000000001', name: 'Synthetic Oil Upgrade', description: 'Premium synthetic engine oil', price: 800 },
          { id: 'e0000001-0001-0001-0001-000000000002', name: 'Air Filter Replacement', description: 'New air filter', price: 400 },
          { id: 'e0000001-0001-0001-0001-000000000003', name: 'Cabin Filter Replacement', description: 'AC cabin filter', price: 450 },
          { id: 'e0000001-0001-0001-0001-000000000004', name: 'Coolant Top-up', description: 'Engine coolant refill', price: 300 },
          { id: 'e0000001-0001-0001-0001-000000000005', name: 'Fuel Filter Replacement', description: 'New fuel filter', price: 350 },
          { id: 'e0000001-0001-0001-0001-000000000006', name: 'Engine Oil Flush', description: 'Complete engine flush', price: 250 },
          { id: 'e0000001-0001-0001-0001-000000000007', name: 'AC Gas Top-up', description: 'AC refrigerant refill', price: 600 },
          { id: 'e0000001-0001-0001-0001-000000000008', name: 'Underbody Coating', description: 'Rust protection coating', price: 2500 },
        ]);
      }
      
      setOptionsLoaded(true);
      
    } catch (error) {
      console.error('Error fetching options:', error);
      toast.error('Failed to load form options');
      setOptionsLoaded(true); // Set true even on error to prevent blocking
    }
  }

  async function fetchAllCarModels() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('car_models')
        .select('id, make, model_name, variant')
        .eq('is_active', true)
        .order('make')
        .order('model_name');
      
      if (!error && data && data.length > 0) {
        setAllCarModels(data);
        console.log('🚗 All car models loaded:', data.length);
      } else {
        console.warn('⚠️ No car models found, using fallback');
        // Fallback data
        const fallbackModels = [
          { id: 'a0000001-0001-0001-0001-000000000001', make: 'Maruti Suzuki', model_name: 'Swift', variant: 'VXI' },
          { id: 'a0000001-0001-0001-0001-000000000002', make: 'Maruti Suzuki', model_name: 'Baleno', variant: 'Sigma' },
          { id: 'a0000001-0001-0001-0001-000000000003', make: 'Maruti Suzuki', model_name: 'WagonR', variant: 'LXI' },
          { id: 'a0000001-0001-0001-0001-000000000004', make: 'Maruti Suzuki', model_name: 'Dzire', variant: 'VXI' },
          { id: 'b0000002-0002-0002-0002-000000000001', make: 'Hyundai', model_name: 'i20', variant: 'Magna' },
          { id: 'b0000002-0002-0002-0002-000000000002', make: 'Hyundai', model_name: 'Creta', variant: 'E' },
          { id: 'c0000003-0003-0003-0003-000000000001', make: 'Tata', model_name: 'Nexon', variant: 'XM' },
        ];
        setAllCarModels(fallbackModels);
      }
    } catch (error) {
      console.error('Error fetching all car models:', error);
      setAllCarModels([]);
    }
  }

  async function fetchModels(make: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('car_models')
        .select('id, model_name, variant, class')
        .eq('make', make)
        .eq('is_active', true)
        .order('model_name');
      
      console.log('🚙 Models loaded for', make, ':', data?.length || 0);
      
      if (!error && data && data.length > 0) {
        setModels(data);
      } else {
        console.warn('⚠️ No models found for', make, ', using fallback');
        // Fallback models by make
        const modelsByMake: Record<string, any[]> = {
          'Maruti Suzuki': [
            { id: 'a0000001-0001-0001-0001-000000000001', model_name: 'Swift', variant: 'VXI' },
            { id: 'a0000001-0001-0001-0001-000000000002', model_name: 'Baleno', variant: 'Sigma' },
            { id: 'a0000001-0001-0001-0001-000000000003', model_name: 'WagonR', variant: 'LXI' },
            { id: 'a0000001-0001-0001-0001-000000000004', model_name: 'Dzire', variant: 'VXI' },
            { id: 'a0000001-0001-0001-0001-000000000005', model_name: 'Ertiga', variant: 'VXI' },
          ],
          'Hyundai': [
            { id: 'b0000002-0002-0002-0002-000000000001', model_name: 'i20', variant: 'Magna' },
            { id: 'b0000002-0002-0002-0002-000000000002', model_name: 'Creta', variant: 'E' },
            { id: 'b0000002-0002-0002-0002-000000000003', model_name: 'Venue', variant: 'E' },
            { id: 'b0000002-0002-0002-0002-000000000004', model_name: 'Verna', variant: 'E' },
          ],
          'Tata': [
            { id: 'c0000003-0003-0003-0003-000000000001', model_name: 'Nexon', variant: 'XM' },
            { id: 'c0000003-0003-0003-0003-000000000002', model_name: 'Harrier', variant: 'XT' },
            { id: 'c0000003-0003-0003-0003-000000000003', model_name: 'Tiago', variant: 'XZ' },
          ],
          'Honda': [
            { id: 'd0000004-0004-0004-0004-000000000001', model_name: 'City', variant: 'V' },
            { id: 'd0000004-0004-0004-0004-000000000002', model_name: 'Amaze', variant: 'VX' },
            { id: 'd0000004-0004-0004-0004-000000000003', model_name: 'Jazz', variant: 'V' },
          ],
        };
        setModels(modelsByMake[make] || []);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
    }
  }

  function calculatePrice() {
    let total = 0;
    
    // Add service type prices
    formData.service_types.forEach(serviceId => {
      const service = serviceTypes.find(s => s.id === serviceId);
      if (service && service.base_price) {
        total += service.base_price;
      }
    });
    
    // Add addon prices
    formData.service_addons.forEach(addonId => {
      const addon = serviceAddons.find(a => a.id === addonId);
      if (addon && addon.price) {
        total += addon.price;
      }
    });
    
    setEstimatedPrice(total > 0 ? total : null);
  }

  function handleCarSelect(car: any) {
    setSelectedCarModel(car);
    setCarSearchQuery(`${car.make} ${car.model_name}`);
    setShowCarSuggestions(false);
    updateFormData('vehicle_make', car.make);
    updateFormData('model_id', car.id);
    if (car.variant) {
      updateFormData('vehicle_variant', car.variant);
    }
  }

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    // AI Smart Detection: Auto-detect related fields
    
    // When model is selected, auto-fill variant if available
    if (field === 'model_id' && value) {
      const selectedModel = models.find(m => m.id === value);
      if (selectedModel && selectedModel.variant) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, vehicle_variant: selectedModel.variant }));
          toast.success('🤖 AI detected variant: ' + selectedModel.variant, { duration: 2000 });
        }, 300);
      }
    }
    
    // When city is selected, try to extract pincode if address contains it OR suggest common pincode
    if (field === 'city_id' && value) {
      const selectedCity = cities.find(c => c.id === value);
      if (selectedCity) {
        // First try to extract from existing address
        if (!formData.pincode && formData.customer_address) {
          const pincodeMatch = formData.customer_address.match(/\b\d{6}\b/);
          if (pincodeMatch) {
            setTimeout(() => {
              setFormData(prev => ({ ...prev, pincode: pincodeMatch[0] }));
              toast.success('🤖 AI detected pincode from address!', { duration: 2000 });
            }, 300);
          }
        }
        
        // If still no pincode, suggest based on city
        if (!formData.pincode && !formData.customer_address.match(/\b\d{6}\b/)) {
          const cityPincodeMap: Record<string, string> = {
            'delhi': '110001',
            'mumbai': '400001',
            'bangalore': '560001',
            'chennai': '600001',
            'hyderabad': '500001',
            'kolkata': '700001',
            'pune': '411001',
            'ahmedabad': '380001',
            'bhopal': '462001',
            'jaipur': '302001',
            'ghaziabad': '201001',
            'lucknow': '226001',
            'ludhiana': '141001',
            'chandigarh': '160001',
            'gurgaon': '122001',
            'indore': '452001'
          };
          
          const cityKey = selectedCity.name.toLowerCase().split(' ')[0];
          const suggestedPincode = cityPincodeMap[cityKey];
          
          if (suggestedPincode) {
            toast('💡 Tip: Pincode for ' + selectedCity.name + ' typically starts with ' + suggestedPincode.substring(0, 3), { 
              icon: '🤖',
              duration: 3000 
            });
          }
        }
      }
    }

    // When address is entered, try to detect city and pincode
    if (field === 'customer_address' && value && value.length > 20) {
      // Extract pincode
      const pincodeMatch = value.match(/\b\d{6}\b/);
      if (pincodeMatch && !formData.pincode) {
        setTimeout(() => {
          setFormData(prev => ({ ...prev, pincode: pincodeMatch[0] }));
          toast.success('🤖 AI detected pincode: ' + pincodeMatch[0], { duration: 2000 });
          
          // Also try to detect city from this pincode
          const prefix = pincodeMatch[0].substring(0, 3);
          const pincodeCity: Record<string, string> = {
            '110': 'Delhi',
            '400': 'Mumbai', 
            '560': 'Bangalore',
            '600': 'Chennai',
            '500': 'Hyderabad',
            '700': 'Kolkata',
            '411': 'Pune',
            '380': 'Ahmedabad',
            '462': 'Bhopal',
            '302': 'Jaipur',
            '201': 'Ghaziabad',
            '226': 'Lucknow',
            '141': 'Ludhiana',
            '160': 'Chandigarh',
            '122': 'Gurgaon',
            '452': 'Indore'
          };
          
          const cityName = pincodeCity[prefix];
          if (cityName && cities.length > 0) {
            const matchedCity = cities.find(c => 
              c.name.toLowerCase().includes(cityName.toLowerCase()) ||
              cityName.toLowerCase().includes(c.name.toLowerCase())
            );
            if (matchedCity) {
              setTimeout(() => {
                setFormData(prev => ({ ...prev, city_id: matchedCity.id }));
                toast.success('🤖 AI detected city: ' + matchedCity.name, { duration: 2000 });
              }, 800);
            }
          }
        }, 500);
      }

      // Try to detect city from address text
      if (!formData.city_id && cities.length > 0) {
        const addressLower = value.toLowerCase();
        const matchedCity = cities.find(c => 
          addressLower.includes(c.name.toLowerCase()) ||
          addressLower.includes(c.name.toLowerCase().replace(/\s+/g, ''))
        );
        if (matchedCity && !pincodeMatch) { // Only if pincode didn't already trigger city detection
          setTimeout(() => {
            setFormData(prev => ({ ...prev, city_id: matchedCity.id }));
            toast.success('🤖 AI detected city: ' + matchedCity.name, { duration: 2000 });
          }, 800);
        }
      }
    }

    // When pincode is entered (6 digits), try to detect city
    if (field === 'pincode' && value && value.length === 6) {
      // Check if any city matches common pincodes
      // This is a simple implementation - you can enhance with a pincode API
      const pincodeCity: Record<string, string> = {
        '110': 'Delhi',
        '400': 'Mumbai', 
        '560': 'Bangalore',
        '600': 'Chennai',
        '500': 'Hyderabad',
        '700': 'Kolkata',
        '411': 'Pune',
        '380': 'Ahmedabad',
        '462': 'Bhopal',
        '302': 'Jaipur',
        '201': 'Ghaziabad',
        '226': 'Lucknow',
        '141': 'Ludhiana',
        '160': 'Chandigarh',
        '122': 'Gurgaon',
        '452': 'Indore'
      };

      const prefix = value.substring(0, 3);
      const cityName = pincodeCity[prefix];
      
      if (cityName && cities.length > 0 && !formData.city_id) {
        const matchedCity = cities.find(c => 
          c.name.toLowerCase().includes(cityName.toLowerCase()) ||
          cityName.toLowerCase().includes(c.name.toLowerCase())
        );
        
        if (matchedCity) {
          setTimeout(() => {
            setFormData(prev => ({ ...prev, city_id: matchedCity.id }));
            toast.success('🤖 AI detected city: ' + matchedCity.name, { duration: 2000 });
          }, 500);
        }
      }
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.customer_name) newErrors.customer_name = 'Name is required';
      if (!formData.customer_phone || formData.customer_phone.length !== 10) {
        newErrors.customer_phone = 'Valid 10-digit phone required';
      }
      if (!formData.customer_address) newErrors.customer_address = 'Address is required';
      if (!formData.city_id) newErrors.city_id = 'City is required';
      if (!formData.pincode) newErrors.pincode = 'Pincode is required';
    }

    if (step === 2) {
      if (!formData.vehicle_number) newErrors.vehicle_number = 'Vehicle number is required';
      if (!formData.vehicle_make) newErrors.vehicle_make = 'Vehicle make is required';
      if (!formData.vehicle_year) newErrors.vehicle_year = 'Year is required';
    }

    if (step === 3) {
      if (formData.service_types.length === 0) {
        newErrors.service_types = 'Select at least one service';
      }
      if (!formData.problem_description) {
        newErrors.problem_description = 'Please describe your issue';
      }
    }

    if (step === 4) {
      if (!formData.preferred_date) newErrors.preferred_date = 'Preferred date is required';
      if (!formData.preferred_time) newErrors.preferred_time = 'Preferred time is required';
      if (formData.pickup_required && !formData.pickup_address) {
        newErrors.pickup_address = 'Pickup address is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCompletedSteps(prev => [...new Set([...prev, currentStep])]);
      setCurrentStep(prev => Math.min(prev + 1, 5));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error('Please fill all required fields');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) {
      toast.error('Please complete all required fields');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      
      // Generate lead number
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;

      // Create lead
      const { data: lead, error: leadError } = await supabase
        .from('service_leads')
        .insert([{
          lead_number: leadNumber,
          created_from: 'WEB',
          status: 'NEW',
          
          // Customer details
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_alternate_phone: formData.customer_alternate_phone || null,
          customer_email: formData.customer_email || null,
          address: formData.customer_address,
          customer_address: formData.customer_address,
          city: cities.find(c => c.id === formData.city_id)?.name || null,
          city_id: formData.city_id || null,
          pincode: formData.pincode || null,
          
          // Vehicle details
          vehicle_number: formData.vehicle_number,
          vehicle_reg: formData.vehicle_number,
          vehicle_make: formData.vehicle_make,
          vehicle_model: models.find(m => m.id === formData.model_id)?.model || null,
          model_id: formData.model_id || null,
          vehicle_variant: formData.vehicle_variant || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          fuel_type: formData.vehicle_fuel_type,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
          // Service details
          service_type_ids: formData.service_types,
          subservice_ids: formData.service_addons,
          problem_description: formData.problem_description || null,
          
          // Pickup details
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_address || null,
          preferred_date: formData.preferred_date || null,
          preferred_time: formData.preferred_time || null,
          
          // Additional
          coupon_code: formData.coupon_code || null,
          payment_mode: formData.payment_mode,
          notes: formData.notes || null,
          lead_priority: 'NORMAL',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (leadError) throw leadError;

      // Success!
      toast.success('🎉 Booking confirmed! We\'ll contact you shortly.');
      
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

  const getCurrentLocation = async () => {
    if (!optionsLoaded || cities.length === 0) {
      toast.loading('⏳ Loading cities, please wait...', { id: 'location' });
      
      // Wait for cities to load (max 5 seconds)
      let waited = 0;
      const checkInterval = setInterval(() => {
        waited += 100;
        if (cities.length > 0 || waited >= 5000) {
          clearInterval(checkInterval);
          if (cities.length > 0) {
            toast.dismiss('location');
            getCurrentLocation(); // Retry
          } else {
            toast.error('Unable to load cities. Please refresh.', { id: 'location' });
          }
        }
      }, 100);
      return;
    }

    setLoadingLocation(true);
    toast.loading('🤖 AI analyzing your location...', { id: 'location' });
    
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocode to get detailed address
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
              );
              const data = await response.json();
              
              if (data) {
                const address = data.address || {};
                
                // Extract address components
                const fullAddress = data.display_name || '';
                const pincode = address.postcode || '';
                const cityName = address.city || address.town || address.village || address.state_district || address.county || '';
                const stateName = address.state || '';
                
                console.log('🤖 AI Location Data:', { fullAddress, pincode, cityName, stateName, address });
                
                // Auto-fill address
                updateFormData('customer_address', fullAddress);
                
                // Auto-fill pincode
                if (pincode) {
                  setTimeout(() => {
                    setFormData(prev => ({ ...prev, pincode: pincode }));
                  }, 300);
                }
                
                // Auto-match and fill city from database - try multiple strategies
                let matchedCity = null;
                
                // Strategy 1: Direct name match
                if (cityName) {
                  matchedCity = cities.find(c => 
                    c.name.toLowerCase() === cityName.toLowerCase() ||
                    c.name.toLowerCase().includes(cityName.toLowerCase()) ||
                    cityName.toLowerCase().includes(c.name.toLowerCase())
                  );
                }
                
                // Strategy 2: Match by state if city not found
                if (!matchedCity && stateName) {
                  matchedCity = cities.find(c => 
                    c.name.toLowerCase().includes(stateName.toLowerCase().split(' ')[0])
                  );
                }
                
                // Strategy 3: Match by pincode prefix
                if (!matchedCity && pincode) {
                  const pincodeCity: Record<string, string> = {
                    '110': 'Delhi',
                    '400': 'Mumbai', 
                    '560': 'Bangalore',
                    '600': 'Chennai',
                    '500': 'Hyderabad',
                    '700': 'Kolkata',
                    '411': 'Pune',
                    '380': 'Ahmedabad',
                    '462': 'Bhopal',
                    '302': 'Jaipur',
                    '201': 'Ghaziabad',
                    '226': 'Lucknow',
                    '141': 'Ludhiana',
                    '160': 'Chandigarh',
                    '122': 'Gurgaon',
                    '452': 'Indore'
                  };
                  
                  const prefix = pincode.substring(0, 3);
                  const guessedCity = pincodeCity[prefix];
                  
                  if (guessedCity) {
                    matchedCity = cities.find(c => 
                      c.name.toLowerCase().includes(guessedCity.toLowerCase()) ||
                      guessedCity.toLowerCase().includes(c.name.toLowerCase())
                    );
                  }
                }
                
                if (matchedCity) {
                  setTimeout(() => {
                    setFormData(prev => ({ ...prev, city_id: matchedCity.id }));
                    toast.success('🎯 Location detected: ' + matchedCity.name + (pincode ? ', ' + pincode : ''), { 
                      id: 'location',
                      duration: 3000 
                    });
                  }, 600);
                } else {
                  toast.success('📍 Location detected! Please select city manually.', { 
                    id: 'location',
                    duration: 3000 
                  });
                  console.log('⚠️ City not matched. Available cities:', cities.map(c => c.name));
                  console.log('⚠️ Detected city name:', cityName, 'State:', stateName);
                }
              }
            } catch (error) {
              console.error('Reverse geocoding error:', error);
              toast.error('Unable to get address details', { id: 'location' });
            }
            
            setLoadingLocation(false);
          },
          (error) => {
            console.error('Geolocation error:', error);
            toast.error('Unable to get location. Please enable location access.', { id: 'location' });
            setLoadingLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        toast.error('Geolocation not supported on your device', { id: 'location' });
        setLoadingLocation(false);
      }
    } catch (error) {
      console.error('Location error:', error);
      toast.error('Location error occurred', { id: 'location' });
      setLoadingLocation(false);
    }
  };

  const getPickupLocation = async () => {
    setLoadingPickupLocation(true);
    toast.loading('🤖 AI detecting pickup location...', { id: 'pickup-location' });
    
    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            
            // Reverse geocode to get detailed address
            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
              );
              const data = await response.json();
              
              if (data && data.display_name) {
                const fullAddress = data.display_name;
                updateFormData('pickup_address', fullAddress);
                toast.success('🎯 Pickup location detected!', { 
                  id: 'pickup-location',
                  duration: 3000 
                });
              }
            } catch (error) {
              console.error('Error during pickup location detection:', error);
              toast.error('Failed to detect location. Please enter manually.', { 
                id: 'pickup-location',
                duration: 3000 
              });
            } finally {
              setLoadingPickupLocation(false);
            }
          },
          (error) => {
            console.error('Geolocation error:', error);
            toast.error('Unable to get location. Please enable location access.', { 
              id: 'pickup-location',
              duration: 3000 
            });
            setLoadingPickupLocation(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      } else {
        toast.error('Geolocation not supported on your device', { id: 'pickup-location' });
        setLoadingPickupLocation(false);
      }
    } catch (error) {
      console.error('Pickup location error:', error);
      toast.error('Location error occurred', { id: 'pickup-location' });
      setLoadingPickupLocation(false);
    }
  };

  // Progress calculation
  const progress = (completedSteps.length / 5) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-32 pb-16">
        {/* Header with Trophy */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-block mb-4">
            <div className="relative">
              <Trophy className="w-16 h-16 text-yellow-500 animate-bounce" />
              <Sparkles className="w-6 h-6 text-yellow-400 absolute -top-2 -right-2 animate-spin-slow" />
            </div>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Let's Get Your Car <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Supercharged!</span> 🚗💨
          </h1>
          <p className="text-xl text-gray-600">
            Just a few quick steps to book premium car service
          </p>
        </div>

        {/* Progress Bar with Milestone Badges */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative">
            {/* Progress Track */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-shimmer"></div>
              </div>
            </div>
            
            {/* Step Indicators */}
            <div className="flex justify-between mt-6">
              {[
                { num: 1, icon: User, label: 'You', emoji: '👤' },
                { num: 2, icon: Car, label: 'Car', emoji: '🚗' },
                { num: 3, icon: Wrench, label: 'Service', emoji: '🔧' },
                { num: 4, icon: Calendar, label: 'When', emoji: '📅' },
                { num: 5, icon: CheckCircle, label: 'Done', emoji: '✅' }
              ].map((step) => (
                <div key={step.num} className="flex flex-col items-center">
                  <div 
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl mb-2 transition-all duration-300 ${
                      currentStep === step.num
                        ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/50 scale-110 animate-pulse'
                        : completedSteps.includes(step.num)
                        ? 'bg-green-500 text-white shadow-md scale-105'
                        : 'bg-gray-200 text-gray-400'
                    }`}
                  >
                    {completedSteps.includes(step.num) ? '✓' : step.emoji}
                  </div>
                  <span className={`text-xs font-medium ${
                    currentStep === step.num ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress Encouragement */}
          <div className="text-center mt-4">
            {progress < 40 && (
              <p className="text-sm text-gray-600 animate-fade-in">
                🚀 Keep going! You're doing great!
              </p>
            )}
            {progress >= 40 && progress < 80 && (
              <p className="text-sm text-green-600 animate-fade-in">
                🎯 Awesome! You're halfway there!
              </p>
            )}
            {progress >= 80 && (
              <p className="text-sm text-purple-600 font-semibold animate-fade-in">
                🎊 Almost done! Amazing progress!
              </p>
            )}
          </div>
        </div>

        {/* Form Card */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-8 md:p-12">
              
              {/* Step 1: Customer Details */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Tell us about yourself</h2>
                      <p className="text-gray-600">We promise to keep it safe! 🔒</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Your Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name="customer_name"
                          autoComplete="name"
                          value={formData.customer_name}
                          onChange={(e) => updateFormData('customer_name', e.target.value)}
                          className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all transform focus:scale-[1.02] ${
                            errors.customer_name ? 'border-red-500 shake' : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="Enter your full name"
                        />
                      </div>
                      {errors.customer_name && (
                        <p className="text-red-500 text-sm mt-1">{errors.customer_name}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          name="customer_phone"
                          autoComplete="tel"
                          value={formData.customer_phone}
                          onChange={(e) => updateFormData('customer_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all ${
                            errors.customer_phone ? 'border-red-500' : 'border-gray-200 focus:border-blue-500'
                          }`}
                          placeholder="10-digit mobile"
                        />
                      </div>
                      {errors.customer_phone && (
                        <p className="text-red-500 text-sm mt-1">{errors.customer_phone}</p>
                      )}
                      
                      {/* Price Display after mobile number */}
                      {formData.customer_phone && formData.customer_phone.length === 10 && estimatedPrice && (
                        <div className="mt-3 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-green-600" />
                              <span className="text-sm font-medium text-green-800">Estimated Price:</span>
                            </div>
                            <span className="text-2xl font-bold text-green-600">
                              ₹{estimatedPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                          {formData.service_types.length > 0 && (
                            <p className="text-xs text-green-700 mt-2">
                              Based on {formData.service_types.length} service{formData.service_types.length > 1 ? 's' : ''} 
                              {formData.service_addons.length > 0 && ` + ${formData.service_addons.length} addon${formData.service_addons.length > 1 ? 's' : ''}`}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Alternate Phone
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          name="customer_alternate_phone"
                          autoComplete="tel"
                          value={formData.customer_alternate_phone}
                          onChange={(e) => updateFormData('customer_alternate_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email (Optional but recommended! 📧)
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          name="customer_email"
                          autoComplete="email"
                          value={formData.customer_email}
                          onChange={(e) => updateFormData('customer_email', e.target.value)}
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all"
                          placeholder="your@email.com"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-6 w-5 h-5 text-gray-400" />
                        <textarea
                          name="customer_address"
                          autoComplete="street-address"
                          value={formData.customer_address}
                          onChange={(e) => updateFormData('customer_address', e.target.value)}
                          className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all resize-none ${
                            errors.customer_address ? 'border-red-500' : 'border-gray-200 focus:border-blue-500'
                          }`}
                          rows={3}
                          placeholder="Enter your complete address"
                        />
                      </div>
                      {errors.customer_address && (
                        <p className="text-red-500 text-sm mt-1">{errors.customer_address}</p>
                      )}
                      <button
                        onClick={getCurrentLocation}
                        disabled={loadingLocation}
                        className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-all hover:gap-3 disabled:opacity-50 group"
                      >
                        <Navigation className={`w-4 h-4 ${loadingLocation ? 'animate-spin' : 'group-hover:animate-pulse'}`} />
                        {loadingLocation ? '🤖 AI detecting location...' : '📍 Use current location (AI-powered)'}
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        City <span className="text-red-500">*</span>
                        {formData.city_id && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade-in">
                            <Sparkles className="w-3 h-3" />
                            AI Detected
                          </span>
                        )}
                      </label>
                      <select
                        value={formData.city_id}
                        onChange={(e) => updateFormData('city_id', e.target.value)}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all transform focus:scale-[1.02] ${
                          errors.city_id ? 'border-red-500 shake' : formData.city_id ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-blue-500'
                        }`}
                      >
                        <option value="">Select City</option>
                        {cities.map(city => (
                          <option key={city.id} value={city.id}>{city.name}</option>
                        ))}
                      </select>
                      {errors.city_id && (
                        <p className="text-red-500 text-sm mt-1 animate-fade-in">{errors.city_id}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        Pincode <span className="text-red-500">*</span>
                        {formData.pincode && formData.pincode.length === 6 && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade-in">
                            <Sparkles className="w-3 h-3" />
                            AI Detected
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        name="pincode"
                        autoComplete="postal-code"
                        value={formData.pincode}
                        onChange={(e) => updateFormData('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all transform focus:scale-[1.02] ${
                          errors.pincode ? 'border-red-500 shake' : formData.pincode && formData.pincode.length === 6 ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-blue-500'
                        }`}
                        placeholder="6-digit pincode"
                      />
                      {errors.pincode && (
                        <p className="text-red-500 text-sm mt-1 animate-fade-in">{errors.pincode}</p>
                      )}
                    </div>
                  </div>

                  {/* Motivation Badge */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                    <ThumbsUp className="w-6 h-6 text-green-600" />
                    <p className="text-green-800 font-medium">
                      Great start! Now let's know about your car 🚗
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Vehicle Details */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                      <Car className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">About your car</h2>
                      <p className="text-gray-600">We'll take great care of it! 🛡️</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Vehicle Number <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="vehicle_number"
                        autoComplete="off"
                        value={formData.vehicle_number}
                        onChange={(e) => updateFormData('vehicle_number', e.target.value.toUpperCase())}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-orange-500/20 transition-all uppercase ${
                          errors.vehicle_number ? 'border-red-500' : 'border-gray-200 focus:border-orange-500'
                        }`}
                        placeholder="MH12AB1234"
                      />
                      {errors.vehicle_number && (
                        <p className="text-red-500 text-sm mt-1">{errors.vehicle_number}</p>
                      )}
                    </div>

                    <div className="md:col-span-2 relative">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Car Make & Model <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={carSearchQuery}
                          onChange={(e) => {
                            setCarSearchQuery(e.target.value);
                            if (!e.target.value) {
                              setSelectedCarModel(null);
                              updateFormData('vehicle_make', '');
                              updateFormData('model_id', '');
                            }
                          }}
                          onFocus={() => {
                            if (carSearchQuery.length > 0) {
                              setShowCarSuggestions(true);
                            }
                          }}
                          onBlur={() => {
                            // Delay hiding suggestions to allow click
                            setTimeout(() => setShowCarSuggestions(false), 200);
                          }}
                          className={`w-full pl-12 pr-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-orange-500/20 transition-all ${
                            errors.vehicle_make ? 'border-red-500' : 
                            selectedCarModel ? 'border-green-500 bg-green-50' : 
                            'border-gray-200 focus:border-orange-500'
                          }`}
                          placeholder="Search by make or model (e.g., Maruti Swift, Hyundai Creta)"
                        />
                        {selectedCarModel && (
                          <CheckCircle className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                        )}
                      </div>
                      
                      {/* Autocomplete Suggestions */}
                      {showCarSuggestions && carSearchSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                          {carSearchSuggestions.map((car: any) => (
                            <button
                              key={car.id}
                              type="button"
                              onClick={() => handleCarSelect(car)}
                              className="w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900">{car.make}</p>
                                  <p className="text-sm text-gray-600">{car.model_name} {car.variant ? `(${car.variant})` : ''}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {carSearchQuery && carSearchSuggestions.length === 0 && showCarSuggestions && (
                        <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl p-4 text-center text-gray-500">
                          No matches found. Try a different search term.
                        </div>
                      )}
                      
                      {errors.vehicle_make && (
                        <p className="text-red-500 text-sm mt-1">{errors.vehicle_make}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        Variant
                        {formData.vehicle_variant && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-fade-in">
                            <Sparkles className="w-3 h-3" />
                            AI Detected
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={formData.vehicle_variant}
                        onChange={(e) => updateFormData('vehicle_variant', e.target.value)}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-orange-500/20 transition-all ${
                          formData.vehicle_variant ? 'border-green-500 bg-green-50' : 'border-gray-200 focus:border-orange-500'
                        }`}
                        placeholder="e.g., VXi, ZXi"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Year <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.vehicle_year}
                        onChange={(e) => updateFormData('vehicle_year', e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-orange-500/20 transition-all ${
                          errors.vehicle_year ? 'border-red-500' : 'border-gray-200 focus:border-orange-500'
                        }`}
                        placeholder="2020"
                      />
                      {errors.vehicle_year && (
                        <p className="text-red-500 text-sm mt-1">{errors.vehicle_year}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Fuel Type
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['PETROL', 'DIESEL', 'CNG'].map(fuel => (
                          <button
                            key={fuel}
                            onClick={() => updateFormData('vehicle_fuel_type', fuel)}
                            className={`py-3 px-4 rounded-xl border-2 font-medium transition-all ${
                              formData.vehicle_fuel_type === fuel
                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {fuel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Odometer Reading (km)
                      </label>
                      <input
                        type="text"
                        value={formData.odometer_km}
                        onChange={(e) => updateFormData('odometer_km', e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all"
                        placeholder="e.g., 25000"
                      />
                    </div>
                  </div>

                  {/* Motivation Badge */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3">
                    <Smile className="w-6 h-6 text-blue-600" />
                    <p className="text-blue-800 font-medium">
                      Awesome! Now tell us what service you need 🔧
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Service Selection */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                      <Wrench className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">What does your car need?</h2>
                      <p className="text-gray-600">Select all that apply! ✨</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                      Service Types <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {serviceTypes.map(service => (
                        <button
                          key={service.id}
                          onClick={() => {
                            const isSelected = formData.service_types.includes(service.id);
                            updateFormData(
                              'service_types',
                              isSelected
                                ? formData.service_types.filter(id => id !== service.id)
                                : [...formData.service_types, service.id]
                            );
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            formData.service_types.includes(service.id)
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-gray-900">{service.name}</p>
                                {service.base_price && (
                                  <span className="text-sm font-bold text-purple-600">
                                    ₹{service.base_price}
                                  </span>
                                )}
                              </div>
                              {service.description && (
                                <p className="text-xs text-gray-600 mt-1">{service.description}</p>
                              )}
                            </div>
                            {formData.service_types.includes(service.id) && (
                              <CheckCircle className="w-6 h-6 text-purple-600 ml-2 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {errors.service_types && (
                      <p className="text-red-500 text-sm mt-2">{errors.service_types}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-4">
                      Add-ons (Optional but worth it! 🎁)
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {serviceAddons.map(addon => (
                        <button
                          key={addon.id}
                          onClick={() => {
                            const isSelected = formData.service_addons.includes(addon.id);
                            updateFormData(
                              'service_addons',
                              isSelected
                                ? formData.service_addons.filter(id => id !== addon.id)
                                : [...formData.service_addons, addon.id]
                            );
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            formData.service_addons.includes(addon.id)
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 hover:border-pink-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="font-semibold text-gray-900">{addon.name}</p>
                                {addon.price && (
                                  <span className="text-sm font-bold text-pink-600">
                                    ₹{addon.price}
                                  </span>
                                )}
                              </div>
                              {addon.description && (
                                <p className="text-xs text-gray-600 mt-1">{addon.description}</p>
                              )}
                            </div>
                            {formData.service_addons.includes(addon.id) && (
                              <CheckCircle className="w-6 h-6 text-pink-600 ml-2 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Describe the Issue <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.problem_description}
                      onChange={(e) => updateFormData('problem_description', e.target.value)}
                      className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-purple-500/20 transition-all resize-none ${
                        errors.problem_description ? 'border-red-500' : 'border-gray-200 focus:border-purple-500'
                      }`}
                      rows={4}
                      placeholder="Tell us what's happening with your car... The more details, the better! 💬"
                    />
                    {errors.problem_description && (
                      <p className="text-red-500 text-sm mt-1">{errors.problem_description}</p>
                    )}
                  </div>

                  {/* Motivation Badge */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                    <Star className="w-6 h-6 text-yellow-600" />
                    <p className="text-yellow-800 font-medium">
                      Perfect! Now let's schedule it 📅
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Pickup & Scheduling */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">When works best for you?</h2>
                      <p className="text-gray-600">We'll be there! ⏰</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Preferred Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.preferred_date}
                        onChange={(e) => updateFormData('preferred_date', e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-green-500/20 transition-all ${
                          errors.preferred_date ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
                        }`}
                      />
                      {errors.preferred_date && (
                        <p className="text-red-500 text-sm mt-1">{errors.preferred_date}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Preferred Time <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.preferred_time}
                        onChange={(e) => updateFormData('preferred_time', e.target.value)}
                        className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-green-500/20 transition-all ${
                          errors.preferred_time ? 'border-red-500' : 'border-gray-200 focus:border-green-500'
                        }`}
                      >
                        <option value="">Select Time</option>
                        <option value="09:00-12:00">Morning (9 AM - 12 PM)</option>
                        <option value="12:00-15:00">Afternoon (12 PM - 3 PM)</option>
                        <option value="15:00-18:00">Evening (3 PM - 6 PM)</option>
                      </select>
                      {errors.preferred_time && (
                        <p className="text-red-500 text-sm mt-1">{errors.preferred_time}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        id="pickup"
                        checked={formData.pickup_required}
                        onChange={(e) => updateFormData('pickup_required', e.target.checked)}
                        className="w-6 h-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                      />
                      <label htmlFor="pickup" className="flex-1 cursor-pointer">
                        <p className="font-semibold text-gray-900 text-lg flex items-center gap-2">
                          <Car className="w-5 h-5 text-blue-600" />
                          Free Pickup & Drop Service 🚗💨
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          We'll pick up your car and drop it back after service - completely free!
                        </p>
                      </label>
                    </div>

                    {formData.pickup_required && (
                      <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Pickup Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="pickup_address"
                          autoComplete="street-address"
                          value={formData.pickup_address}
                          onChange={(e) => updateFormData('pickup_address', e.target.value)}
                          className={`w-full px-4 py-4 border-2 rounded-xl focus:ring-4 focus:ring-blue-500/20 transition-all resize-none ${
                            errors.pickup_address ? 'border-red-500' : 'border-gray-200 focus:border-blue-500'
                          }`}
                          rows={2}
                          placeholder="Where should we pick up from?"
                        />
                        {errors.pickup_address && (
                          <p className="text-red-500 text-sm mt-1">{errors.pickup_address}</p>
                        )}
                        <button
                          type="button"
                          onClick={getPickupLocation}
                          disabled={loadingPickupLocation}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 transition-all hover:gap-3 disabled:opacity-50 group"
                        >
                          <Navigation className={`w-4 h-4 ${loadingPickupLocation ? 'animate-spin' : 'group-hover:animate-pulse'}`} />
                          {loadingPickupLocation ? '🤖 AI detecting location...' : '📍 Use current location (AI-powered)'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Motivation Badge */}
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 flex items-center gap-3">
                    <Rocket className="w-6 h-6 text-purple-600" />
                    <p className="text-purple-800 font-medium">
                      Almost there! One last step 🎉
                    </p>
                  </div>
                </div>
              )}

              {/* Step 5: Final Details */}
              {currentStep === 5 && (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center">
                      <Gift className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Final touches!</h2>
                      <p className="text-gray-600">Almost ready to go! 🎊</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Got a coupon code? 🎁
                      </label>
                      <div className="relative">
                        <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={formData.coupon_code}
                          onChange={(e) => updateFormData('coupon_code', e.target.value.toUpperCase())}
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/20 transition-all uppercase"
                          placeholder="SAVE10"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-4">
                        Payment Mode
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { value: 'CASH', label: 'Cash', icon: DollarSign },
                          { value: 'UPI', label: 'UPI', icon: CreditCard },
                          { value: 'CARD', label: 'Card', icon: CreditCard }
                        ].map(mode => (
                          <button
                            key={mode.value}
                            onClick={() => updateFormData('payment_mode', mode.value)}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                              formData.payment_mode === mode.value
                                ? 'border-yellow-500 bg-yellow-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <mode.icon className="w-6 h-6" />
                            <span className="font-medium">{mode.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Any special requests?
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => updateFormData('notes', e.target.value)}
                        className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:ring-4 focus:ring-yellow-500/20 transition-all resize-none"
                        rows={3}
                        placeholder="Tell us anything else we should know..."
                      />
                    </div>
                  </div>

                  {/* Final Summary Card */}
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                      <ShieldCheck className="w-6 h-6" />
                      Your Booking Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>✓ Customer: {formData.customer_name}</p>
                      <p>✓ Vehicle: {formData.vehicle_number} ({formData.vehicle_make})</p>
                      <p>✓ Services: {formData.service_types.length} selected</p>
                      <p>✓ Date: {formData.preferred_date} ({formData.preferred_time})</p>
                      {formData.pickup_required && <p>✓ Free Pickup & Drop included!</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-4 mt-8">
                {currentStep > 1 && (
                  <button
                    onClick={handlePrevious}
                    className="px-8 py-4 border-2 border-gray-300 rounded-xl hover:border-gray-400 transition-all font-semibold flex items-center gap-2"
                  >
                    ← Back
                  </button>
                )}
                
                {currentStep < 5 && (
                  <button
                    onClick={handleNext}
                    className="flex-1 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg"
                  >
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}

                {currentStep === 5 && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Booking...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirm Booking 🎉
                      </>
                    )}
                  </button>
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

