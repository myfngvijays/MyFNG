'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  User, Phone, Mail, MapPin, Car, Wrench, Calendar,
  Clock, DollarSign, AlertCircle, CheckCircle, ArrowRight, Navigation
} from 'lucide-react';

export default function CreateLeadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    // Customer Details
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city_id: '',
    pincode: '',
    contact_method: 'CALL',
    customer_lat: '',
    customer_lng: '',
    
    // Vehicle Details
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    // Service Details
    service_types: [] as string[], // UUID array
    service_addons: [] as string[], // UUID array
    description: '',
    problem_description: '',
    payment_mode: '',
    coupon_code: '',
    
    // Pickup Details
    pickup_required: false,
    pickup_address: '',
    preferred_slot_start: '',
    preferred_slot_end: '',
    
    // Additional
    notes: '',
    lead_priority: 'NORMAL'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Options data
  const [cities, setCities] = useState<any[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  
  // Fetch options on component mount
  useEffect(() => {
    fetchOptionsData();
  }, []);
  
  // Fetch models when make changes
  useEffect(() => {
    if (formData.vehicle_make) {
      fetchModels(formData.vehicle_make);
    } else {
      setModels([]);
    }
  }, [formData.vehicle_make]);
  
  async function fetchOptionsData() {
    const supabase = createClient();
    
    try {
      // Fetch cities from database
      const { data: citiesData, error: citiesError } = await supabase
        .from('cities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (citiesError) {
        console.error('Error fetching cities:', citiesError);
        // Fallback to mock data with UUIDs
        setCities([
          { id: '11111111-1111-1111-1111-111111111111', name: 'Mumbai' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'Navi Mumbai' },
          { id: '33333333-3333-3333-3333-333333333333', name: 'Thane' },
          { id: '44444444-4444-4444-4444-444444444444', name: 'Pune' },
          { id: '55555555-5555-5555-5555-555555555555', name: 'Delhi' },
          { id: '66666666-6666-6666-6666-666666666666', name: 'Bangalore' },
          { id: '77777777-7777-7777-7777-777777777777', name: 'Hyderabad' },
          { id: '88888888-8888-8888-8888-888888888888', name: 'Chennai' },
        ]);
      } else {
        setCities(citiesData || []);
      }
      
      // Vehicle makes - get distinct makes from car_models
      const { data: makesData, error: makesError } = await supabase
        .from('car_models')
        .select('make')
        .eq('is_active', true);
      
      if (makesError) {
        console.error('Error fetching makes:', makesError);
        setMakes([
          'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda',
          'Toyota', 'Ford', 'Volkswagen', 'Renault', 'Nissan',
          'Kia', 'MG', 'Skoda', 'Jeep', 'BMW', 'Mercedes-Benz', 'Audi'
        ]);
      } else {
        // Get unique makes
        const uniqueMakes = [...new Set(makesData.map(item => item.make))];
        setMakes(uniqueMakes);
      }
      
      // Service types from database
      const { data: servicesData, error: servicesError } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name');
      
      if (servicesError) {
        console.error('Error fetching service types:', servicesError);
        // Fallback to mock data with UUIDs
        setServiceTypes([
          { id: 'd0000001-0001-0001-0001-000000000001', name: 'General Service', description: 'Regular maintenance' },
          { id: 'd0000001-0001-0001-0001-000000000002', name: 'AC Service', description: 'AC repair & gas filling' },
          { id: 'd0000001-0001-0001-0001-000000000003', name: 'Oil Change', description: 'Engine oil replacement' },
          { id: 'd0000001-0001-0001-0001-000000000004', name: 'Brake Service', description: 'Brake pad & disk service' },
          { id: 'd0000001-0001-0001-0001-000000000005', name: 'Battery Replacement', description: 'New battery installation' },
          { id: 'd0000001-0001-0001-0001-000000000006', name: 'Tire Service', description: 'Tire rotation & alignment' },
          { id: 'd0000001-0001-0001-0001-000000000007', name: 'Denting & Painting', description: 'Body work' },
          { id: 'd0000001-0001-0001-0001-000000000008', name: 'Car Wash & Detailing', description: 'Exterior & interior cleaning' },
        ]);
      } else {
        setServiceTypes(servicesData || []);
      }
      
      // Service addons from database
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, description, price')
        .eq('is_active', true)
        .order('name');
      
      if (addonsError) {
        console.error('Error fetching service addons:', addonsError);
        // Fallback to mock data with UUIDs
        setServiceAddons([
          { id: 'e0000001-0001-0001-0001-000000000001', name: 'Semi Synthetic Oil', price: 500 },
          { id: 'e0000001-0001-0001-0001-000000000002', name: 'Fully Synthetic Oil', price: 1200 },
          { id: 'e0000001-0001-0001-0001-000000000003', name: 'Air Filter', price: 300 },
          { id: 'e0000001-0001-0001-0001-000000000004', name: 'Cabin Filter', price: 400 },
          { id: 'e0000001-0001-0001-0001-000000000005', name: 'Fuel Filter', price: 350 },
          { id: 'e0000001-0001-0001-0001-000000000006', name: 'Engine Oil Flush', price: 250 },
          { id: 'e0000001-0001-0001-0001-000000000007', name: 'AC Gas Top-up', price: 600 },
          { id: 'e0000001-0001-0001-0001-000000000008', name: 'Underbody Coating', price: 2500 },
        ]);
      } else {
        setServiceAddons(addonsData || []);
      }
      
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  }
  
  async function fetchModels(make: string) {
    const supabase = createClient();
    
    try {
      // Fetch models from database filtered by make
      const { data, error } = await supabase
        .from('car_models')
        .select('id, model_name, variant')
        .eq('make', make)
        .eq('is_active', true)
        .order('model_name');
      
      if (error) {
        console.error('Error fetching models:', error);
        // Fallback to mock data with UUIDs
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
            { id: 'c0000003-0003-0003-0003-000000000001', model_name: 'Nexon', variant: 'XE' },
            { id: 'c0000003-0003-0003-0003-000000000002', model_name: 'Harrier', variant: 'XE' },
            { id: 'c0000003-0003-0003-0003-000000000003', model_name: 'Altroz', variant: 'XE' },
          ],
        };
        setModels(modelsByMake[make] || []);
      } else {
        setModels(data || []);
      }
    } catch (error) {
      console.error('Error in fetchModels:', error);
      setModels([]);
    }
  }
  
  function getCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    
    setLoadingLocation(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          customer_lat: position.coords.latitude.toString(),
          customer_lng: position.coords.longitude.toString()
        }));
        setLoadingLocation(false);
      },
      (error) => {
        alert('Unable to retrieve your location');
        setLoadingLocation(false);
      }
    );
  }
  
  function validateVehicleNumber(vehicleNumber: string): boolean {
    // Indian vehicle number format: AB12CD1234 or AB-12-CD-1234 or AB 12 CD 1234
    // State Code (2-3 letters) + District Code (2 digits) + Series (1-2 letters) + Number (4 digits)
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const cleanNumber = vehicleNumber.replace(/[-\s]/g, '').toUpperCase();
    return regex.test(cleanNumber);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    // Auto-uppercase vehicle number
    const finalValue = name === 'vehicle_number' ? value.toUpperCase() : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : finalValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  const handleMultiSelect = (name: string, value: string, checked: boolean) => {
    setFormData(prev => {
      const currentArray = prev[name as keyof typeof prev] as string[];
      const newArray = checked
        ? [...currentArray, value]
        : currentArray.filter(item => item !== value);
      
      return {
        ...prev,
        [name]: newArray
      };
    });
    
    // Clear error
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
      if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone number is required';
      if (formData.customer_phone && formData.customer_phone.length < 10) {
        newErrors.customer_phone = 'Please enter valid 10-digit phone number';
      }
      if (!formData.customer_address.trim()) newErrors.customer_address = 'Address is required';
      if (!formData.city_id) newErrors.city_id = 'City is required';
    }

    if (currentStep === 2) {
      if (!formData.vehicle_number.trim()) newErrors.vehicle_number = 'Vehicle number is required';
      if (!formData.vehicle_make.trim()) newErrors.vehicle_make = 'Vehicle make is required';
      if (!formData.model_id) newErrors.model_id = 'Vehicle model is required';
      if (!formData.vehicle_fuel_type) newErrors.vehicle_fuel_type = 'Fuel type is required';
      
      // Vehicle number validation (Indian format)
      if (formData.vehicle_number && !validateVehicleNumber(formData.vehicle_number)) {
        newErrors.vehicle_number = 'Please enter valid vehicle number (e.g., MH12AB1234)';
      }
    }

    if (currentStep === 3) {
      if (formData.service_types.length === 0) newErrors.service_types = 'Please select at least one service type';
      if (!formData.payment_mode) newErrors.payment_mode = 'Payment mode is required';
      
      // Pickup validation - merged from step 4
      if (formData.pickup_required) {
        // Pickup address validation - either pickup_address or customer_address required
        if (!formData.pickup_address && !formData.customer_address) {
          newErrors.pickup_address = 'Pickup address is required';
        }
        // Preferred time slots are required for pickup
        if (!formData.preferred_slot_start) {
          newErrors.preferred_slot_start = 'Preferred pickup start time is required';
        }
        if (!formData.preferred_slot_end) {
          newErrors.preferred_slot_end = 'Preferred pickup end time is required';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    // Prevent Enter key from submitting form on steps 1-2
    if (e.key === 'Enter' && step !== 3) {
      e.preventDefault();
      console.log('Enter key prevented on step:', step);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // CRITICAL: Only allow submission on step 3
    if (step !== 3) {
      // Don't proceed - this shouldn't happen as buttons are type="button"
      console.log('Form submit prevented on step:', step);
      return;
    }
    
    // Final validation before submission
    if (!validateStep(3)) {
      console.log('Step 3 validation failed');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      
      // Get current telecaller
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Generate lead number
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;

      // Debug: Check payment_mode value
      console.log('🔍 Payment Mode Value:', formData.payment_mode);
      console.log('🔍 Service Types:', formData.service_types);
      console.log('🔍 Service Addons:', formData.service_addons);

      // Create lead with all required fields
      const { data: lead, error: leadError } = await supabase
        .from('service_leads')
        .insert([{
          lead_number: leadNumber,
          created_by_id: userProfile?.id,
          created_from: 'TELECALLER',
          assigned_telecaller_id: userProfile?.id,
          telecaller_assigned_at: new Date().toISOString(),
          
        // Customer details
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        customer_alternate_phone: formData.customer_alternate_phone || null,
        customer_email: formData.customer_email || null,
        address: formData.customer_address, // Database column
        customer_address: formData.customer_address, // Duplicate column for backward compatibility
        city: cities.find(c => c.id === formData.city_id)?.name || null, // City name
        city_id: formData.city_id || null, // City UUID
        pincode: formData.pincode || null,
        contact_method: formData.contact_method,
        location_latitude: formData.customer_lat ? parseFloat(formData.customer_lat) : null,
        location_longitude: formData.customer_lng ? parseFloat(formData.customer_lng) : null,
        customer_lat: formData.customer_lat ? parseFloat(formData.customer_lat) : null, // Duplicate for backward compatibility
        customer_lng: formData.customer_lng ? parseFloat(formData.customer_lng) : null, // Duplicate for backward compatibility
          
      // Vehicle details
      vehicle_number: formData.vehicle_number, // Required field
      vehicle_make: formData.vehicle_make,
      vehicle_model: models.find(m => m.id === formData.model_id)?.model_name || null, // Model name
      model_id: formData.model_id || null, // Model UUID
      vehicle_variant: formData.vehicle_variant || null,
      vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
      vehicle_fuel_type: formData.vehicle_fuel_type,
      odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
      // Service details
      service_type: formData.service_types.length > 0 ? formData.service_types[0] : 'GENERAL', // Use first selected service type UUID, fallback to GENERAL
      service_type_ids: JSON.stringify(formData.service_types), // Store as JSON string
      subservice_ids: JSON.stringify(formData.service_addons), // Store as JSON string
      description: formData.description || null,
      problem_description: formData.problem_description || null,
      payment_mode: formData.payment_mode || null,
      coupon_code: formData.coupon_code || null,
          
      // Pickup
      pickup_required: formData.pickup_required,
      pickup_address: formData.pickup_required ? (formData.pickup_address || formData.customer_address) : null,
      pickup_latitude: formData.pickup_required && formData.customer_lat ? parseFloat(formData.customer_lat) : null,
      pickup_longitude: formData.pickup_required && formData.customer_lng ? parseFloat(formData.customer_lng) : null,
      pickup_lat: formData.pickup_required && formData.customer_lat ? parseFloat(formData.customer_lat) : null, // Duplicate for backward compatibility
      pickup_lng: formData.pickup_required && formData.customer_lng ? parseFloat(formData.customer_lng) : null, // Duplicate for backward compatibility
      preferred_slot_start: formData.preferred_slot_start || null,
      preferred_slot_end: formData.preferred_slot_end || null,
          
          // Additional
          notes: formData.notes || null,
          lead_priority: formData.lead_priority,
          status: 'NEW',
          lead_type: 'NORMAL',
          
          is_incomplete: false
        }])
        .select()
        .single();

      if (leadError) throw leadError;

      // Show success message
      setSuccessMessage(`Lead created successfully! Lead Number: ${leadNumber}`);
      
      // Redirect after 1.5 seconds
      setTimeout(() => {
      router.push(`/dashboard/telecaller/leads/${lead.id}`);
      }, 1500);

    } catch (error: any) {
      console.error('Error creating lead:', error);
      const errorMsg = error?.message || String(error) || 'Unknown error';
      alert('Failed to create lead: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Create New Lead</h1>
          <p className="text-text-body mt-2">Fill in customer and vehicle details to create a lead</p>
        </div>

        {/* Progress Steps */}
        <div className="card">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map(num => (
              <div key={num} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= num ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                  {step > num ? '✓' : num}
                  </div>
                {num < 3 && <div className={`w-24 h-1 ${step > num ? 'bg-brand-primary' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3">
            <span className="text-sm font-medium">Customer</span>
            <span className="text-sm font-medium">Vehicle</span>
            <span className="text-sm font-medium">Service & Pickup</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="card">
          {/* Step 1: Customer Details */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-text-heading flex items-center gap-2">
                <User className="w-5 h-5" />
                Customer Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    className={`input ${errors.customer_name ? 'border-red-500' : ''}`}
                    placeholder="Enter customer name"
                  />
                  {errors.customer_name && (
                    <p className="mt-1 text-sm text-red-500">{errors.customer_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleChange}
                    className={`input ${errors.customer_phone ? 'border-red-500' : ''}`}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                  />
                  {errors.customer_phone && (
                    <p className="mt-1 text-sm text-red-500">{errors.customer_phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    name="customer_alternate_phone"
                    value={formData.customer_alternate_phone}
                    onChange={handleChange}
                    className="input"
                    placeholder="Optional alternate number"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleChange}
                    className="input"
                    placeholder="customer@example.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="customer_address"
                    value={formData.customer_address}
                    onChange={handleChange}
                    className={`input ${errors.customer_address ? 'border-red-500' : ''}`}
                    placeholder="Enter complete address"
                    rows={3}
                  />
                  {errors.customer_address && (
                    <p className="mt-1 text-sm text-red-500">{errors.customer_address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="city_id"
                    value={formData.city_id}
                    onChange={handleChange}
                    className={`input ${errors.city_id ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select City</option>
                    {cities.map(city => (
                      <option key={city.id} value={city.id}>{city.name}</option>
                    ))}
                  </select>
                  {errors.city_id && (
                    <p className="mt-1 text-sm text-red-500">{errors.city_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="input"
                    placeholder="Enter pincode"
                    maxLength={6}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle Details */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-text-heading flex items-center gap-2">
                <Car className="w-5 h-5" />
                Vehicle Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Vehicle Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={handleChange}
                    className={`input uppercase ${errors.vehicle_number ? 'border-red-500' : ''}`}
                    placeholder="MH12AB1234"
                    required
                  />
                  {errors.vehicle_number && (
                    <p className="mt-1 text-sm text-red-500">{errors.vehicle_number}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Format: AA00BB0000 (e.g., MH12AB1234)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Vehicle Make <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vehicle_make"
                    value={formData.vehicle_make}
                    onChange={handleChange}
                    className={`input ${errors.vehicle_make ? 'border-red-500' : ''}`}
                  >
                    <option value="">Select Make</option>
                    {makes.map(make => (
                      <option key={make} value={make}>{make}</option>
                    ))}
                  </select>
                  {errors.vehicle_make && (
                    <p className="mt-1 text-sm text-red-500">{errors.vehicle_make}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Vehicle Model <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="model_id"
                    value={formData.model_id}
                    onChange={handleChange}
                    className={`input ${errors.model_id ? 'border-red-500' : ''}`}
                    disabled={!formData.vehicle_make}
                  >
                    <option value="">Select Model</option>
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.model_name || model.name}
                      </option>
                    ))}
                  </select>
                  {errors.model_id && (
                    <p className="mt-1 text-sm text-red-500">{errors.model_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Variant
                  </label>
                  <input
                    type="text"
                    name="vehicle_variant"
                    value={formData.vehicle_variant}
                    onChange={handleChange}
                    className="input"
                    placeholder="e.g. VXI, ZXI"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    name="vehicle_year"
                    value={formData.vehicle_year}
                    onChange={handleChange}
                    className="input"
                    placeholder="2020"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Fuel Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vehicle_fuel_type"
                    value={formData.vehicle_fuel_type}
                    onChange={handleChange}
                    className={`input ${errors.vehicle_fuel_type ? 'border-red-500' : ''}`}
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="ELECTRIC">Electric</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                  {errors.vehicle_fuel_type && (
                    <p className="mt-1 text-sm text-red-500">{errors.vehicle_fuel_type}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Odometer (KM)
                  </label>
                  <input
                    type="number"
                    name="odometer_km"
                    value={formData.odometer_km}
                    onChange={handleChange}
                    className="input"
                    placeholder="Current odometer reading"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Service Requirements & Pickup */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-text-heading flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Service Requirements & Pickup
              </h2>

                <div>
                <label className="block text-sm font-medium text-text-body mb-3">
                  Service Types <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serviceTypes.map(service => (
                    <label key={service.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.service_types.includes(service.id)}
                        onChange={(e) => handleMultiSelect('service_types', service.id, e.target.checked)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium text-text-heading">{service.name}</div>
                        <div className="text-sm text-text-body">{service.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.service_types && (
                  <p className="mt-2 text-sm text-red-500">{errors.service_types}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-body mb-3">
                  Service Add-ons (Optional)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serviceAddons.map(addon => (
                    <label key={addon.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.service_addons.includes(addon.id)}
                        onChange={(e) => handleMultiSelect('service_addons', addon.id, e.target.checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-text-heading">{addon.name}</div>
                        <div className="text-sm text-brand-primary">₹{addon.price}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                  name="payment_mode"
                  value={formData.payment_mode}
                    onChange={handleChange}
                  className={`input ${errors.payment_mode ? 'border-red-500' : ''}`}
                  >
                  <option value="">Select Payment Mode</option>
                  <option value="PREPAID">Prepaid</option>
                  <option value="COD">Cash on Delivery</option>
                  <option value="WALLET">Wallet</option>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Card</option>
                  </select>
                {errors.payment_mode && (
                  <p className="mt-1 text-sm text-red-500">{errors.payment_mode}</p>
                  )}
                </div>

                <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Coupon Code
                </label>
                <input
                  type="text"
                  name="coupon_code"
                  value={formData.coupon_code}
                  onChange={handleChange}
                  className="input"
                  placeholder="Enter coupon code (if any)"
                />
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="input"
                    placeholder="Brief description of service required"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Problem Description
                  </label>
                  <textarea
                    name="problem_description"
                    value={formData.problem_description}
                    onChange={handleChange}
                    className="input"
                    placeholder="Detailed problem description from customer"
                    rows={3}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-200 my-6"></div>

              {/* Pickup Section */}
              <h3 className="text-lg font-semibold text-text-heading flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Pickup & Additional Details
              </h3>

              <div>
                <label className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    name="pickup_required"
                    checked={formData.pickup_required}
                    onChange={handleChange}
                  />
                  <span className="text-sm font-medium text-text-body">Customer requires vehicle pickup</span>
                  </label>
                </div>

                {formData.pickup_required && (
                  <>
                    <div>
                    <label className="block text-sm font-medium text-text-body mb-2">
                        Pickup Address
                      </label>
                    <textarea
                        name="pickup_address"
                        value={formData.pickup_address}
                        onChange={handleChange}
                      className={`input ${errors.pickup_address ? 'border-red-500' : ''}`}
                      placeholder="Leave empty to use customer address"
                      rows={2}
                      />
                    {errors.pickup_address && (
                      <p className="mt-1 text-sm text-red-500">{errors.pickup_address}</p>
                    )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-body mb-2">
                        Location (Latitude & Longitude)
                      </label>
                      <div className="flex gap-4 items-center">
                        <input
                          type="text"
                          name="customer_lat"
                          value={formData.customer_lat}
                          onChange={handleChange}
                          className="input flex-1"
                          placeholder="Latitude"
                        />
                        <input
                          type="text"
                          name="customer_lng"
                          value={formData.customer_lng}
                          onChange={handleChange}
                          className="input flex-1"
                          placeholder="Longitude"
                        />
                        <button
                          type="button"
                          onClick={getCurrentLocation}
                          disabled={loadingLocation}
                          className="btn btn-secondary flex items-center gap-2 whitespace-nowrap"
                        >
                          <Navigation className="w-4 h-4" />
                          {loadingLocation ? 'Getting...' : 'Get Location'}
                        </button>
                      </div>
                    </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-text-body mb-2">
                        Preferred Pickup Time Start <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="preferred_slot_start"
                        value={formData.preferred_slot_start}
                        onChange={handleChange}
                        className={`input ${errors.preferred_slot_start ? 'border-red-500' : ''}`}
                      />
                      {errors.preferred_slot_start && (
                        <p className="mt-1 text-sm text-red-500">{errors.preferred_slot_start}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-text-body mb-2">
                        Preferred Pickup Time End <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        name="preferred_slot_end"
                        value={formData.preferred_slot_end}
                        onChange={handleChange}
                        className={`input ${errors.preferred_slot_end ? 'border-red-500' : ''}`}
                      />
                      {errors.preferred_slot_end && (
                        <p className="mt-1 text-sm text-red-500">{errors.preferred_slot_end}</p>
                      )}
                    </div>
                    </div>
                  </>
                )}

                <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                    Lead Priority
                  </label>
                  <select
                    name="lead_priority"
                    value={formData.lead_priority}
                    onChange={handleChange}
                  className="input"
                  >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Additional Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                  className="input"
                  placeholder="Any additional information or special instructions"
                  rows={4}
                  />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            {step > 1 ? (
            <button
              type="button"
              onClick={prevStep}
                className="btn btn-secondary"
            >
              Previous
            </button>
            ) : (
              <div></div>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary flex items-center gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating Lead...' : 'Create Lead'}
                {!loading && <CheckCircle className="w-4 h-4 ml-2" />}
              </button>
            )}
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
