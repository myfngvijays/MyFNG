'use client';

import { useState, useEffect, useRef } from 'react';
import TrackedLink from '@/components/tracking/TrackedLink';
import { usePathname } from 'next/navigation';
import { MapPin, Loader2, ChevronDown, Search, Menu, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import { buildGoAppDownloadHref } from '@/lib/utm';

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function getEndOfDay() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end;
    }

    function update() {
      const diff = Math.max(0, Math.floor((getEndOfDay().getTime() - Date.now()) / 1000));
      setTimeLeft({
        hours: Math.floor(diff / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      });
    }

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return timeLeft;
}

function AppDownloadBanner({
  onClose,
  downloadHref = '/go/myfngapp',
  roomy = false,
}: {
  onClose: () => void;
  downloadHref?: string;
  roomy?: boolean;
}) {
  const { hours, minutes, seconds } = useCountdown();
  const pad = (n: number) => String(n).padStart(2, '0');

  const timerDigits = (compact = false) => (
    <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
      <span
        className={`inline-flex items-center justify-center rounded bg-white/25 font-bold tabular-nums ${
          compact
            ? 'min-w-[1.25rem] h-5 px-0.5 text-[10px]'
            : 'min-w-[1.5rem] h-6 px-1 text-xs sm:text-sm'
        }`}
      >
        {pad(hours)}
      </span>
      <span className={compact ? 'text-[10px] font-bold' : 'text-xs font-bold'}>:</span>
      <span
        className={`inline-flex items-center justify-center rounded bg-white/25 font-bold tabular-nums ${
          compact
            ? 'min-w-[1.25rem] h-5 px-0.5 text-[10px]'
            : 'min-w-[1.5rem] h-6 px-1 text-xs sm:text-sm'
        }`}
      >
        {pad(minutes)}
      </span>
      <span className={compact ? 'text-[10px] font-bold' : 'text-xs font-bold'}>:</span>
      <span
        className={`inline-flex items-center justify-center rounded bg-white/25 font-bold tabular-nums ${
          compact
            ? 'min-w-[1.25rem] h-5 px-0.5 text-[10px]'
            : 'min-w-[1.5rem] h-6 px-1 text-xs sm:text-sm'
        }`}
      >
        {pad(seconds)}
      </span>
    </div>
  );

  const storeButtons = (compact = false) => (
    <div className={`flex items-center ${compact ? 'gap-1' : 'gap-2'}`}>
      <a
        href={downloadHref}
        className={`inline-flex items-center justify-center bg-white text-blue-700 hover:bg-blue-50 rounded-md font-bold transition-all shadow-sm whitespace-nowrap ${
          roomy
            ? compact
              ? 'gap-1.5 px-3 py-1.5 h-8 text-[11px]'
              : 'gap-2 px-5 py-2 h-10 text-sm'
            : compact
              ? 'gap-1 px-2.5 py-1 h-7 text-[9px]'
              : 'gap-1.5 px-4 py-1.5 h-8 text-xs sm:text-sm'
        }`}
      >
        Download App
      </a>
    </div>
  );

  return (
    <div className="text-white relative">
      {/* Mobile only: compact red strip with offer + timer */}
      <div className="lg:hidden bg-red-600">
        <div className="container mx-auto px-3 py-1 pr-8 flex items-center justify-center gap-2">
          <span className="text-[10px] font-bold text-yellow-100 whitespace-nowrap">
            Limited-Time Launch Offer →
          </span>
          {timerDigits(true)}
        </div>
      </div>

      {/* Blue download strip */}
      <div className={`bg-gradient-to-r from-blue-600 via-blue-700 to-purple-700 ${roomy ? 'py-0.5' : ''}`}>
        <div className={`container mx-auto px-3 lg:px-6 pr-8 lg:pr-10 flex items-center gap-2 lg:gap-4 lg:justify-center ${roomy ? 'py-2.5 lg:py-3' : 'py-1.5 lg:py-2'}`}>
          <p className="text-[11px] lg:text-sm font-bold leading-snug min-w-0 flex-1 break-words lg:flex-none lg:whitespace-nowrap">
            Download MyFNG App &amp;
            <br className="lg:hidden" />
            <span className="hidden lg:inline"> </span>
            Get 10% OFF
          </p>

          {/* Desktop only: offer + timer inside blue banner */}
          <div className="hidden lg:flex items-center gap-3 flex-shrink-0">
            <span className="text-sm font-bold text-yellow-200 whitespace-nowrap">
              Limited-Time Launch Offer →
            </span>
            {timerDigits(false)}
          </div>

          <div className="flex-shrink-0 lg:flex-shrink-0">
            <div className="lg:hidden">{storeButtons(true)}</div>
            <div className="hidden lg:block">{storeButtons(false)}</div>
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute right-1.5 lg:right-3 top-1 lg:top-1.5 p-0.5 rounded-full hover:bg-white/20 transition-all z-10"
        aria-label="Close banner"
      >
        <X className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      </button>
    </div>
  );
}

