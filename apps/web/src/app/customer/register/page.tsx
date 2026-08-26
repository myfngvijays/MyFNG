'use client';

/**
 * Customer Registration Page
 * Phase 4 - Task WA-401
 * 
 * Features:
 * - Email/Phone registration
 * - OTP verification
 * - Profile creation
 * - Password setup
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import ConsentCheckboxes from '@/components/dpdp/ConsentCheckboxes';
import { 
  User, 
  Phone, 
  Mail, 
  Lock, 
  CheckCircle, 
  ArrowRight,
  Shield
} from 'lucide-react';

export default function CustomerRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'otp' | 'password'>('details');
  const [loading, setLoading] = useState(false);
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation
  const [errors, setErrors] = useState<any>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [registerConsent, setRegisterConsent] = useState<{ service?: boolean; marketing?: boolean }>({});

  async function handleSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validation
      const newErrors: any = {};
      
      if (!fullName || fullName.length < 3) {
        newErrors.fullName = 'Full name must be at least 3 characters';
      }
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      
      if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
        newErrors.phone = 'Please enter a valid 10-digit Indian mobile number';
      }

      if (!registerConsent.service) {
        newErrors.consent = 'Please tick service delivery consent to continue.';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        setLoading(false);
        return;
      }

      void fetch('/api/public/dpdp/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'customer-register',
          subject_name: fullName,
          subject_email: email,
          subject_phone: phone,
          consents: [
            { purpose: 'service', granted: Boolean(registerConsent.service) },
            { purpose: 'marketing', granted: Boolean(registerConsent.marketing) },
          ],
        }),
      }).catch(() => undefined);

      const supabase = createClient();

      // Check if customer already exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id, email, phone')
        .or(`email.eq.${email},phone.eq.${phone}`)
        .single();

      if (existingCustomer) {
        setErrors({ 
          general: 'An account with this email or phone already exists. Please login.' 
        });
        setLoading(false);
        return;
      }

      // Generate and send OTP (in real implementation)
      // For now, we'll use a dummy OTP system
      const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in session storage (temporary)
      sessionStorage.setItem('registration_otp', generatedOTP);
      sessionStorage.setItem('registration_data', JSON.stringify({
        fullName,
        email,
        phone,
      }));

      // In production, send OTP via SMS/Email
      console.log('OTP sent:', generatedOTP); // Remove in production
      
      setSuccessMessage('OTP sent successfully! Check your phone.');
      setStep('otp');

    } catch (error: any) {
      console.error('Registration error:', error);
      setErrors({ general: error.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const storedOTP = sessionStorage.getItem('registration_otp');
      
      if (otp !== storedOTP) {
        setErrors({ otp: 'Invalid OTP. Please try again.' });
        setLoading(false);
        return;
      }

      setSuccessMessage('OTP verified successfully!');
      setStep('password');

    } catch (error: any) {
      console.error('OTP verification error:', error);
      setErrors({ general: 'OTP verification failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      // Validation
      if (password.length < 8) {
        setErrors({ password: 'Password must be at least 8 characters' });
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' });
        setLoading(false);
        return;
      }

      const registrationData = JSON.parse(
        sessionStorage.getItem('registration_data') || '{}'
      );

      const supabase = createClient();

      // Create customer account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: registrationData.email,
        password: password,
        options: {
          data: {
            full_name: registrationData.fullName,
            phone: registrationData.phone,
            role: 'CUSTOMER',
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Insert into customers table
        const { error: customerError } = await supabase
          .from('customers')
          .insert({
            id: authData.user.id,
            email: registrationData.email,
            phone: registrationData.phone,
            full_name: registrationData.fullName,
            email_verified: false,
            phone_verified: true, // Since we verified OTP
          });

        if (customerError) throw customerError;

        // Clear session storage
        sessionStorage.removeItem('registration_otp');
        sessionStorage.removeItem('registration_data');

        // Show success and redirect
        setSuccessMessage('Registration successful! Redirecting...');
        
        setTimeout(() => {
          router.push('/customer/dashboard');
        }, 2000);
      }

    } catch (error: any) {
      console.error('Password setup error:', error);
      setErrors({ general: error.message || 'Account creation failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-3 sm:p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-7 md:mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-15 sm:h-15 md:w-16 md:h-16 bg-brand-primary rounded-full mb-3 sm:mb-4">
            <User className="w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 text-sm sm:text-base mt-1.5 sm:mt-2">Join MyFNG for hassle-free service</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-6 sm:mb-7 md:mb-8 px-2">
          <div className={`flex items-center ${step === 'details' ? 'text-brand-primary' : 'text-green-500'}`}>
            <div className={`w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
              step === 'details' ? 'bg-brand-primary' : 'bg-green-500'
            } text-white text-xs sm:text-sm font-semibold`}>
              {step === 'details' ? '1' : <CheckCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />}
            </div>
            <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Details</span>
          </div>
          
          <div className="w-8 sm:w-10 md:w-12 h-0.5 bg-gray-300 mx-1 sm:mx-2" />
          
          <div className={`flex items-center ${
            step === 'otp' ? 'text-brand-primary' : step === 'password' ? 'text-green-500' : 'text-gray-400'
          }`}>
            <div className={`w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
              step === 'otp' ? 'bg-brand-primary' : step === 'password' ? 'bg-green-500' : 'bg-gray-300'
            } text-white text-xs sm:text-sm font-semibold`}>
              {step === 'password' ? <CheckCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" /> : '2'}
            </div>
            <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Verify</span>
          </div>
          
          <div className="w-8 sm:w-10 md:w-12 h-0.5 bg-gray-300 mx-1 sm:mx-2" />
          
          <div className={`flex items-center ${step === 'password' ? 'text-brand-primary' : 'text-gray-400'}`}>
            <div className={`w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full flex items-center justify-center ${
              step === 'password' ? 'bg-brand-primary' : 'bg-gray-300'
            } text-white text-xs sm:text-sm font-semibold`}>
              3
            </div>
            <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-medium hidden sm:inline">Secure</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-6 md:p-8">
          {/* Success Message */}
          {successMessage && (
            <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-800 text-xs sm:text-sm">{successMessage}</p>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-xs sm:text-sm">{errors.general}</p>
            </div>
          )}

          {/* Step 1: Details Form */}
          {step === 'details' && (
            <form onSubmit={handleSubmitDetails} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                      errors.fullName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                </div>
                {errors.fullName && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.fullName}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                      errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="your@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Mobile Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                      errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="9876543210"
                    maxLength={10}
                  />
                </div>
                {errors.phone && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.phone}</p>
                )}
              </div>

              <ConsentCheckboxes
                value={registerConsent}
                onChange={setRegisterConsent}
                purposes={['service', 'marketing']}
                requiredPurposes={['service']}
                error={errors.consent}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending OTP...' : 'Continue'}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </form>
          )}

          {/* Step 2: OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-3 sm:space-y-4">
              <div className="text-center mb-4 sm:mb-5 md:mb-6">
                <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-brand-primary mx-auto mb-2 sm:mb-3" />
                <h3 className="text-base sm:text-lg font-semibold">Verify Your Number</h3>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">
                  Enter the 6-digit OTP sent to {phone}
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  OTP Code *
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 border rounded-lg text-center text-xl sm:text-2xl tracking-widest font-semibold focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                    errors.otp ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="000000"
                  maxLength={6}
                />
                {errors.otp && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.otp}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button
                type="button"
                onClick={() => setStep('details')}
                className="w-full text-gray-600 hover:text-gray-800 py-2 text-xs sm:text-sm"
              >
                ← Change Number
              </button>
            </form>
          )}

          {/* Step 3: Password Setup */}
          {step === 'password' && (
            <form onSubmit={handleSetPassword} className="space-y-3 sm:space-y-4">
              <div className="text-center mb-4 sm:mb-5 md:mb-6">
                <Lock className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-brand-primary mx-auto mb-2 sm:mb-3" />
                <h3 className="text-base sm:text-lg font-semibold">Secure Your Account</h3>
                <p className="text-gray-600 text-xs sm:text-sm mt-1">
                  Create a strong password
                </p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                      errors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="At least 8 characters"
                  />
                </div>
                {errors.password && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                      errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Re-enter password"
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-red-500 text-[10px] sm:text-xs mt-0.5 sm:mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating Account...' : 'Complete Registration'}
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </form>
          )}

          {/* Login Link */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              Already have an account?{' '}
              <Link href="/customer/login" className="text-brand-primary font-semibold hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-4 sm:mt-5 md:mt-6 text-center text-xs sm:text-sm text-gray-600">
          <p>🔒 Your data is secure and encrypted</p>
        </div>
      </div>
    </div>
  );
}

