'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  User, Phone, Mail, MapPin, Car, Wrench, Calendar,
  ArrowLeft, Save, X, AlertCircle
} from 'lucide-react';

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params?.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Service types and add-ons
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [serviceAddons, setServiceAddons] = useState<any[]>([]);
  
  // Dropdowns data
  const [cities, setCities] = useState<any[]>([]);
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city_id: '',
    city: '',
    pincode: '',
    
    vehicle_number: '',
    vehicle_make: '',
    model_id: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    service_types: [] as string[],
    service_addons: [] as string[],
    service_type: '',
    problem_description: '',
    description: '',
    
    pickup_required: false,
    pickup_address: '',
    
    notes: '',
    lead_priority: 'NORMAL'
  });

  useEffect(() => {
    fetchLeadDetails();
    fetchServiceTypes();
    fetchServiceAddons();
    fetchCities();
    fetchMakes();
  }, [leadId]);

  async function fetchCities() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  }

  async function fetchMakes() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('make')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get unique makes
      const uniqueMakes = [...new Set(data?.map(item => item.make) || [])];
      setMakes(uniqueMakes.sort());
    } catch (error) {
      console.error('Error fetching makes:', error);
    }
  }

  async function fetchModels(make: string) {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('id, model_name, variant')
        .eq('make', make)
        .eq('is_active', true)
        .order('model_name');
      
      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      setModels([]);
    }
  }

  async function fetchServiceTypes() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('id, name, description')
        .eq('is_active', true);
      
      if (error) throw error;
      setServiceTypes(data || []);
    } catch (error) {
      console.error('Error fetching service types:', error);
    }
  }

  async function fetchServiceAddons() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .eq('is_active', true);
      
      if (error) throw error;
      setServiceAddons(data || []);
    } catch (error) {
      console.error('Error fetching service addons:', error);
    }
  }

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      
      // Check if lead can be edited (only NEW, CONTACTED, INCOMPLETE status)
      if (!['NEW', 'CONTACTED', 'INCOMPLETE'].includes(leadData.status)) {
        setError(`Cannot edit lead with status: ${leadData.status}. Only NEW, CONTACTED, or INCOMPLETE leads can be edited.`);
        setLoading(false);
        return;
      }

      setLead(leadData);
      
      // Fetch models if make exists
      if (leadData.vehicle_make) {
        await fetchModels(leadData.vehicle_make);
      }
      
      // Parse service_type_ids and subservice_ids
      let serviceTypeIds = [];
      let subserviceIds = [];
      
      if (leadData.service_type_ids) {
        try {
          serviceTypeIds = typeof leadData.service_type_ids === 'string' 
            ? JSON.parse(leadData.service_type_ids) 
            : leadData.service_type_ids;
        } catch (e) {
          console.error('Error parsing service_type_ids:', e);
        }
      }
      
      if (leadData.subservice_ids) {
        try {
          subserviceIds = typeof leadData.subservice_ids === 'string' 
            ? JSON.parse(leadData.subservice_ids) 
            : leadData.subservice_ids;
        } catch (e) {
          console.error('Error parsing subservice_ids:', e);
        }
      }
      
      // Populate form with existing data
      setFormData({
        customer_name: leadData.customer_name || '',
        customer_phone: leadData.customer_phone || '',
        customer_alternate_phone: leadData.customer_alternate_phone || '',
        customer_email: leadData.customer_email || '',
        customer_address: leadData.customer_address || '',
        city_id: leadData.city_id || '',
        city: leadData.city || '',
        pincode: leadData.pincode || '',
        
        vehicle_number: leadData.vehicle_number || '',
        vehicle_make: leadData.vehicle_make || '',
        model_id: leadData.model_id || '',
        vehicle_model: leadData.vehicle_model || '',
        vehicle_variant: leadData.vehicle_variant || '',
        vehicle_year: leadData.vehicle_year?.toString() || '',
        vehicle_fuel_type: leadData.vehicle_fuel_type || 'PETROL',
        odometer_km: leadData.odometer_km?.toString() || '',
        
        service_types: serviceTypeIds || [],
        service_addons: subserviceIds || [],
        service_type: leadData.service_type || '',
        problem_description: leadData.problem_description || '',
        description: leadData.description || '',
        
        pickup_required: leadData.pickup_required || false,
        pickup_address: leadData.pickup_address || '',
        
        notes: leadData.notes || '',
        lead_priority: leadData.lead_priority || 'NORMAL'
      });

    } catch (error) {
      console.error('Error fetching lead:', error);
      setError('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Fetch models when make changes
    if (name === 'vehicle_make' && value) {
      fetchModels(value);
      // Reset model selection when make changes
      setFormData(prev => ({
        ...prev,
        vehicle_make: value,
        model_id: '',
        vehicle_model: ''
      }));
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

  function validateVehicleNumber(vehicleNumber: string): boolean {
    // Indian vehicle number format: AB12CD1234 or AB-12-CD-1234 or AB 12 CD 1234
    const regex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
    const cleanNumber = vehicleNumber.replace(/[-\s]/g, '').toUpperCase();
    return regex.test(cleanNumber);
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Customer validation
    if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
    if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone number is required';
    if (formData.customer_phone && formData.customer_phone.length < 10) {
      newErrors.customer_phone = 'Please enter valid 10-digit phone number';
    }
    if (!formData.customer_address.trim()) newErrors.customer_address = 'Address is required';
    if (!formData.city_id) newErrors.city_id = 'City is required';

    // Vehicle validation
    if (!formData.vehicle_number.trim()) newErrors.vehicle_number = 'Vehicle number is required';
    if (!formData.vehicle_make.trim()) newErrors.vehicle_make = 'Vehicle make is required';
    if (!formData.model_id) newErrors.model_id = 'Vehicle model is required';
    if (!formData.vehicle_fuel_type) newErrors.vehicle_fuel_type = 'Fuel type is required';
    
    // Vehicle number validation (Indian format)
    if (formData.vehicle_number && !validateVehicleNumber(formData.vehicle_number)) {
      newErrors.vehicle_number = 'Please enter valid vehicle number (e.g., MH12AB1234)';
    }

    // Service validation
    if (formData.service_types.length === 0) newErrors.service_types = 'Please select at least one service type';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      alert('Please fill all required fields correctly');
      return;
    }
    
    setSaving(true);

    try {
      const supabase = createClient();
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      // Update lead
      const { error: updateError } = await supabase
        .from('service_leads')
        .update({
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          customer_alternate_phone: formData.customer_alternate_phone || null,
          customer_email: formData.customer_email || null,
          customer_address: formData.customer_address || null,
          city_id: formData.city_id || null,
          city: formData.city || null,
          pincode: formData.pincode || null,
          
          vehicle_number: formData.vehicle_number,
          vehicle_make: formData.vehicle_make,
          model_id: formData.model_id || null,
          vehicle_model: formData.vehicle_model,
          vehicle_variant: formData.vehicle_variant || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_fuel_type: formData.vehicle_fuel_type,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
          service_type_ids: JSON.stringify(formData.service_types),
          subservice_ids: JSON.stringify(formData.service_addons),
          service_type: formData.service_type,
          problem_description: formData.problem_description || null,
          description: formData.description || null,
          
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_address || null,
          
          notes: formData.notes || null,
          lead_priority: formData.lead_priority,
          
          is_incomplete: false,
          updated_by_id: userProfile?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Success - redirect to lead details
      router.push(`/dashboard/telecaller/leads/${leadId}`);

    } catch (error: any) {
      console.error('Error updating lead:', error);
      alert('Failed to update lead: ' + (error?.message || String(error)));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading lead details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lead) {
    return (
      <DashboardLayout role="telecaller">
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-4">{error || 'Lead not found'}</p>
          <button onClick={() => router.back()} className="btn btn-primary">
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="btn btn-outline">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-heading">Edit Lead</h1>
              <p className="text-text-body mt-1">Lead #{lead.lead_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">Status: {lead.status}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card space-y-8">
          {/* Customer Details */}
          <div>
            <h2 className="text-xl font-bold text-text-heading mb-4 flex items-center gap-2">
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
                  required
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
                  maxLength={10}
                  required
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
                  rows={2}
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
                  onChange={(e) => {
                    const selectedCity = cities.find(c => c.id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      city_id: e.target.value,
                      city: selectedCity?.name || ''
                    }));
                    // Clear error
                    if (errors.city_id) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.city_id;
                        return newErrors;
                      });
                    }
                  }}
                  className={`input ${errors.city_id ? 'border-red-500' : ''}`}
                  required
                >
                  <option value="">Select City</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {city.name}, {city.state}
                    </option>
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
                  maxLength={6}
                />
              </div>
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-text-heading mb-4 flex items-center gap-2">
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
                  Make <span className="text-red-500">*</span>
                </label>
                <select
                  name="vehicle_make"
                  value={formData.vehicle_make}
                  onChange={handleChange}
                  className={`input ${errors.vehicle_make ? 'border-red-500' : ''}`}
                  required
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
                  Model <span className="text-red-500">*</span>
                </label>
                <select
                  name="model_id"
                  value={formData.model_id}
                  onChange={(e) => {
                    const selectedModel = models.find(m => m.id === e.target.value);
                    setFormData(prev => ({
                      ...prev,
                      model_id: e.target.value,
                      vehicle_model: selectedModel?.model_name || ''
                    }));
                    // Clear error
                    if (errors.model_id) {
                      setErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors.model_id;
                        return newErrors;
                      });
                    }
                  }}
                  className={`input ${errors.model_id ? 'border-red-500' : ''}`}
                  disabled={!formData.vehicle_make}
                  required
                >
                  <option value="">Select Model</option>
                  {models.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.model_name}
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
                  min="1900"
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
                  className="input"
                  required
                >
                  <option value="PETROL">Petrol</option>
                  <option value="DIESEL">Diesel</option>
                  <option value="CNG">CNG</option>
                  <option value="ELECTRIC">Electric</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Odometer (km)
                </label>
                <input
                  type="number"
                  name="odometer_km"
                  value={formData.odometer_km}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-text-heading mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Service Details
            </h2>
            <div className="space-y-6">
              {/* Service Types */}
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
                        {service.description && (
                          <div className="text-sm text-text-body">{service.description}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                {errors.service_types && (
                  <p className="mt-2 text-sm text-red-500">{errors.service_types}</p>
                )}
              </div>

              {/* Service Add-ons */}
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
                        {addon.price && (
                          <div className="text-sm text-brand-primary">₹{addon.price}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Problem Description
                </label>
                <textarea
                  name="problem_description"
                  value={formData.problem_description}
                  onChange={handleChange}
                  className="input"
                  rows={3}
                  placeholder="Describe the problem or service needed"
                />
              </div>

              {/* Additional Description */}
              <div>
                <label className="block text-sm font-medium text-text-body mb-2">
                  Additional Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="input"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Pickup Details */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-text-heading mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Pickup Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="pickup_required"
                    checked={formData.pickup_required}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand-primary"
                  />
                  <span className="text-sm font-medium">Pickup Required</span>
                </label>
              </div>

              {formData.pickup_required && (
                <div>
                  <label className="block text-sm font-medium text-text-body mb-2">
                    Pickup Address
                  </label>
                  <textarea
                    name="pickup_address"
                    value={formData.pickup_address}
                    onChange={handleChange}
                    className="input"
                    rows={2}
                    placeholder="Enter pickup address or leave blank to use customer address"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Additional Info */}
          <div className="border-t pt-6">
            <h2 className="text-xl font-bold text-text-heading mb-4">
              Additional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-body mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="input"
                  rows={3}
                  placeholder="Any additional notes or comments"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-outline flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

