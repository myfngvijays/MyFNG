'use client';

import { useState, useEffect } from 'react';
import { 
  Car, 
  MapPin, 
  User, 
  Phone, 
  AlertCircle,
  CheckCircle,
  Zap,
  Shield,
  Wrench,
  Sparkles,
  Send,
  Star,
  ArrowRight,
  ArrowLeft,
  Smile,
  PartyPopper
} from 'lucide-react';
import { getCurrentOrStoredUtmParams, getLeadSourceFromUtm } from '@/lib/utm';

type BookingType = 'service' | 'rsa' | null;

interface BookingFormData {
  bookingType: BookingType;
  vehicleNumber: string;
  customerName: string;
  customerPhone: string;
  location: string;
}

export default function BookingForm({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<BookingFormData>({
    bookingType: null,
    vehicleNumber: '',
    customerName: '',
    customerPhone: '',
    location: ''
  });

  const [fieldValue, setFieldValue] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  const steps = [
    {
      id: 'bookingType',
      title: 'What do you need?',
      subtitle: 'Choose the type of service',
      placeholder: '',
      type: 'select',
      options: [
        { value: 'service', label: 'Car Service', icon: Wrench, color: 'brand-primary', desc: 'Regular maintenance & repairs' },
        { value: 'rsa', label: 'Roadside Help', icon: AlertCircle, color: 'red-500', desc: 'Emergency assistance' }
      ]
    },
    {
      id: 'vehicleNumber',
      title: 'What\'s your vehicle number?',
      subtitle: 'Enter your vehicle registration number',
      placeholder: 'MH 12 AB 1234',
      type: 'text',
      icon: Car
    },
    {
      id: 'customerName',
      title: 'What should we call you?',
      subtitle: 'Enter your name',
      placeholder: 'Your name',
      type: 'text',
      icon: User
    },
    {
      id: 'customerPhone',
      title: 'How can we reach you?',
      subtitle: 'Enter your phone number',
      placeholder: '9876543210',
      type: 'tel',
      icon: Phone
    },
    {
      id: 'location',
      title: 'Where are you located?',
      subtitle: 'Help us serve you better (Optional)',
      placeholder: 'e.g., Bandra, Mumbai',
      type: 'text',
      icon: MapPin,
      optional: true
    }
  ];

  useEffect(() => {
    // Set initial field value based on current step
    const stepId = steps[currentStep]?.id as keyof BookingFormData;
    setFieldValue(formData[stepId] || '');
    
    // Auto-detect location when location step is reached
    if (stepId === 'location' && !formData.location && !isDetectingLocation) {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const detectLocation = async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setIsDetectingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use OpenStreetMap Nominatim API for reverse geocoding (free, no API key needed)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch location');
          }
          
          const data = await response.json();
          
          // Extract location string
          const address = data.address;
          let locationString = '';
          
          if (address.neighbourhood || address.suburb) {
            locationString = `${address.neighbourhood || address.suburb}`;
          }
          if (address.city || address.town || address.village) {
            if (locationString) {
              locationString += `, ${address.city || address.town || address.village}`;
            } else {
              locationString = address.city || address.town || address.village;
            }
          }
          if (address.state && !locationString.includes(address.state)) {
            if (locationString) {
              locationString += `, ${address.state}`;
            } else {
              locationString = address.state;
            }
          }
          
          if (locationString) {
            handleInputChange(locationString);
          } else {
            // Fallback to coordinates if address parsing fails
            handleInputChange(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (error) {
          console.error('Error fetching location:', error);
          // Fallback: use coordinates
          handleInputChange(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsDetectingLocation(false);
        setLocationError('Unable to detect location. Please enter manually.');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleNext = () => {
    if (currentStep === 0 && !formData.bookingType) return;
    if (currentStep === 1 && !formData.vehicleNumber.trim()) return;
    if (currentStep === 2 && !formData.customerName.trim()) return;
    if (currentStep === 3 && !formData.customerPhone.trim()) return;

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

  const handleInputChange = (value: string) => {
    setFieldValue(value);
    const stepId = steps[currentStep]?.id as keyof BookingFormData;
    setFormData(prev => ({ ...prev, [stepId]: value }));
  };

  const handleSelect = (value: string) => {
    setFormData(prev => ({ ...prev, bookingType: value as BookingType }));
    setTimeout(() => handleNext(), 400);
  };

  const handleSubmit = async () => {
    if (!formData.bookingType || !formData.vehicleNumber || !formData.customerName || !formData.customerPhone) {
      return;
    }

    setIsSubmitting(true);
    try {
      const utmParams = getCurrentOrStoredUtmParams();
      const leadSource = getLeadSourceFromUtm(utmParams.utm_source, utmParams.utm_medium);
      const leadNumber = `L-${Date.now().toString().slice(-8)}`;
      const leadType = formData.bookingType === 'rsa' ? 'RSA' : 'CAR_SERVICE';

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
            lead_type: leadType,
            lead_source: leadSource,
            customer_name: formData.customerName.trim(),
            customer_phone: formData.customerPhone.trim(),
            vehicle_number: formData.vehicleNumber.trim(),
            address: formData.location?.trim() || null,
            customer_address: formData.location?.trim() || null,
            lead_priority: 'NORMAL',
            created_at: new Date().toISOString(),
            meta: utmParams,
          },
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json?.error || 'Failed to create booking');
      }

      setTimeout(() => {
        setIsSubmitting(false);
        setTimeout(() => {
          alert('Booking submitted successfully! We will contact you shortly.');
          onClose();
        }, 1500);
      }, 1000);
    } catch (error) {
      console.error('Booking error:', error);
      setIsSubmitting(false);
      alert('Failed to submit booking. Please try again.');
    }
  };

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;
  const canProceed = currentStep === 0 
    ? formData.bookingType !== null
    : currentStep === 1
    ? formData.vehicleNumber.trim() !== ''
    : currentStep === 2
    ? formData.customerName.trim() !== ''
    : currentStep === 3
    ? formData.customerPhone.trim() !== ''
    : true;

  const bookingTypeLabel =
    formData.bookingType === 'service'
      ? 'Car Service'
      : formData.bookingType === 'rsa'
        ? 'Roadside Help'
        : '—';

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
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full relative overflow-hidden">
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
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition z-10 shadow-md"
          aria-label="Close"
        >
          ×
        </button>

        {/* Form Content */}
        <div className="p-6 sm:p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
            {/* Left: Steps */}
            <div className="md:col-span-7">
              {/* Step Counter */}
              <div className="text-right mb-6">
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

            {/* Input Field or Selection */}
            {currentStepData.type === 'select' ? (
              <div className="space-y-4 mb-12">
                {currentStepData.options?.map((option) => {
                  const Icon = option.icon;
                  const isSelected = formData.bookingType === option.value;
                  const isService = option.value === 'service';
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleSelect(option.value)}
                      className={`w-full p-6 rounded-2xl border-2 transition-all transform hover:scale-[1.02] text-left ${
                        isSelected
                          ? isService
                            ? 'border-brand-primary bg-brand-primary/5 shadow-lg'
                            : 'border-red-500 bg-red-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-4 rounded-xl transition-colors ${
                          isSelected 
                            ? isService
                              ? 'bg-brand-primary text-white'
                              : 'bg-red-500 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 mb-1">{option.label}</h3>
                          <p className="text-sm text-gray-600">{option.desc}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className={`w-6 h-6 ${isService ? 'text-brand-primary' : 'text-red-500'}`} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-12">
                {/* Location Auto-Detection */}
                {currentStepData.id === 'location' && isDetectingLocation && (
                  <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-blue-700 font-medium">Detecting your location...</p>
                    </div>
                  </div>
                )}
                
                {currentStepData.id === 'location' && locationError && (
                  <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl animate-fade-in">
                    <p className="text-sm text-yellow-700">{locationError}</p>
                  </div>
                )}

                <div className="relative">
                  {currentStepData.icon && (
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 ${
                      isDetectingLocation ? 'text-brand-primary animate-pulse' : 'text-gray-400'
                    }`}>
                      <currentStepData.icon className="w-6 h-6" />
                    </div>
                  )}
                  <input
                    id={`booking-${currentStepData.id}`}
                    name={currentStepData.id}
                    type={currentStepData.type}
                    value={fieldValue}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (currentStepData.id === 'vehicleNumber') {
                        value = value.toUpperCase();
                      } else if (currentStepData.id === 'customerPhone') {
                        value = value.replace(/\D/g, '').slice(0, 10);
                      }
                      handleInputChange(value);
                    }}
                    placeholder={isDetectingLocation ? 'Detecting location...' : currentStepData.placeholder}
                    disabled={isDetectingLocation}
                    className={`w-full px-4 ${currentStepData.icon ? 'pl-14' : 'pl-4'} py-5 text-xl border-2 rounded-xl focus:ring-2 outline-none transition-all ${
                      fieldValue
                        ? 'border-brand-primary bg-brand-primary/5'
                        : isDetectingLocation
                        ? 'border-brand-primary/50 bg-blue-50'
                        : 'border-gray-200 focus:border-brand-primary focus:ring-brand-primary/20'
                    } ${isDetectingLocation ? 'cursor-wait' : ''}`}
                    autoFocus={!isDetectingLocation}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canProceed && !isDetectingLocation) {
                        handleNext();
                      }
                    }}
                  />
                  {fieldValue && !isDetectingLocation && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  )}
                </div>
                
                {currentStepData.optional && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm text-gray-500 flex items-center gap-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">Optional</span>
                      You can skip this step
                    </p>
                    {currentStepData.id === 'location' && !fieldValue && !isDetectingLocation && (
                      <button
                        onClick={detectLocation}
                        className="text-sm text-brand-primary font-semibold hover:text-brand-secondary flex items-center gap-1"
                      >
                        <MapPin className="w-4 h-4" />
                        Detect Location
                      </button>
                    )}
                  </div>
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

            {/* Right: Summary (desktop) */}
            <div className="hidden md:block md:col-span-5">
              <div className="sticky top-6">
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Summary</div>
                  <div className="mt-1 text-xl font-extrabold text-gray-900">Live preview</div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white border border-gray-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Type</div>
                      <div className="mt-1 text-sm font-bold text-gray-900">{bookingTypeLabel}</div>
                    </div>

                    <div className="rounded-2xl bg-white border border-gray-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Vehicle</div>
                      <div className="mt-1 text-sm font-bold text-gray-900">
                        {formData.vehicleNumber?.trim() ? formData.vehicleNumber : '—'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white border border-gray-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Customer</div>
                      <div className="mt-1 text-sm font-bold text-gray-900">
                        {formData.customerName?.trim() ? formData.customerName : '—'}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formData.customerPhone?.trim() ? formData.customerPhone : ''}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white border border-gray-200 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Location</div>
                      <div className="mt-1 text-sm font-bold text-gray-900">
                        {formData.location?.trim() ? formData.location : '—'}
                      </div>
                      {currentStepData.id === 'location' && isDetectingLocation ? (
                        <div className="mt-2 text-xs text-blue-700">Detecting…</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="text-xs font-bold text-blue-700">Tip</div>
                    <div className="mt-1 text-xs text-blue-700 leading-relaxed">
                      This panel updates as you fill the form — so you can confirm everything before submitting.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
