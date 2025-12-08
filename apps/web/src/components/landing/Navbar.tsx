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
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="MyFNG Logo" className="h-10 w-auto" />
            
            {/* City Name Display */}
            {isDetecting ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Detecting...</span>
              </div>
            ) : cityName ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={handleCityClick}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer group"
                >
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700">{cityName}</span>
                  <ChevronDown className={`w-4 h-4 text-blue-600 transition-transform ${showCityDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* City Dropdown */}
                {showCityDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search city..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          autoFocus
                        />
                      </div>
                    </div>
                    
                    <div className="max-h-64 overflow-y-auto">
                      {loadingCities ? (
                        <div className="p-8 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">Loading cities...</p>
                        </div>
                      ) : filteredCities.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">No cities found</p>
                        </div>
                      ) : (
                        <div className="py-2">
                          {filteredCities.map((city) => (
                            <button
                              key={city.id}
                              onClick={() => handleCitySelect(city)}
                              className={`w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors ${
                                cityName === city.name ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold text-gray-900">{city.name}</p>
                                  {city.state && (
                                    <p className="text-xs text-gray-500 mt-0.5">{city.state}</p>
                                  )}
                                </div>
                                {cityName === city.name && (
                                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setShowCityDropdown(false);
                          detectLocation();
                        }}
                        className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-4 h-4" />
                        Detect My Location Again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link href="/services" className="text-text-body hover:text-brand-primary transition font-medium">Services</Link>
            <Link href="/roadside-assistance" className="text-text-body hover:text-brand-primary transition font-medium">Roadside Assistance</Link>
            <Link href="/ai-experience" className="text-text-body hover:text-brand-primary transition font-medium">AI Experience</Link>
            <Link href="/contact" className="text-text-body hover:text-brand-primary transition font-medium">Contact</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden md:inline-flex items-center text-brand-primary font-semibold hover:text-brand-secondary transition">
              Partner Login
            </Link>
            <Link href="/customer/login" className="btn btn-primary">
              Customer Login
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

