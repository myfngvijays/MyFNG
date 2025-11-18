'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  User, Phone, Mail, MapPin, Car, Wrench, Calendar,
  Clock, DollarSign, AlertCircle, CheckCircle, ArrowRight
} from 'lucide-react';

export default function CreateLeadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Customer Details
    customer_name: '',
    customer_phone: '',
    customer_alternate_phone: '',
    customer_email: '',
    customer_address: '',
    city: '',
    pincode: '',
    contact_method: 'CALL',
    
    // Vehicle Details
    vehicle_number: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_variant: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
    
    // Service Details
    service_type: '',
    description: '',
    problem_description: '',
    
    // Pickup Details
    pickup_required: false,
    pickup_address: '',
    preferred_slot_start: '',
    
    // Additional
    notes: '',
    lead_priority: 'NORMAL'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.customer_name.trim()) newErrors.customer_name = 'Customer name is required';
      if (!formData.customer_phone.trim()) newErrors.customer_phone = 'Phone number is required';
      if (formData.customer_phone && formData.customer_phone.length < 10) {
        newErrors.customer_phone = 'Please enter valid 10-digit phone number';
      }
      if (!formData.city.trim()) newErrors.city = 'City is required';
    }

    if (currentStep === 2) {
      if (!formData.vehicle_make.trim()) newErrors.vehicle_make = 'Vehicle make is required';
      if (!formData.vehicle_model.trim()) newErrors.vehicle_model = 'Vehicle model is required';
    }

    if (currentStep === 3) {
      if (!formData.service_type.trim()) newErrors.service_type = 'Service type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(step)) return;

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

      // Create lead
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
          customer_address: formData.customer_address || null,
          city: formData.city,
          pincode: formData.pincode || null,
          contact_method: formData.contact_method,
          
          // Vehicle details
          vehicle_number: formData.vehicle_number || null,
          vehicle_make: formData.vehicle_make,
          vehicle_model: formData.vehicle_model,
          vehicle_variant: formData.vehicle_variant || null,
          vehicle_year: formData.vehicle_year ? parseInt(formData.vehicle_year) : null,
          vehicle_fuel_type: formData.vehicle_fuel_type,
          odometer_km: formData.odometer_km ? parseInt(formData.odometer_km) : null,
          
          // Service details
          service_type: formData.service_type,
          description: formData.description || null,
          problem_description: formData.problem_description || null,
          
          // Pickup
          pickup_required: formData.pickup_required,
          pickup_address: formData.pickup_required ? (formData.pickup_address || formData.customer_address) : null,
          preferred_slot_start: formData.preferred_slot_start || null,
          
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

      // Create event log
      await supabase
        .from('lead_events')
        .insert([{
          lead_id: lead.id,
          event_type: 'lead_created',
          event_category: 'LEAD',
          actor: `user:${userProfile?.id}`,
          actor_name: user.email,
          actor_role: 'TELECALLER',
          event_description: `Lead created by telecaller: ${leadNumber}`,
          metadata: {
            source: 'TELECALLER',
            created_from: 'manual_form'
          }
        }]);

      // Create initial call log
      await supabase
        .from('telecaller_call_logs')
        .insert([{
          lead_id: lead.id,
          telecaller_id: userProfile?.id,
          call_type: 'OUTBOUND',
          call_status: 'COMPLETED',
          outcome: 'LEAD_CREATED',
          notes: 'Lead created via manual form',
          phone_number: formData.customer_phone
        }]);

      alert(`Lead created successfully! Lead Number: ${leadNumber}`);
      router.push(`/dashboard/telecaller/leads/${lead.id}`);

    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Failed to create lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Create New Lead</h1>
          <p className="text-text-body mt-2">Fill in customer and vehicle details to create a lead</p>
        </div>

        {/* Progress Steps */}
        <div className="card">
          <div className="flex items-center justify-between">
            {[
              { num: 1, label: 'Customer Info', icon: User },
              { num: 2, label: 'Vehicle Details', icon: Car },
              { num: 3, label: 'Service Type', icon: Wrench },
              { num: 4, label: 'Additional Info', icon: Calendar }
            ].map((s, idx) => (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    step >= s.num ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s.num ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <s.icon className="w-6 h-6" />
                    )}
                  </div>
                  <span className={`text-sm mt-2 font-semibold ${
                    step >= s.num ? 'text-brand-primary' : 'text-gray-500'
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div className={`h-1 flex-1 ${step > s.num ? 'bg-brand-primary' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card">
          {/* Step 1: Customer Information */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <User className="w-6 h-6" />
                Customer Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    name="customer_name"
                    value={formData.customer_name}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.customer_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter customer name"
                  />
                  {errors.customer_name && (
                    <p className="text-red-500 text-xs mt-1">{errors.customer_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="customer_phone"
                    value={formData.customer_phone}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.customer_phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="10-digit phone number"
                    maxLength={10}
                  />
                  {errors.customer_phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.customer_phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="tel"
                    name="customer_alternate_phone"
                    value={formData.customer_alternate_phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="Optional"
                    maxLength={10}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="customer_email"
                    value={formData.customer_email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="customer@example.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    name="customer_address"
                    value={formData.customer_address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="Complete address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="City name"
                  />
                  {errors.city && (
                    <p className="text-red-500 text-xs mt-1">{errors.city}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Contact Method
                  </label>
                  <select
                    name="contact_method"
                    value={formData.contact_method}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="CALL">Phone Call</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Vehicle Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Car className="w-6 h-6" />
                Vehicle Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Registration Number
                  </label>
                  <input
                    type="text"
                    name="vehicle_number"
                    value={formData.vehicle_number}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary uppercase"
                    placeholder="MH01AB1234"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Make / Brand *
                  </label>
                  <input
                    type="text"
                    name="vehicle_make"
                    value={formData.vehicle_make}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.vehicle_make ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Maruti, Hyundai"
                  />
                  {errors.vehicle_make && (
                    <p className="text-red-500 text-xs mt-1">{errors.vehicle_make}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Model *
                  </label>
                  <input
                    type="text"
                    name="vehicle_model"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.vehicle_model ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Swift, Creta"
                  />
                  {errors.vehicle_model && (
                    <p className="text-red-500 text-xs mt-1">{errors.vehicle_model}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variant
                  </label>
                  <input
                    type="text"
                    name="vehicle_variant"
                    value={formData.vehicle_variant}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="e.g., VXI, SX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturing Year
                  </label>
                  <input
                    type="number"
                    name="vehicle_year"
                    value={formData.vehicle_year}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="2020"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuel Type
                  </label>
                  <select
                    name="vehicle_fuel_type"
                    value={formData.vehicle_fuel_type}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="EV">Electric</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Odometer Reading (km)
                  </label>
                  <input
                    type="number"
                    name="odometer_km"
                    value={formData.odometer_km}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    placeholder="50000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Service Type */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Wrench className="w-6 h-6" />
                Service Requirements
              </h2>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Type *
                  </label>
                  <select
                    name="service_type"
                    value={formData.service_type}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary ${
                      errors.service_type ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select service type</option>
                    <option value="GENERAL_SERVICE">General Service</option>
                    <option value="OIL_CHANGE">Oil Change</option>
                    <option value="BRAKE_SERVICE">Brake Service</option>
                    <option value="AC_SERVICE">AC Service</option>
                    <option value="BATTERY">Battery Replacement</option>
                    <option value="TIRE_SERVICE">Tire Service</option>
                    <option value="SUSPENSION">Suspension Repair</option>
                    <option value="ENGINE_REPAIR">Engine Repair</option>
                    <option value="DENTING_PAINTING">Denting & Painting</option>
                    <option value="DETAILING">Car Detailing</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {errors.service_type && (
                    <p className="text-red-500 text-xs mt-1">{errors.service_type}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Service Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    rows={3}
                    placeholder="Brief service description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Problem Description (Customer's words)
                  </label>
                  <textarea
                    name="problem_description"
                    value={formData.problem_description}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    rows={4}
                    placeholder="What problem is the customer facing?..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Additional Info */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                Additional Information
              </h2>

              <div className="grid grid-cols-1 gap-4">
                {/* Pickup Required */}
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    name="pickup_required"
                    checked={formData.pickup_required}
                    onChange={handleChange}
                    className="w-5 h-5 text-brand-primary rounded"
                    id="pickup_required"
                  />
                  <label htmlFor="pickup_required" className="text-sm font-medium cursor-pointer">
                    Customer requires vehicle pickup
                  </label>
                </div>

                {formData.pickup_required && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Pickup Address
                      </label>
                      <input
                        type="text"
                        name="pickup_address"
                        value={formData.pickup_address}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                        placeholder="Pickup address (leave empty to use customer address)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preferred Pickup Time
                      </label>
                      <input
                        type="datetime-local"
                        name="preferred_slot_start"
                        value={formData.preferred_slot_start}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lead Priority
                  </label>
                  <select
                    name="lead_priority"
                    value={formData.lead_priority}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  >
                    <option value="LOW">Low Priority</option>
                    <option value="NORMAL">Normal Priority</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Internal Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                    rows={3}
                    placeholder="Any additional notes or observations..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t">
            <button
              type="button"
              onClick={prevStep}
              disabled={step === 1}
              className="btn btn-outline"
            >
              Previous
            </button>

            <div className="text-sm text-gray-500">
              Step {step} of 4
            </div>

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary"
              >
                Next <ArrowRight className="w-4 h-4 ml-2" />
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

