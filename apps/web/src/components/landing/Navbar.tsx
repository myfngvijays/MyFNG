'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Loader2, ChevronDown, X, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const [cityName, setCityName] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [cities, setCities] = useState<any[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCityDropdown(false);
      }
    };

    if (showCityDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCityDropdown]);

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
          } catch (error) {
            console.error('Error reverse geocoding:', error);
          } finally {
            setIsDetecting(false);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsDetecting(false);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } catch (error) {
      console.error('Location detection error:', error);
      setIsDetecting(false);
    }
  };

  return (
    <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm shadow-sm z-50">
      <nav className="container mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0 flex-shrink-0">
            <img src="/logo.png" alt="MyFNG Logo" className="h-7 sm:h-8 md:h-10 w-auto flex-shrink-0" />
            
            {/* City Name Display */}
            {isDetecting ? (
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
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

                {/* City Dropdown */}
                {showCityDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-3 sm:p-4 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        <input
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
          </Link>
          
          <div className="hidden lg:flex items-center gap-4 md:gap-6 lg:gap-8 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Link
                href="/services"
                className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap"
              >
                Services
              </Link>
            </div>
            <Link href="/blog" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Blog</Link>
            <Link href="/roadside-assistance" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Roadside Assistance</Link>
            <Link href="/ai-experience" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">AI Experience</Link>
            <Link href="/contact" className="text-sm md:text-base text-text-body hover:text-brand-primary transition font-medium whitespace-nowrap">Contact</Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
            <Link href="/login" className="hidden lg:inline-flex items-center text-xs sm:text-sm md:text-base text-brand-primary font-semibold hover:text-brand-secondary transition whitespace-nowrap">
              Partner Login
            </Link>
            <Link href="/customer/login" className="btn btn-primary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap">
              <span className="hidden sm:inline">Customer Login</span>
              <span className="sm:hidden">Login</span>
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