export default function Navbar({
  hideAppBanner = false,
}: {
  /** Pricing share etc.: only logo + hamburger, no promo banners */
  hideAppBanner?: boolean;
} = {}) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const isAdsLanding = pathname === '/car-service-and-repairs';
  const [appGoHref, setAppGoHref] = useState('/go/myfngapp');
  const [showAppBanner, setShowAppBanner] = useState(!hideAppBanner);
  const [cityName, setCityName] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAdsLanding) setAppGoHref(buildGoAppDownloadHref('ads-lp-nav'));
  }, [isAdsLanding]);

  useEffect(() => {
    // Check if location is already stored in localStorage
    const storedCity = localStorage.getItem('detected_city');
    const storedTimestamp = localStorage.getItem('detected_city_timestamp');
    
    // Use stored city if it's less than 1 hour old
    if (storedCity && storedTimestamp) {
      const timestamp = parseInt(storedTimestamp);
      const oneHour = 60 * 60 * 1000;
      if (Date.now() - timestamp < oneHour) {
        setCityName(storedCity);
        setIsDetecting(false);
        return;
      }
    }

    // Detect location
    detectLocation();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false);
      }
      if (hamburgerRef.current && !hamburgerRef.current.contains(event.target as Node)) {
        setShowHamburgerMenu(false);
      }
    };

    if (showCityDropdown || showHamburgerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCityDropdown, showHamburgerMenu]);

  const fetchCities = async () => {
    if (cities.length > 0) return; // Already fetched
    
    setLoadingCities(true);
    try {
      const supabase = createClient();
      
      const { data: citiesData, error } = await supabase
        .from('cities')
        .select('id, name, state')
        .eq('is_active', true)
        .order('name');
      
      if (error) {
        console.error('Error fetching cities:', error);
        // Fallback cities
        setCities([
          { id: '1', name: 'Mumbai', state: 'Maharashtra' },
          { id: '2', name: 'Delhi', state: 'Delhi' },
          { id: '3', name: 'Bangalore', state: 'Karnataka' },
          { id: '4', name: 'Hyderabad', state: 'Telangana' },
          { id: '5', name: 'Chennai', state: 'Tamil Nadu' },
          { id: '6', name: 'Pune', state: 'Maharashtra' },
          { id: '7', name: 'Kolkata', state: 'West Bengal' },
          { id: '8', name: 'Ahmedabad', state: 'Gujarat' },
        ]);
      } else {
        setCities(citiesData || []);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setLoadingCities(false);
    }
  };

  const handleCityClick = () => {
    if (!showCityDropdown) {
      fetchCities();
    }
    setShowCityDropdown(!showCityDropdown);
  };

  const handleCitySelect = (city: any) => {
    setCityName(city.name);
    localStorage.setItem('detected_city', city.name);
    localStorage.setItem('detected_city_timestamp', Date.now().toString());
    setShowCityDropdown(false);
    setSearchQuery('');
  };

  const filteredCities = cities.filter(city =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (city.state && city.state.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const detectLocation = async () => {
    try {
      setIsDetecting(true);
      
      if (!('geolocation' in navigator)) {
        console.warn('Geolocation not supported');
        setIsDetecting(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          try {
            // Reverse geocode to get city name
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
            );
            
            if (!response.ok) {
              throw new Error('Geocoding failed');
            }
            
            const data = await response.json();
            const address = data.address || {};
            
            // Try to get city name from various fields
            const city = 
              address.city || 
              address.town || 
              address.village || 
              address.county || 
              address.state_district || 
              address.municipality ||
              address.suburb ||
              null;
            
            if (city) {
              setCityName(city);
              // Store in localStorage for future use
              localStorage.setItem('detected_city', city);
              localStorage.setItem('detected_city_timestamp', Date.now().toString());
            } else {
              // Fallback to state if city not found
              const state = address.state || null;
              if (state) {
                setCityName(state);
                localStorage.setItem('detected_city', state);
                localStorage.setItem('detected_city_timestamp', Date.now().toString());
              }
            }
          } catch {
            // Reverse geocode failed — keep previous / empty city silently
          } finally {
            setIsDetecting(false);
          }
        },
        (error) => {
          // Permission denied / timeout / unavailable is normal; do not console.error
          // (Next.js overlays treat console.error as a runtime error).
          if (process.env.NODE_ENV === 'development') {
            const code = typeof error?.code === 'number' ? error.code : null;
            const msg =
              code === 1
                ? 'permission_denied'
                : code === 2
                  ? 'position_unavailable'
                  : code === 3
                    ? 'timeout'
                    : 'unknown';
            console.debug(`[Navbar] geolocation skipped (${msg})`);
          }
          setIsDetecting(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } catch {
      setIsDetecting(false);
    }
  };

  const NAV_LINKS = (
    <>
      <TrackedLink href="/" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">Home</TrackedLink>
      <TrackedLink href="/car-services" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">All Services</TrackedLink>
      {DEFAULT_SERVICES.map((s) => (
        <TrackedLink key={s.slug} href={`/car-services/${INTERNAL_SLUG_TO_MARKETING[s.slug] ?? s.slug}`} onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg pl-7">↳ {s.title}</TrackedLink>
      ))}
      <TrackedLink href="/about-us" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">About Us</TrackedLink>
      <TrackedLink href="/car-roadside-assistance" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">Roadside Assistance</TrackedLink>
      <TrackedLink href="/blogs" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">Blog</TrackedLink>
      <TrackedLink href="/contact-us" onClick={() => setShowHamburgerMenu(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition rounded-lg">Contact</TrackedLink>
    </>
  );

  return (
    <header className="fixed top-0 w-full z-50">
      {showAppBanner && !hideAppBanner && (
        <AppDownloadBanner
          onClose={() => setShowAppBanner(false)}
          downloadHref={isAdsLanding ? appGoHref : '/go/myfngapp'}
          roomy={isAdsLanding}
        />
      )}
      <div className="bg-white/95 backdrop-blur-sm shadow-sm">
      <nav className="container mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 relative">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {/* Mobile hamburger (left side, only on small screens) */}
            <div className="lg:hidden relative flex-shrink-0 w-9 sm:w-10" ref={hamburgerRef}>
              <button
                onClick={() => setShowHamburgerMenu((v) => !v)}
                className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-gray-700"
                aria-label="Open navigation menu"
              >
                {showHamburgerMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {showHamburgerMenu && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 max-h-[80vh] overflow-y-auto">
                  {NAV_LINKS}
                  <div className="px-4 pt-3 pb-1 border-t border-gray-100 mt-1">
                    <TrackedLink
                      href="/book-service"
                      onClick={() => setShowHamburgerMenu(false)}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all"
                    >
                      📅 Book Your Service Now
                    </TrackedLink>
                  </div>
                </div>
              )}
            </div>

            <TrackedLink href="/" className="hidden lg:flex items-center min-w-0 flex-shrink-0">
              <img src="/logo.png" alt="MyFNG Logo" className="h-10 sm:h-12 md:h-14 w-auto flex-shrink-0" />
            </TrackedLink>
          </div>

          {/* Mobile logo (right on other pages, centered on home — see absolute logo below) */}
          {!isHomePage && (
            <TrackedLink href="/" className="lg:hidden flex items-center min-w-0 flex-shrink-0">
              <img src="/logo.png" alt="MyFNG Logo" className="h-10 sm:h-12 w-auto flex-shrink-0" />
            </TrackedLink>
          )}

          {/* Desktop nav (visible on lg+) */}
          <div className="hidden lg:flex items-center gap-4 md:gap-6 lg:gap-8 flex-shrink-0">
            <TrackedLink href="/" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Home</TrackedLink>
            <div className="relative group">
              <TrackedLink
                href="/car-services"
                className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap inline-flex items-center gap-1"
              >
                Services
                <ChevronDown className="w-4 h-4 text-text-body group-hover:text-brand-primary transition" />
              </TrackedLink>
              <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <div className="py-2">
                  {DEFAULT_SERVICES.map((s) => (
                    <TrackedLink key={s.slug} href={`/car-services/${INTERNAL_SLUG_TO_MARKETING[s.slug] ?? s.slug}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition">{s.title}</TrackedLink>
                  ))}
                </div>
              </div>
            </div>
            <TrackedLink href="/about-us" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">About Us</TrackedLink>
            <TrackedLink href="/car-roadside-assistance" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Roadside Assistance</TrackedLink>
            <TrackedLink href="/blogs" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Blog</TrackedLink>
            <TrackedLink href="/contact-us" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Contact</TrackedLink>
          </div>

          <div className={`items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0 ${isHomePage ? 'flex' : 'hidden lg:flex'}`}>
            {isDetecting ? (
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-50 rounded-full border border-blue-200 text-xs sm:text-sm text-gray-500">
                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                <span className="hidden sm:inline">Detecting...</span>
              </div>
            ) : cityName ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={handleCityClick}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-50 rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-blue-700 truncate max-w-[100px] sm:max-w-none">{cityName}</span>
                  <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-blue-600 transition-transform flex-shrink-0 ${showCityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCityDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3 sm:p-4 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        <input
                          id="city-search"
                          name="city-search"
                          type="text"
                          placeholder="Search city..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                      </div>
                    </div>
                    
                    <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                      {loadingCities ? (
                        <div className="p-6 sm:p-8 text-center">
                          <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-xs sm:text-sm text-gray-500">Loading cities...</p>
                        </div>
                      ) : filteredCities.length === 0 ? (
                        <div className="p-6 sm:p-8 text-center">
                          <p className="text-xs sm:text-sm text-gray-500">No cities found</p>
                        </div>
                      ) : (
                        <div className="py-1 sm:py-2">
                          {filteredCities.map((city) => (
                            <button
                              key={city.id}
                              onClick={() => handleCitySelect(city)}
                              className={`w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-blue-50 transition-colors ${
                                cityName === city.name ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">{city.name}</p>
                                  {city.state && (
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{city.state}</p>
                                  )}
                                </div>
                                {cityName === city.name && (
                                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-2 sm:p-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setShowCityDropdown(false);
                          detectLocation();
                        }}
                        className="w-full text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1.5 sm:gap-2"
                      >
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                        Detect My Location Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Mobile home: logo centered between hamburger and location */}
        {isHomePage && (
          <TrackedLink
            href="/"
            className="lg:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-auto"
          >
            <img src="/logo.png" alt="MyFNG Logo" className="h-10 sm:h-12 w-auto flex-shrink-0" />
          </TrackedLink>
        )}
      </nav>
      </div>
    </header>
  );
}

