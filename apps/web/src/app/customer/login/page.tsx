'use client';

/**
 * Customer Login Page
 * Phase 4 - Task WA-402
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, ArrowRight, User, Eye, EyeOff } from 'lucide-react';

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        // Verify user is a customer
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!customer) {
          await supabase.auth.signOut();
          throw new Error('Invalid customer account');
        }

        router.push('/customer/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Invalid email or password');
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
          <h1 className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600 text-sm sm:text-base mt-1.5 sm:mt-2">Login to manage your services</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-6 md:p-8">
          {error && (
            <div className="mb-4 sm:mb-5 md:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
              <label className="flex items-center">
                <input type="checkbox" className="rounded text-brand-primary w-4 h-4" />
                <span className="ml-2 text-xs sm:text-sm text-gray-600">Remember me</span>
              </label>
              <Link href="/customer/forgot-password" className="text-xs sm:text-sm text-brand-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>

          {/* Register Link */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <p className="text-gray-600 text-xs sm:text-sm">
              Don't have an account?{' '}
              <Link href="/customer/register" className="text-brand-primary font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="mt-4 sm:mt-5 md:mt-6 text-center text-xs sm:text-sm text-gray-600">
          <p>🔒 Secure login with encryption</p>
        </div>
      </div>
    </div>
  );
}

