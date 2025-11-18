'use client';

/**
 * Customer Lead Creation Form
 * Phase 4 - Task WA-404
 * 
 * Features:
 * - Vehicle details input
 * - Service type selection
 * - Problem description
 * - Preferred slot booking
 * - Photo upload
 * - Workshop selection
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Car,
  Wrench,
  Calendar,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  MapPin,
} from 'lucide-react';

export default function CreateLeadPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<any>(null);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  // Form data
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [fuelType, setFuelType] = useState('PETROL');
  const [odometer, setOdometer] = useState('');
  
  const [serviceType, setServiceType] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [pickupRequired, setPickupRequired] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  
  const [photos, setPhotos] = useState<File[]>([]);
  const [errors, setErrors] = useState<any>({});

  const serviceTypes = [
    'General Service',
    'Oil Change',
    'Brake Service',
    'AC Service',
    'Engine Repair',
    'Transmission Service',
    'Tire Service',
    'Battery Replacement',
    'Electrical Service',
    'Body Work',
    'Painting',
    'Detailing',
  ];

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/customer/login');
        return;
      }

      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', user.id)
        .single();

      setCustomer(customerData);
      setPickupAddress(customerData?.address || '');

      // Fetch nearby workshops
      const { data: workshopsData } = await supabase
        .from('workshops')
        .select('*')
        .eq('is_active', true)
        .limit(10);

      setWorkshops(workshopsData || []);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  function validateStep1() {
    const newErrors: any = {};

    if (!vehicleNumber || !/^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/.test(vehicleNumber.toUpperCase())) {
      newErrors.vehicleNumber = 'Please enter a valid vehicle number (e.g., MH12AB1234)';
    }
    if (!vehicleMake) newErrors.vehicleMake = 'Vehicle make is required';
    if (!vehicleModel) newErrors.vehicleModel = 'Vehicle model is required';
    if (!vehicleYear || parseInt(vehicleYear) < 1990 || parseInt(vehicleYear) > new Date().getFullYear() + 1) {
      newErrors.vehicleYear = 'Please enter a valid year';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep2() {
    const newErrors: any = {};

    if (!serviceType) newErrors.serviceType = 'Please select a service type';
    if (!problemDescription || problemDescription.length < 10) {
      newErrors.problemDescription = 'Please describe the problem (minimum 10 characters)';
    }
    if (pickupRequired && !pickupAddress) {
      newErrors.pickupAddress = 'Pickup address is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function validateStep3() {
    const newErrors: any = {};

    if (!preferredDate) newErrors.preferredDate = 'Please select a preferred date';
    if (!preferredTime) newErrors.preferredTime = 'Please select a preferred time';
    if (!workshopId) newErrors.workshopId = 'Please select a workshop';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleNext() {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  }

  async function handleSubmit() {
    if (!validateStep3()) return;

    setLoading(true);
    const supabase = createClient();

    try {
      // Generate lead number
      const leadNumber = `LN${Date.now().toString().slice(-6)}`;

      // Create lead
      const { data: lead, error: leadError } = await supabase
        .from('service_leads')
        .insert({
          lead_number: leadNumber,
          customer_name: customer.full_name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          vehicle_number: vehicleNumber.toUpperCase(),
          vehicle_make: vehicleMake,
          vehicle_model: vehicleModel,
          vehicle_year: parseInt(vehicleYear),
          fuel_type: fuelType,
          odometer_reading: parseInt(odometer) || null,
          service_type: serviceType,
          problem_description: problemDescription,
          pickup_required: pickupRequired,
          pickup_address: pickupRequired ? pickupAddress : null,
          preferred_service_slot: `${preferredDate} ${preferredTime}`,
          workshop_id: workshopId,
          status: 'NEW',
          lead_type: 'NORMAL',
        })
        .select()
        .single();

      if (leadError) throw leadError;

      // Upload photos if any
      if (photos.length > 0 && lead) {
        for (const photo of photos) {
          const fileName = `${lead.id}/${Date.now()}_${photo.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('myfng-media')
            .upload(`lead-media/${fileName}`, photo);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('myfng-media')
              .getPublicUrl(`lead-media/${fileName}`);

            await supabase.from('lead_media').insert({
              lead_id: lead.id,
              media_url: publicUrl,
              media_type: 'IMAGE',
              media_category: 'CUSTOMER_UPLOAD',
              uploaded_by: customer.id,
            });
          }
        }
      }

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'LEAD_CREATED',
        event_description: 'Lead created by customer',
        created_by: customer.id,
      });

      alert('Service request submitted successfully!');
      router.push(`/customer/track/${lead.id}`);

    } catch (error: any) {
      console.error('Error creating lead:', error);
      alert('Failed to create service request. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 5) {
      alert('Maximum 5 photos allowed');
      return;
    }
    setPhotos([...photos, ...files.slice(0, 5 - photos.length)]);
  }

  function removePhoto(index: number) {
    setPhotos(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/customer/dashboard" className="text-brand-primary hover:underline flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Request Service</h1>
          <p className="text-gray-600 mt-2">Fill in the details to request a service</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center ${s < 3 ? 'flex-1' : ''}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step > s ? <CheckCircle className="w-6 h-6" /> : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    step > s ? 'bg-brand-primary' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm">
            <span className={step >= 1 ? 'text-brand-primary font-medium' : 'text-gray-600'}>
              Vehicle Details
            </span>
            <span className={step >= 2 ? 'text-brand-primary font-medium' : 'text-gray-600'}>
              Service Details
            </span>
            <span className={step >= 3 ? 'text-brand-primary font-medium' : 'text-gray-600'}>
              Schedule
            </span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Step 1: Vehicle Details */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Car className="w-6 h-6 text-brand-primary" />
                Vehicle Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Number *
                </label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className={`w-full px-4 py-3 border rounded-lg ${
                    errors.vehicleNumber ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="MH12AB1234"
                />
                {errors.vehicleNumber && (
                  <p className="text-red-500 text-xs mt-1">{errors.vehicleNumber}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make *
                  </label>
                  <input
                    type="text"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.vehicleMake ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Maruti"
                  />
                  {errors.vehicleMake && (
                    <p className="text-red-500 text-xs mt-1">{errors.vehicleMake}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model *
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.vehicleModel ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Swift"
                  />
                  {errors.vehicleModel && (
                    <p className="text-red-500 text-xs mt-1">{errors.vehicleModel}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year *
                  </label>
                  <input
                    type="number"
                    value={vehicleYear}
                    onChange={(e) => setVehicleYear(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.vehicleYear ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="2020"
                    min="1990"
                    max={new Date().getFullYear() + 1}
                  />
                  {errors.vehicleYear && (
                    <p className="text-red-500 text-xs mt-1">{errors.vehicleYear}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fuel Type *
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                  >
                    <option value="PETROL">Petrol</option>
                    <option value="DIESEL">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="ELECTRIC">Electric</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Odometer (km)
                  </label>
                  <input
                    type="number"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                    placeholder="50000"
                  />
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 mt-6"
              >
                Next
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Step 2: Service Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Wrench className="w-6 h-6 text-brand-primary" />
                Service Information
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Type *
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg ${
                    errors.serviceType ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select service type</option>
                  {serviceTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.serviceType && (
                  <p className="text-red-500 text-xs mt-1">{errors.serviceType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Problem Description *
                </label>
                <textarea
                  value={problemDescription}
                  onChange={(e) => setProblemDescription(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-lg ${
                    errors.problemDescription ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={4}
                  placeholder="Describe the issue in detail..."
                />
                {errors.problemDescription && (
                  <p className="text-red-500 text-xs mt-1">{errors.problemDescription}</p>
                )}
              </div>

              <div className="border-t pt-4">
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    checked={pickupRequired}
                    onChange={(e) => setPickupRequired(e.target.checked)}
                    className="rounded text-brand-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Pickup required from my location
                  </span>
                </label>

                {pickupRequired && (
                  <textarea
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.pickupAddress ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Enter pickup address..."
                  />
                )}
                {errors.pickupAddress && (
                  <p className="text-red-500 text-xs mt-1">{errors.pickupAddress}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Photos (Optional, max 5)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="flex flex-col items-center cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Click to upload photos</span>
                  </label>

                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2"
                >
                  Next
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
                <Calendar className="w-6 h-6 text-brand-primary" />
                Schedule & Workshop
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.preferredDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.preferredDate && (
                    <p className="text-red-500 text-xs mt-1">{errors.preferredDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Time *
                  </label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-lg ${
                      errors.preferredTime ? 'border-red-500' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select time</option>
                    <option value="09:00-12:00">Morning (9 AM - 12 PM)</option>
                    <option value="12:00-15:00">Afternoon (12 PM - 3 PM)</option>
                    <option value="15:00-18:00">Evening (3 PM - 6 PM)</option>
                  </select>
                  {errors.preferredTime && (
                    <p className="text-red-500 text-xs mt-1">{errors.preferredTime}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Workshop *
                </label>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {workshops.map((workshop) => (
                    <label
                      key={workshop.id}
                      className={`block p-4 border rounded-lg cursor-pointer hover:shadow transition-shadow ${
                        workshopId === workshop.id ? 'border-brand-primary bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="workshop"
                        value={workshop.id}
                        checked={workshopId === workshop.id}
                        onChange={(e) => setWorkshopId(e.target.value)}
                        className="hidden"
                      />
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-brand-primary flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{workshop.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">{workshop.address}</p>
                          <p className="text-sm text-gray-500 mt-1">
                            📞 {workshop.phone}
                          </p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.workshopId && (
                  <p className="text-red-500 text-xs mt-1">{errors.workshopId}</p>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-lg font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

