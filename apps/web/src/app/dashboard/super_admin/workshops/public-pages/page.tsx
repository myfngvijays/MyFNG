'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { Globe, Search, Plus, Edit2, Eye, ExternalLink, Image as ImageIcon, CheckCircle, XCircle, Star, Upload, X, MapPin, RefreshCw, PlugZap, BarChart3, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GmbData } from '@/components/workshop/types';

type GbpLocationOption = {
  resource_name: string;
  title: string;
  address: string;
  place_id: string;
  maps_uri: string;
  website_uri: string;
  phone_number: string;
  regular_hours?: { open_day: string; open_time: string; close_time: string }[];
  description?: string;
  primary_category?: string;
  latlng?: { lat: number; lng: number } | null;
  open_status?: string;
};

export default function WorkshopPublicPagesPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [pages, setPages] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    workshop_id: '',
    slug: '',
    profile_image: '',
    cover_image: '',
    short_description: '',
    full_description: '',
    services_offered: [] as string[],
    business_hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: ''
    },
    whatsapp_number: '',
    alternate_phone: '',
    website_url: '',
    facebook_url: '',
    instagram_url: '',
    youtube_url: '',
    google_maps_url: '',
    map_embed_url: '',
    gallery_images: [] as string[],
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    brands: [] as { name: string; logo_url: string }[],
    packages: [] as { name: string; price: string | null; features: string[] }[],
    faqs: [] as { question: string; answer: string }[],
    is_published: false,
    is_featured: false
  });
  const [serviceInput, setServiceInput] = useState('');
  const [galleryInput, setGalleryInput] = useState('');
  const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
  const [brandName, setBrandName] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [packageName, setPackageName] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [packageFeature, setPackageFeature] = useState('');
  const [packageFeatures, setPackageFeatures] = useState<string[]>([]);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [fetchingGmb, setFetchingGmb] = useState(false);
  const [gmbPreview, setGmbPreview] = useState<GmbData | null>(null);
  const [gbpConnected, setGbpConnected] = useState(false);
  const [checkingGbp, setCheckingGbp] = useState(false);
  const [gbpLocations, setGbpLocations] = useState<GbpLocationOption[]>([]);
  const [loadingGbpLocations, setLoadingGbpLocations] = useState(false);
  const [selectedGbpLocation, setSelectedGbpLocation] = useState('');
  const [syncingAll, setSyncingAll] = useState(false);
  const initializedRef = useRef(false);
  const [showCompanyStats, setShowCompanyStats] = useState(false);
  const [companyStats, setCompanyStats] = useState({
    cars_serviced: '1 Million+',
    happy_customers: '25 Lacs+',
    avg_rating: '4.8',
    touch_points: '1000+',
    verified_workshops: '100+',
    cities_covered: '6+',
    about_description: "Mumbai & Pune's Trusted Multi-Brand Car Service Network — 100+ verified workshops, AI-powered booking, and transparent service for every car owner.",
    who_we_are_1: 'MyFNG (My Friendly Neighbourhood Garage) is a network of 100+ A-Grade multi-brand car servicing workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune.',
    who_we_are_2: 'We connect car owners with professional technicians, advanced diagnostic tools, and transparent pricing — so you never overpay or worry about your car\'s health again.',
  });
  const [savingStats, setSavingStats] = useState(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchPages();
    fetchWorkshops();
    fetchGoogleBusinessStatus();
    checkGoogleBusinessConnectToast();
    fetchCompanyStats();
  }, []);

  const fetchCompanyStats = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'company_stats')
        .maybeSingle();
      if (data?.setting_value) {
        try {
          const parsed = JSON.parse(data.setting_value);
          setCompanyStats((prev) => ({ ...prev, ...parsed }));
        } catch {}
      }
    } catch {}
  };

  const saveCompanyStats = async () => {
    setSavingStats(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: JSON.stringify(companyStats) })
        .eq('setting_key', 'company_stats');
      if (error) throw error;
      toast.success('Company stats updated!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save stats');
    } finally {
      setSavingStats(false);
    }
  };

  const fetchGoogleBusinessStatus = async () => {
    try {
      setCheckingGbp(true);
      const res = await fetch('/api/integrations/google-business/status', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const connected = Boolean(json?.connected);
        setGbpConnected(connected);
        if (connected) fetchGoogleBusinessLocations();
      }
    } catch {
      // ignore non-critical status failures
    } finally {
      setCheckingGbp(false);
    }
  };

  const fetchGoogleBusinessLocations = async () => {
    if (loadingGbpLocations) return;
    try {
      setLoadingGbpLocations(true);
      const res = await fetch('/api/integrations/google-business/locations?refresh=1', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Failed to load GBP locations:', json);
        const detailMsg = String(json?.details || json?.error || 'Failed to load Google Business locations');
        toast.error(detailMsg.length > 140 ? `${detailMsg.slice(0, 140)}...` : detailMsg);
        setGbpLocations([]);
        return;
      }
      const rawLocations = Array.isArray(json?.locations) ? json.locations : [];
      const seenLocationKeys = new Set<string>();
      const uniqueLocations = rawLocations.filter((loc: GbpLocationOption, index: number) => {
        const dedupeKey = loc?.resource_name || loc?.place_id || `idx-${index}`;
        if (seenLocationKeys.has(dedupeKey)) return false;
        seenLocationKeys.add(dedupeKey);
        return true;
      });
      setGbpLocations(uniqueLocations);
      // Auto-select the only location so GBP path is always used when possible
      if (uniqueLocations.length === 1 && uniqueLocations[0]?.resource_name) {
        setSelectedGbpLocation(uniqueLocations[0].resource_name);
      }
    } catch (e) {
      console.error('Failed to load GBP locations:', e);
      setGbpLocations([]);
    } finally {
      setLoadingGbpLocations(false);
    }
  };

  const checkGoogleBusinessConnectToast = () => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get('gmb_connect');
    if (!status) return;
    const msg = url.searchParams.get('msg') || '';
    if (status === 'success') {
      toast.success('Google Business connected successfully');
      setGbpConnected(true);
      fetchGoogleBusinessLocations();
    } else {
      toast.error(`Google connect failed${msg ? `: ${msg}` : ''}`);
    }
    url.searchParams.delete('gmb_connect');
    url.searchParams.delete('msg');
    window.history.replaceState({}, '', url.toString());
  };

  const handleConnectGoogleBusiness = () => {
    const returnTo = '/dashboard/super_admin/workshops/public-pages';
    window.location.href = `/api/integrations/google-business/connect?return_to=${encodeURIComponent(returnTo)}`;
  };

  const handleSyncAll = async () => {
    if (syncingAll) return;
    setSyncingAll(true);
    try {
      const res = await fetch('/api/workshops/gmb/sync', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || 'Sync failed');
        return;
      }
      toast.success(`Sync complete: ${json.synced} updated${json.failed ? `, ${json.failed} failed` : ''}`);
      fetchPages();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncingAll(false);
    }
  };

  const fetchPages = async () => {
    try {
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select(`
          *,
          workshop:workshops(id, name, city, state)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPages(data || []);
    } catch (error: any) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to fetch public pages');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, address, city, state, pincode, phone, email, public_gmb_url, audit_score')
        .eq('is_verified', true)
        .order('name');

      if (error) throw error;
      setWorkshops(data || []);
    } catch (error: any) {
      console.error('Error fetching workshops:', error);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const defaultServices = [
    'AC Service', 'Battery Service', 'Brake Service', 'Clutch Service',
    'Tyre & Wheel Care', 'Denting & Painting', 'Car Detailing', 'Engine Repair',
    'Suspension Service', 'Roadside Assistance', 'Car Garage', 'Multibrand Workshop', 'Car Service Center'
  ];

  const defaultBrands = [
    { name: 'Maruti Suzuki', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Maruti_Suzuki_Logo.svg/200px-Maruti_Suzuki_Logo.svg.png' },
    { name: 'Hyundai', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/200px-Hyundai_Motor_Company_logo.svg.png' },
    { name: 'Tata Motors', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Tata_logo.svg/200px-Tata_logo.svg.png' },
    { name: 'Honda', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Honda_logo2.svg/200px-Honda_logo2.svg.png' },
    { name: 'Toyota', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/200px-Toyota.svg.png' },
    { name: 'Mahindra', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Mahindra_%26_Mahindra_Logo.svg/200px-Mahindra_%26_Mahindra_Logo.svg.png' },
    { name: 'Kia', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Kia-logo.png/200px-Kia-logo.png' },
    { name: 'MG Motor', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/MG_Motor_new_logo.png/200px-MG_Motor_new_logo.png' },
    { name: 'Volkswagen', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/200px-Volkswagen_logo_2019.svg.png' },
    { name: 'Skoda', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/%C5%A0koda_Auto_2016.svg/200px-%C5%A0koda_Auto_2016.svg.png' },
    { name: 'Ford', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Ford_Motor_Company_Logo.svg/200px-Ford_Motor_Company_Logo.svg.png' },
    { name: 'Renault', logo_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Renault_2021_Text.svg/200px-Renault_2021_Text.svg.png' },
  ];

  const defaultPackages = [
    { name: 'Basic Service', price: '₹2,999', features: ['Engine Oil Replacement', 'Oil Filter Replacement', 'Air Filter Cleaning', 'Spark Plugs Servicing', 'Interior Vacuuming & Body Wash'] },
    { name: 'General Service', price: '₹5,000', features: ['Everything in Basic +', 'Brake Pads & Fluid Check', 'Battery Terminal Cleaning', 'AC Performance Check', 'Test Drive & Final Inspection'] },
    { name: 'Premium Service', price: '₹6,800', features: ['Everything in General +', 'All Brake Cleaning & Lubrication', 'AC Disinfectant Spray', 'Tyre Rotation & Torque', 'Diagnostics Scan & Report'] },
    { name: 'Platinum Service', price: '₹11,300', features: ['Everything in Premium +', 'Engine Compression Test', 'Throttle Body & EGR Cleaning', 'Interior Deep Cleaning', 'Paint Protection & Underbody Coating'] },
  ];

  const defaultFaqsData = [
    { question: 'What is My FNG – Car Garage & Repairs?', answer: 'My FNG (Friendly Neighbourhood Garage) is a trusted network of 100+ A-Grade multi-brand car servicing and repair workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune.' },
    { question: 'What brands of cars do you service?', answer: 'We service all major car brands and models, including hatchbacks, sedans, SUVs, and premium cars. Our technicians are trained to work on both petrol and diesel cars.' },
    { question: 'How can I find a My FNG car service center near me?', answer: 'You can locate the nearest My FNG car service center by visiting www.myfng.in. You may also contact our customer support team for location details and booking assistance.' },
    { question: 'What car services are offered?', answer: 'We provide a full range of car services including basic & general car service, periodic maintenance, oil changes, brake inspection & repairs, engine diagnostics & repairs, tyre services, car AC service & gas refill, battery replacement, suspension & steering work, and mechanical & electrical repairs.' },
    { question: 'How can I book a car service appointment?', answer: 'You can book an AI-enabled car service appointment online via www.myfng.in or by calling our customer support team. We offer flexible appointment scheduling.' },
    { question: 'Are the technicians certified?', answer: 'Yes. All technicians at My FNG are trained, experienced, and certified. They regularly undergo skill upgrades and use advanced diagnostic tools.' },
    { question: 'Do you use genuine parts for car repairs and servicing?', answer: 'Yes. My FNG uses only genuine and high-quality car parts for all repairs to ensure safety, performance, and long-term reliability.' },
    { question: 'Is there a warranty on services provided?', answer: 'Yes. My FNG offers service and parts warranty. Warranty terms vary based on service performed. Visit www.myfng.in or contact support for details.' },
    { question: 'How do I know if my car needs servicing?', answer: 'Look for dashboard warning lights, unusual engine or brake noises, reduced fuel efficiency, poor driving performance, or delayed braking response. A basic car service is recommended every 5,000 km or 6 months.' },
    { question: 'How can I contact My FNG for more questions?', answer: 'Visit www.myfng.in or call our customer support team. We are always ready to assist you.' },
  ];

  const handleWorkshopChange = (workshopId: string) => {
    const workshop = workshops.find(w => w.id === workshopId);
    if (workshop) {
      const isNewPage = !editingPage;
      const cityName = workshop.city || '';
      const workshopName = workshop.name || '';
      const defaultDesc = `Welcome to ${workshopName}, your trusted automotive service partner in ${cityName}! We specialize in providing high-quality car maintenance and repair services to keep your vehicle running smoothly.

With years of experience and a team of skilled technicians, we offer:
- Complete diagnostic services
- Engine repair and maintenance
- AC service and repair
- Brake and clutch services
- Battery replacement and charging
- Tyre services
- Car detailing and washing
- Paint and denting work

Our workshop is equipped with modern tools and genuine parts to ensure the best service for your vehicle. Customer satisfaction is our top priority, and we guarantee quality workmanship at competitive prices.

Visit us today and experience the difference!`;
      const defaultShortDesc = `Premier auto service center in ${cityName} offering comprehensive car maintenance, repair, and detailing services with expert technicians.`;
      const defaultMetaTitle = `${workshopName} ${cityName} - Best Car Service Center | MyFNG`;
      const defaultMetaDesc = `${workshopName} in ${cityName} offers expert car servicing, AC repair, battery replacement, brake service, and more. Trusted auto service center with skilled technicians. Book now!`;

      setFormData(prev => ({
        ...prev,
        workshop_id: workshopId,
        slug: isNewPage ? generateSlug(`${workshopName}-${cityName}`) : prev.slug,
        google_maps_url: workshop.public_gmb_url || prev.google_maps_url,
        whatsapp_number: isNewPage ? '9167779696' : prev.whatsapp_number,
        alternate_phone: isNewPage ? '9672132022' : prev.alternate_phone,
        website_url: isNewPage ? 'https://www.myfng.in' : prev.website_url,
        facebook_url: isNewPage ? 'https://www.facebook.com/myfngcarservices' : prev.facebook_url,
        instagram_url: isNewPage ? 'https://www.instagram.com/myfngcarservices' : prev.instagram_url,
        youtube_url: isNewPage ? 'https://www.youtube.com/@myfng_car_servicing' : prev.youtube_url,
        short_description: isNewPage ? defaultShortDesc : prev.short_description,
        full_description: isNewPage ? defaultDesc : prev.full_description,
        services_offered: isNewPage ? defaultServices : prev.services_offered,
        brands: isNewPage ? defaultBrands : prev.brands,
        packages: isNewPage ? defaultPackages : prev.packages,
        faqs: isNewPage ? defaultFaqsData : prev.faqs,
        meta_title: isNewPage ? defaultMetaTitle : prev.meta_title,
        meta_description: isNewPage ? defaultMetaDesc : prev.meta_description,
        meta_keywords: isNewPage ? [`car service ${cityName.toLowerCase()}`, `auto workshop ${cityName.toLowerCase()}`, `car repair ${cityName.toLowerCase()}`, workshopName.toLowerCase()] : prev.meta_keywords,
        business_hours: isNewPage ? {
          monday: '24 Hours',
          tuesday: '24 Hours',
          wednesday: '24 Hours',
          thursday: '24 Hours',
          friday: '24 Hours',
          saturday: '24 Hours',
          sunday: '24 Hours',
        } : prev.business_hours,
      }));
      setGmbPreview(null);
      setSelectedGbpLocation('');
      if (gbpConnected && gbpLocations.length === 0) fetchGoogleBusinessLocations();

      if (isNewPage) {
        toast.success(`Auto-filled defaults for ${workshopName}. You can edit everything below.`);
      }
    }
  };

  // Core GMB fetch logic — called either by location select or manual button
  const doFetchGmb = async (overrideLocationName?: string, overrideWorkshopId?: string) => {
    const workshopId = overrideWorkshopId || formData.workshop_id;
    const locationName = overrideLocationName || selectedGbpLocation || undefined;
    const mapsUrl = formData.google_maps_url;

    if (!locationName && !mapsUrl.trim()) {
      toast.error('Please select a Google Business location or enter a Google Maps URL');
      return;
    }

    setFetchingGmb(true);
    setGmbPreview(null);
    try {
      const selectedWorkshop = workshops.find((w) => w.id === workshopId);
      const effectiveGbpLoc =
        gbpLocations.find((l) => l.resource_name === locationName) ||
        (gbpConnected && gbpLocations.length > 0 ? gbpLocations[0] : undefined);

      // Build prefetched details from listing data to skip the single-location GET (which returns 404)
      const prefetchedLocation = effectiveGbpLoc
        ? {
            title: effectiveGbpLoc.title,
            storefrontAddress: effectiveGbpLoc.address
              ? { addressLines: [effectiveGbpLoc.address] }
              : undefined,
            phoneNumbers: effectiveGbpLoc.phone_number
              ? { primaryPhone: effectiveGbpLoc.phone_number }
              : undefined,
            websiteUri: effectiveGbpLoc.website_uri || undefined,
            metadata: {
              placeId: effectiveGbpLoc.place_id || undefined,
              mapsUri: effectiveGbpLoc.maps_uri || undefined,
            },
            regularHours: effectiveGbpLoc.regular_hours?.length
              ? {
                  periods: effectiveGbpLoc.regular_hours.map((p) => ({
                    openDay: p.open_day,
                    openTime: {
                      hours: parseInt(p.open_time.split(':')[0], 10),
                      minutes: parseInt(p.open_time.split(':')[1], 10),
                    },
                    closeTime: {
                      hours: parseInt(p.close_time.split(':')[0], 10),
                      minutes: parseInt(p.close_time.split(':')[1], 10),
                    },
                  })),
                }
              : undefined,
            // Rich fields from listing (if available)
            profile: effectiveGbpLoc.description ? { description: effectiveGbpLoc.description } : undefined,
            categories: effectiveGbpLoc.primary_category
              ? { primaryCategory: { displayName: effectiveGbpLoc.primary_category } }
              : undefined,
            latlng: effectiveGbpLoc.latlng
              ? { latitude: effectiveGbpLoc.latlng.lat, longitude: effectiveGbpLoc.latlng.lng }
              : undefined,
            openInfo: effectiveGbpLoc.open_status ? { status: effectiveGbpLoc.open_status } : undefined,
          }
        : undefined;

      const res = await fetch('/api/workshops/gmb/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_maps_url: mapsUrl || undefined,
          place_id: effectiveGbpLoc?.place_id || undefined,
          gmb_location_name: locationName || effectiveGbpLoc?.resource_name || undefined,
          workshop_id: workshopId || undefined,
          prefetched_location: prefetchedLocation,
          workshop_context: selectedWorkshop
            ? { name: selectedWorkshop.name, address: selectedWorkshop.address, city: selectedWorkshop.city, state: selectedWorkshop.state }
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.debug?.attempts?.length) {
          toast.error(`${json?.error || 'Failed to fetch GMB data'} (${json.debug.attempts.join(', ')})`);
        } else {
          toast.error(json?.error || 'Failed to fetch GMB data');
        }
        return;
      }
      const gmb = json.data;
      setGmbPreview(gmb);

      // Parse business hours
      const dayMap: Record<string, string> = {};
      if (gmb.opening_hours) {
        for (const line of gmb.opening_hours) {
          const match = line.match(/^(\w+):\s*(.+)$/);
          if (match) dayMap[match[1].toLowerCase()] = match[2].trim();
        }
      }

      // Build services list from GBP categories + service_items
      const gmbServices: string[] = [];
      if (gmb.primary_category?.display_name) gmbServices.push(gmb.primary_category.display_name);
      for (const cat of gmb.additional_categories || []) {
        if (cat.display_name) gmbServices.push(cat.display_name);
      }
      for (const svc of gmb.service_items || []) {
        if (svc.display_name) gmbServices.push(svc.display_name);
      }

      setFormData(prev => {
        // Merge services: keep existing + add new GMB ones (deduplicated)
        const existingServices = new Set(prev.services_offered.map(s => s.toLowerCase()));
        const newServices = gmbServices.filter(s => !existingServices.has(s.toLowerCase()));

        return {
          ...prev,
          business_hours: {
            monday: dayMap['monday'] || prev.business_hours.monday,
            tuesday: dayMap['tuesday'] || prev.business_hours.tuesday,
            wednesday: dayMap['wednesday'] || prev.business_hours.wednesday,
            thursday: dayMap['thursday'] || prev.business_hours.thursday,
            friday: dayMap['friday'] || prev.business_hours.friday,
            saturday: dayMap['saturday'] || prev.business_hours.saturday,
            sunday: dayMap['sunday'] || prev.business_hours.sunday,
          },
          alternate_phone: gmb.phone_number || prev.alternate_phone,
          website_url: gmb.website || prev.website_url,
          short_description: prev.short_description || gmb.description || '',
          google_maps_url: gmb.google_maps_uri || prev.google_maps_url,
          services_offered: [...prev.services_offered, ...newServices],
        };
      });

      const filledFields = ['hours', 'phone', 'website'];
      if (gmb.description) filledFields.push('description');
      if (gmbServices.length > 0) filledFields.push(`${gmbServices.length} services`);
      toast.success(`GMB data fetched! Auto-filled: ${filledFields.join(', ')}.`);
    } catch (err: any) {
      console.error('GMB fetch error:', err);
      toast.error('Failed to fetch GMB data');
    } finally {
      setFetchingGmb(false);
    }
  };

  const handleGbpLocationSelect = (resourceName: string) => {
    setSelectedGbpLocation(resourceName);
    const loc = gbpLocations.find((l) => l.resource_name === resourceName);
    if (!loc) return;

    // Immediately pre-fill what we already have from the location listing
    const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
    const hoursUpdate: Record<string, string> = {};
    if (Array.isArray(loc.regular_hours) && loc.regular_hours.length > 0) {
      const dayMap: Record<string, string> = {};
      for (const p of loc.regular_hours) {
        const day = String(p.open_day || '').toUpperCase();
        if (DAY_ORDER.includes(day as typeof DAY_ORDER[number])) {
          dayMap[day] = `${p.open_time} – ${p.close_time}`;
        }
      }
      for (const day of DAY_ORDER) {
        hoursUpdate[day.toLowerCase()] = dayMap[day] || 'Closed';
      }
    }

    setFormData((prev) => ({
      ...prev,
      google_maps_url: loc.maps_uri || prev.google_maps_url,
      alternate_phone: loc.phone_number || prev.alternate_phone,
      website_url: loc.website_uri || prev.website_url,
      ...(Object.keys(hoursUpdate).length > 0
        ? {
            business_hours: {
              monday: hoursUpdate['monday'] || prev.business_hours.monday,
              tuesday: hoursUpdate['tuesday'] || prev.business_hours.tuesday,
              wednesday: hoursUpdate['wednesday'] || prev.business_hours.wednesday,
              thursday: hoursUpdate['thursday'] || prev.business_hours.thursday,
              friday: hoursUpdate['friday'] || prev.business_hours.friday,
              saturday: hoursUpdate['saturday'] || prev.business_hours.saturday,
              sunday: hoursUpdate['sunday'] || prev.business_hours.sunday,
            },
          }
        : {}),
    }));
    setGmbPreview(null);

    // Auto-fetch full details (reviews, rating, complete hours) for the selected location
    doFetchGmb(resourceName);
  };

  const handleAddService = () => {
    if (serviceInput.trim()) {
      setFormData(prev => ({
        ...prev,
        services_offered: [...prev.services_offered, serviceInput.trim()]
      }));
      setServiceInput('');
    }
  };

  const handleRemoveService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services_offered: prev.services_offered.filter((_, i) => i !== index)
    }));
  };

  const handleAddBrand = () => {
    if (!brandName.trim() || !brandLogo.trim()) return;
    setFormData(prev => ({
      ...prev,
      brands: [...prev.brands, { name: brandName.trim(), logo_url: brandLogo.trim() }]
    }));
    setBrandName('');
    setBrandLogo('');
  };

  const handleRemoveBrand = (index: number) => {
    setFormData(prev => ({
      ...prev,
      brands: prev.brands.filter((_, i) => i !== index)
    }));
  };

  const handleAddPackageFeature = () => {
    if (!packageFeature.trim()) return;
    setPackageFeatures(prev => [...prev, packageFeature.trim()]);
    setPackageFeature('');
  };

  const handleRemovePackageFeature = (index: number) => {
    setPackageFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPackage = () => {
    if (!packageName.trim()) return;
    setFormData(prev => ({
      ...prev,
      packages: [
        ...prev.packages,
        {
          name: packageName.trim(),
          price: packagePrice.trim() || null,
          features: packageFeatures
        }
      ]
    }));
    setPackageName('');
    setPackagePrice('');
    setPackageFeatures([]);
    setPackageFeature('');
  };

  const handleRemovePackage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index)
    }));
  };

  const handleAddFaq = () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    setFormData(prev => ({
      ...prev,
      faqs: [...prev.faqs, { question: faqQuestion.trim(), answer: faqAnswer.trim() }]
    }));
    setFaqQuestion('');
    setFaqAnswer('');
  };

  const handleRemoveFaq = (index: number) => {
    setFormData(prev => ({
      ...prev,
      faqs: prev.faqs.filter((_, i) => i !== index)
    }));
  };

  const handleFetchGMB = () => doFetchGmb();

  const handleAddGalleryImage = () => {
    if (galleryInput.trim()) {
      if (formData.gallery_images.length >= 25) {
        toast.error('Maximum 25 gallery images allowed');
        return;
      }
      setFormData(prev => ({
        ...prev,
        gallery_images: [...prev.gallery_images, galleryInput.trim()]
      }));
      setGalleryInput('');
    }
  };

  const handleRemoveGalleryImage = (index: number) => {
    if (formData.gallery_images.length <= 2) {
      toast.error('At least 2 gallery images are required. Cannot remove this image.');
      return;
    }
    setFormData(prev => ({
      ...prev,
      gallery_images: prev.gallery_images.filter((_, i) => i !== index)
    }));
  };

  const handleImageUpload = async (file: File, type: 'profile' | 'cover' | 'gallery') => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `workshop-public-pages/${formData.workshop_id || 'temp'}/${fileName}`;

      setUploadingImages(prev => ({ ...prev, [type]: true }));

      const { data, error } = await supabase.storage
        .from('workshop-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        // If bucket doesn't exist, try generic bucket or show error
        if (error.message.includes('bucket') || error.message.includes('not found')) {
          toast.error('Storage bucket not configured. Please use image URL instead.');
          return;
        }
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('workshop-assets')
        .getPublicUrl(filePath);

      if (type === 'profile') {
        setFormData(prev => ({ ...prev, profile_image: publicUrl }));
        toast.success('Profile image uploaded successfully!');
      } else if (type === 'cover') {
        setFormData(prev => ({ ...prev, cover_image: publicUrl }));
        toast.success('Cover image uploaded successfully!');
      } else if (type === 'gallery') {
        if (formData.gallery_images.length >= 25) {
          toast.error('Maximum 25 gallery images allowed');
          return;
        }
        setFormData(prev => ({ ...prev, gallery_images: [...prev.gallery_images, publicUrl] }));
        toast.success('Gallery image uploaded successfully!');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image. Please use image URL instead.');
    } finally {
      setUploadingImages(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate minimum 2 gallery images
      if (formData.gallery_images.length < 2) {
        toast.error('At least 2 gallery images are required');
        setSaving(false);
        return;
      }

      // Validate maximum 25 gallery images
      if (formData.gallery_images.length > 25) {
        toast.error('Maximum 25 gallery images allowed');
        setSaving(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const pageData: Record<string, any> = {
        ...formData,
        business_hours: formData.business_hours,
        services_offered: formData.services_offered,
        gallery_images: formData.gallery_images,
        meta_keywords: formData.meta_keywords,
        brands: formData.brands,
        packages: formData.packages,
        faqs: formData.faqs,
        updated_by: user.id,
        ...(editingPage ? {} : { created_by: user.id }),
        ...(formData.is_published && !editingPage ? { published_at: new Date().toISOString() } : {}),
      };

      if (gmbPreview?.place_id) {
        pageData.gmb_place_id = gmbPreview.place_id;
        pageData.gmb_data = {
          ...gmbPreview,
          gmb_location_name: selectedGbpLocation || null,
        };
        pageData.gmb_last_fetched_at = new Date().toISOString();
      }
      if (selectedGbpLocation) {
        pageData.gmb_location_name = selectedGbpLocation;
      }

      let error;
      if (editingPage) {
        const { error: updateError } = await (supabase as any)
          .from('workshop_public_pages')
          .update(pageData)
          .eq('id', editingPage.id);
        error = updateError;
      } else {
        const { error: insertError } = await (supabase as any)
          .from('workshop_public_pages')
          .insert([pageData]);
        error = insertError;
      }

      if (error) throw error;

      toast.success(editingPage ? 'Page updated successfully' : 'Page created successfully');
      setShowModal(false);
      resetForm();
      fetchPages();
    } catch (error: any) {
      console.error('Error saving page:', error);
      toast.error(error.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (page: any) => {
    if (!confirm(`Delete public page for "${page.workshop?.name || page.slug}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('workshop_public_pages').delete().eq('id', page.id);
      if (error) throw error;
      toast.success('Page deleted');
      fetchPages();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  const handleEdit = (page: any) => {
    setEditingPage(page);
    setFormData({
      workshop_id: page.workshop_id,
      slug: page.slug,
      profile_image: page.profile_image || '',
      cover_image: page.cover_image || '',
      short_description: page.short_description || '',
      full_description: page.full_description || '',
      services_offered: page.services_offered || [],
      business_hours: page.business_hours || {
        monday: '', tuesday: '', wednesday: '', thursday: '',
        friday: '', saturday: '', sunday: ''
      },
      whatsapp_number: page.whatsapp_number || '',
      alternate_phone: page.alternate_phone || '',
      website_url: page.website_url || '',
      facebook_url: page.facebook_url || '',
      instagram_url: page.instagram_url || '',
      youtube_url: page.youtube_url || '',
      google_maps_url: page.google_maps_url || '',
      map_embed_url: page.map_embed_url || '',
      gallery_images: page.gallery_images || [],
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      meta_keywords: page.meta_keywords || [],
      brands: page.brands || [],
      packages: page.packages || [],
      faqs: page.faqs || [],
      is_published: page.is_published || false,
      is_featured: page.is_featured || false
    });
    setGmbPreview(page.gmb_data || null);
    setSelectedGbpLocation(page.gmb_location_name || page.gmb_data?.gmb_location_name || '');
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingPage(null);
    setFormData({
      workshop_id: '',
      slug: '',
      profile_image: '',
      cover_image: '',
      short_description: '',
      full_description: '',
      services_offered: defaultServices,
      business_hours: {
        monday: '24 Hours', tuesday: '24 Hours', wednesday: '24 Hours', thursday: '24 Hours',
        friday: '24 Hours', saturday: '24 Hours', sunday: '24 Hours'
      },
      whatsapp_number: '9167779696',
      alternate_phone: '9672132022',
      website_url: 'https://www.myfng.in',
      facebook_url: 'https://www.facebook.com/myfngcarservices',
      instagram_url: 'https://www.instagram.com/myfngcarservices',
      youtube_url: 'https://www.youtube.com/@myfng_car_servicing',
      google_maps_url: '',
      map_embed_url: '',
      gallery_images: [],
      meta_title: '',
      meta_description: '',
      meta_keywords: [],
      brands: [],
      packages: [],
      faqs: [],
      is_published: false,
      is_featured: false
    });
    setBrandName('');
    setBrandLogo('');
    setPackageName('');
    setPackagePrice('');
    setPackageFeature('');
    setPackageFeatures([]);
    setFaqQuestion('');
    setFaqAnswer('');
    setGmbPreview(null);
    setSelectedGbpLocation('');
  };

  const filteredPages = pages.filter(page =>
    page.workshop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.workshop?.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workshop Public Pages</h1>
          <p className="text-gray-600 mt-1">Manage public-facing workshop pages</p>
        </div>
        <div className="flex items-center gap-3">
          {gbpConnected && (
            <button
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 disabled:opacity-60"
              title="Re-sync GMB data for all linked workshop pages"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
              {syncingAll ? 'Syncing...' : 'Sync All GMB'}
            </button>
          )}
          <button
            onClick={handleConnectGoogleBusiness}
            disabled={checkingGbp}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
              gbpConnected
                ? 'bg-green-50 text-green-700 border-green-300'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } disabled:opacity-60`}
            title="Connect your Google Business account"
          >
            <PlugZap className="w-4 h-4" />
            {checkingGbp ? 'Checking...' : gbpConnected ? 'Google Connected' : 'Connect Google Business'}
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Public Page
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by workshop name, slug, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Company-Wide Stats (shown on all workshop pages) */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCompanyStats(!showCompanyStats)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Company-Wide Stats</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Same on all pages</span>
          </div>
          {showCompanyStats ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showCompanyStats && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-4">These numbers appear on all workshop public pages (Store Header Stats & About MyFNG section).</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              {([
                { key: 'cars_serviced', label: 'Cars Serviced' },
                { key: 'happy_customers', label: 'Happy Customers' },
                { key: 'avg_rating', label: 'Avg Rating' },
                { key: 'touch_points', label: 'Touch Points' },
                { key: 'verified_workshops', label: 'Verified Workshops' },
                { key: 'cities_covered', label: 'Cities Covered' },
              ] as { key: keyof typeof companyStats; label: string }[]).map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
                  <input
                    type="text"
                    value={companyStats[key]}
                    onChange={(e) => setCompanyStats({ ...companyStats, [key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">About Description (subtitle)</label>
                <input
                  type="text"
                  value={companyStats.about_description}
                  onChange={(e) => setCompanyStats({ ...companyStats, about_description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Who We Are - Paragraph 1</label>
                <textarea
                  value={companyStats.who_we_are_1}
                  onChange={(e) => setCompanyStats({ ...companyStats, who_we_are_1: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Who We Are - Paragraph 2</label>
                <textarea
                  value={companyStats.who_we_are_2}
                  onChange={(e) => setCompanyStats({ ...companyStats, who_we_are_2: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={saveCompanyStats}
              disabled={savingStats}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {savingStats ? 'Saving...' : 'Save Stats'}
            </button>
          </div>
        )}
      </div>

      {/* Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPages.map((page) => (
          <div key={page.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
            {/* Cover Image */}
            {page.cover_image && (
              <div className="h-32 bg-gray-200 relative">
                <img src={page.cover_image} alt="Cover" className="w-full h-full object-cover" />
              </div>
            )}
            
            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{page.workshop?.name}</h3>
                  <p className="text-sm text-gray-600">{page.workshop?.city}, {page.workshop?.state}</p>
                </div>
                <div className="flex gap-2">
                  {page.is_featured && (
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  )}
                  {page.is_published ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Slug */}
              <div className="mb-3">
                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                  /workshop/{page.slug}
                </code>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm text-gray-600 mb-4">
                <span>👁️ {page.views_count || 0} views</span>
                <span>🔗 {page.clicks_count || 0} clicks</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(page)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(page)}
                  className="flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {page.is_published && (
                  <a
                    href={`/workshop/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-blue-100 text-blue-700 px-3 py-2 rounded hover:bg-blue-200"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredPages.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No public pages found</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">{editingPage ? 'Edit Public Page' : 'Create Public Page'}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ─── SECTION 0: Workshop & URL ─── */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">0</span>
                    Workshop & Page URL
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Workshop *</label>
                      <select value={formData.workshop_id} onChange={(e) => handleWorkshopChange(e.target.value)} required disabled={!!editingPage} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                        <option value="">Select Workshop</option>
                        {workshops.map(w => <option key={w.id} value={w.id}>{w.name} - {w.city}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">URL Slug *</label>
                      <input type="text" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <p className="text-[10px] text-gray-400 mt-0.5">myfng.in/workshop/{formData.slug || 'slug'}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-3">
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.is_published} onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))} className="w-4 h-4 rounded" /> Published</label>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))} className="w-4 h-4 rounded" /> Featured</label>
                  </div>
                </div>

                {/* ─── GMB SYNC ─── */}
                {formData.workshop_id && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h3 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Google Business Auto-Fill</h3>
                  {gbpConnected && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">GBP Location {fetchingGmb && selectedGbpLocation && <span className="text-blue-600 animate-pulse ml-1">Fetching...</span>}</label>
                      <select value={selectedGbpLocation} onChange={(e) => handleGbpLocationSelect(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white" disabled={loadingGbpLocations || fetchingGmb}>
                        <option value="">{loadingGbpLocations ? 'Loading...' : 'Select GMB location'}</option>
                        {gbpLocations.map((loc, i) => <option key={`${loc.resource_name || loc.place_id || 'gbp'}-${i}`} value={loc.resource_name}>{loc.title}{loc.address ? ` — ${loc.address}` : ''}</option>)}
                      </select>
                      {selectedGbpLocation && !fetchingGmb && <p className="text-[10px] text-green-700 mt-0.5">✓ Linked — auto-synced daily</p>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input type="url" value={formData.google_maps_url} onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value }))} placeholder="Google Maps URL" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleFetchGMB} disabled={fetchingGmb || (!formData.google_maps_url.trim() && !selectedGbpLocation && !gbpConnected)} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 text-sm whitespace-nowrap">
                      <RefreshCw className={`w-3.5 h-3.5 ${fetchingGmb ? 'animate-spin' : ''}`} />{fetchingGmb ? 'Fetching...' : 'Sync GMB'}
                    </button>
                  </div>

                  {gmbPreview && (
                    <div className="mt-3 p-3 bg-white border border-green-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{gmbPreview.name || gmbPreview.business_name}</span>
                        <div className="flex gap-1.5">
                          {(gmbPreview as any).open_status && <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${(gmbPreview as any).open_status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{(gmbPreview as any).open_status}</span>}
                          {gmbPreview.rating != null && <span className="text-yellow-600 font-medium"><Star className="w-3 h-3 inline fill-yellow-500 text-yellow-500" /> {gmbPreview.rating} ({gmbPreview.total_reviews || 0})</span>}
                        </div>
                      </div>
                      {gmbPreview.phone_number && <p><span className="font-medium">Phone:</span> {gmbPreview.phone_number}</p>}
                      {Array.isArray(gmbPreview.opening_hours) && gmbPreview.opening_hours.length > 0 && <div className="grid grid-cols-2 gap-0.5 text-[10px] text-gray-600">{gmbPreview.opening_hours.map((h, i) => <span key={i}>{h}</span>)}</div>}
                      {gmbPreview.reviews && gmbPreview.reviews.length > 0 && (
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {gmbPreview.reviews.slice(0, 3).map((r, i) => (
                            <div key={i} className="bg-gray-50 p-1.5 rounded text-[10px]">
                              <span className="font-medium">{r.author_name}</span> <span className="text-yellow-500">{'★'.repeat(r.rating)}</span>
                              {r.text && <p className="text-gray-500 line-clamp-1 mt-0.5">{r.text}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-green-700">✓ Hours, phone, services auto-filled.</p>
                    </div>
                  )}
                </div>
                )}

                {/* ─── SECTION 1: HERO SECTION ─── */}
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200">
                  <h3 className="text-sm font-bold text-[#0a3d91] mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0a3d91] text-white text-xs flex items-center justify-center font-bold">1</span>
                    Hero Section
                    <span className="text-[10px] text-gray-500 font-normal ml-auto">Name &amp; city auto from workshop</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Profile Image</label>
                      <div className="flex gap-1.5">
                        <input type="url" value={formData.profile_image} onChange={(e) => setFormData(prev => ({ ...prev, profile_image: e.target.value }))} placeholder="Image URL" className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                        <label className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5" />{uploadingImages.profile ? '...' : 'Upload'}
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'profile'); }} className="hidden" disabled={uploadingImages.profile} />
                        </label>
                      </div>
                      {formData.profile_image && <div className="mt-1.5 relative inline-block"><img src={formData.profile_image} alt="" className="w-16 h-16 object-cover rounded-lg border" /><button type="button" onClick={() => setFormData(prev => ({ ...prev, profile_image: '' }))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"><X className="w-3 h-3" /></button></div>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Cover Image</label>
                      <div className="flex gap-1.5">
                        <input type="url" value={formData.cover_image} onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))} placeholder="Image URL" className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                        <label className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-1 text-xs whitespace-nowrap">
                          <Upload className="w-3.5 h-3.5" />{uploadingImages.cover ? '...' : 'Upload'}
                          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f, 'cover'); }} className="hidden" disabled={uploadingImages.cover} />
                        </label>
                      </div>
                      {formData.cover_image && <div className="mt-1.5 relative inline-block"><img src={formData.cover_image} alt="" className="h-16 max-w-full object-cover rounded-lg border" /><button type="button" onClick={() => setFormData(prev => ({ ...prev, cover_image: '' }))} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"><X className="w-3 h-3" /></button></div>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Short Description (Hero subtext)</label>
                    <textarea value={formData.short_description} onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Service Tags (shown in store header)</label>
                    <div className="flex gap-1.5 mb-1.5">
                      <input type="text" value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddService())} placeholder="Add service tag" className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                      <button type="button" onClick={handleAddService} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">{formData.services_offered.map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">{s}<button type="button" onClick={() => handleRemoveService(i)} className="text-blue-600 hover:text-blue-800 font-bold">×</button></span>
                    ))}</div>
                  </div>
                </div>

                {/* ─── SECTION 2: WORKSHOP DETAILS ─── */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0a3d91] text-white text-xs flex items-center justify-center font-bold">2</span>
                    Workshop Details
                    <span className="text-[10px] text-gray-500 font-normal ml-auto">Address from workshop, hours from GMB</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp</label><input type="tel" value={formData.whatsapp_number} onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))} placeholder="9999999999" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Alternate Phone</label><input type="tel" value={formData.alternate_phone} onChange={(e) => setFormData(prev => ({ ...prev, alternate_phone: e.target.value }))} placeholder="9999999999" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-xs font-medium text-gray-600">Business Hours</label>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, business_hours: { monday: '24 Hours', tuesday: '24 Hours', wednesday: '24 Hours', thursday: '24 Hours', friday: '24 Hours', saturday: '24 Hours', sunday: '24 Hours' } }))} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200">Set All 24 Hours</button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {Object.keys(formData.business_hours).map(day => (
                      <div key={day}><label className="block text-[10px] text-gray-500 capitalize">{day.slice(0, 3)}</label><input type="text" value={formData.business_hours[day as keyof typeof formData.business_hours]} onChange={(e) => setFormData(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: e.target.value } }))} placeholder="9 AM-7 PM" className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500" /></div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1"><MapPin className="w-3.5 h-3.5 inline mr-0.5" />Google Maps URL</label><input type="url" value={formData.google_maps_url} onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value }))} placeholder="https://maps.google.com/..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1"><MapPin className="w-3.5 h-3.5 inline mr-0.5" />Map Embed URL</label><input type="url" value={formData.map_embed_url} onChange={(e) => setFormData(prev => ({ ...prev, map_embed_url: e.target.value }))} placeholder="https://google.com/maps/embed?pb=..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /><p className="text-[10px] text-gray-400 mt-0.5">Google Maps → Share → Embed → copy src URL</p></div>
                  </div>
                </div>

                {/* ─── SECTION 3: ABOUT THE BUSINESS ─── */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0a3d91] text-white text-xs flex items-center justify-center font-bold">3</span>
                    About the Business
                    <span className="text-[10px] text-gray-500 font-normal ml-auto">Heading auto: &quot;About {'{'}workshop name{'}'}&quot;</span>
                  </h3>
                  <textarea value={formData.full_description} onChange={(e) => setFormData(prev => ({ ...prev, full_description: e.target.value }))} rows={5} placeholder="Write about this workshop..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>

                {/* ─── SECTION 4: WORKSHOP GALLERY ─── */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0a3d91] text-white text-xs flex items-center justify-center font-bold">4</span>
                    Workshop Gallery
                    <span className="text-xs text-gray-500 font-normal ml-auto">{formData.gallery_images.length}/25 (min 2)</span>
                  </h3>
                  <div className="flex gap-1.5 mb-2">
                    <input type="url" value={galleryInput} onChange={(e) => setGalleryInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGalleryImage())} placeholder="Image URL" className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                    <button type="button" onClick={handleAddGalleryImage} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">Add URL</button>
                    <label className={`px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1 text-sm whitespace-nowrap ${formData.gallery_images.length >= 25 ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                      <Upload className="w-3.5 h-3.5" />{uploadingImages.gallery ? '...' : 'Upload'}
                      <input type="file" accept="image/*" multiple onChange={(e) => { const files = Array.from(e.target.files || []); const rem = 25 - formData.gallery_images.length; if (files.length > rem) { toast.error(`Only ${rem} more allowed`); files.slice(0, rem).forEach(f => handleImageUpload(f, 'gallery')); } else files.forEach(f => handleImageUpload(f, 'gallery')); }} className="hidden" disabled={uploadingImages.gallery || formData.gallery_images.length >= 25} />
                    </label>
                  </div>
                  {formData.gallery_images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">{formData.gallery_images.map((url, i) => (
                      <div key={i} className="relative group"><img src={url} alt={`Gallery ${i + 1}`} className="w-full h-20 object-cover rounded border border-gray-200" /><button type="button" onClick={() => handleRemoveGalleryImage(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"><X className="w-3 h-3" /></button></div>
                    ))}</div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg"><ImageIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" /><p className="text-xs text-gray-500">No images yet. <span className="text-red-500">Min 2 required</span></p></div>
                  )}
                  {formData.gallery_images.length > 0 && formData.gallery_images.length < 2 && <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 mt-2">Add {2 - formData.gallery_images.length} more image(s) (min 2)</p>}
                </div>

                {/* ─── SECTION 5: SOCIAL & SEO ─── */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#0a3d91] text-white text-xs flex items-center justify-center font-bold">5</span>
                    Social Links &amp; SEO
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Website</label><input type="url" value={formData.website_url} onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Facebook</label><input type="url" value={formData.facebook_url} onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Instagram</label><input type="url" value={formData.instagram_url} onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">YouTube</label><input type="url" value={formData.youtube_url} onChange={(e) => setFormData(prev => ({ ...prev, youtube_url: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Meta Title</label><input type="text" value={formData.meta_title} onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                    <div><label className="block text-xs font-medium text-gray-600 mb-1">Meta Description</label><input type="text" value={formData.meta_description} onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" /></div>
                  </div>
                </div>

                {/* ─── INFO: Same for all ─── */}
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                  <p className="text-xs text-amber-800"><strong>Same for all workshops:</strong> Brands, Periodic Packages, FAQs, About MyFNG, Other Services, RSA — auto-filled with defaults, editable from Company Stats above.</p>
                </div>

                {/* ─── ACTIONS ─── */}
                <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">{saving ? 'Saving...' : editingPage ? 'Update Page' : 'Create Page'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
