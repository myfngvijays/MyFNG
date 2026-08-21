'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Get user profile with role information
      const { data: userProfile, error: profileError } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles(role_code, role_name),
          workshop:workshops(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw profileError;

      if (!userProfile.is_active) {
        throw new Error('Your account is inactive. Please contact support.');
      }

      const { getLoginGeoHint, postRecordLogin } = await import('@/lib/auth/postRecordLogin');
      const geo = await getLoginGeoHint(3500);
      await postRecordLogin({
        platform: 'web',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        accessToken: authData.session?.access_token || null,
        latitude: geo.latitude,
        longitude: geo.longitude,
        location_label: geo.location_label,
        city: geo.city,
      });

      // Redirect based on role
      const roleCode = userProfile.role.role_code;
      const {
        ensureTelecallerPunchInOnLogin,
        isTelecallerFloorRole,
      } = await import('@/lib/telecaller/ensurePunchInOnLogin');
      if (isTelecallerFloorRole(roleCode)) {
        await ensureTelecallerPunchInOnLogin();
      }
      router.push(`/dashboard/${roleCode.toLowerCase()}`);
      
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell flex min-h-[100dvh] w-full items-center justify-center bg-gradient-to-br from-brand-my/10 via-white to-brand-fng/10 px-4">
      <div className="mx-auto w-full max-w-md min-w-0">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-7 md:mb-8">
          <Link href="/" className="inline-block mb-3 sm:mb-4">
            <img src="/logo.png" alt="MyFNG Logo" className="h-14 sm:h-16 md:h-20 w-auto max-w-[220px] mx-auto object-contain" />
          </Link>
          <p className="text-text-body text-sm sm:text-base">Login to your account</p>
        </div>

        {/* Login Card */}
        <div className="card p-4 sm:p-5 md:p-6">
          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5 md:space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 sm:p-4 rounded-lg text-xs sm:text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label text-xs sm:text-sm">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9 sm:pl-11 text-xs sm:text-sm"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label text-xs sm:text-sm">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9 sm:pl-11 pr-9 sm:pr-11 text-xs sm:text-sm"
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full text-xs sm:text-sm px-4 sm:px-6 py-2.5 sm:py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </button>
          </form>

          <div className="mt-4 sm:mt-5 md:mt-6 text-center">
            <a href="#" className="text-xs sm:text-sm text-brand-primary hover:underline">
              Forgot password?
            </a>
          </div>
        </div>

        <div className="mt-4 sm:mt-5 md:mt-6 text-center">
          <Link href="/" className="text-text-body text-xs sm:text-sm hover:text-brand-primary">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
