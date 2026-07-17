'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { Globe, Search, Plus, Edit2, Eye, ExternalLink, Image as ImageIcon, CheckCircle, XCircle, Star, Upload, X, MapPin, RefreshCw, PlugZap, BarChart3, ChevronDown, ChevronUp, Save, Trash2, Layers } from 'lucide-react';
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
    cover_image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&h=400&fit=crop',
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
    gallery_images: [
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
    ] as string[],
    meta_title: '',
    meta_description: '',
    meta_keywords: [] as string[],
    brands: [] as { name: string; logo_url: string }[],
    packages: [] as { name: string; price: string | null; features: string[] }[],
    faqs: [] as { question: string; answer: string }[],
    is_published: false,
    is_featured: false,
    noindex: false,
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
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [bulkData, setBulkData] = useState<{workshopName: string; businessName: string; address: string; slug: string; matchedWorkshop?: any; status?: string}[]>([]);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, errors: [] as string[] });
  const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>([]);
  const [multiCreating, setMultiCreating] = useState(false);
  const [multiProgress, setMultiProgress] = useState({ done: 0, total: 0 });

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

  const normalizeForMatch = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  const DB_TO_SHEET_ALIASES: Record<string, string> = {
    'mahamantraamotors': 'mahamantramotors',
    'shalomautoservicecenter': 'shalommulticarservicecenter',
    'shalomcarservicecenter': 'shalommulticarservicecenter',
    'shalomservicecenter': 'shalommulticarservicecenter',
    'shalomservice': 'shalommulticarservicecenter',
    'shalomautoservice': 'shalommulticarservicecenter',
    'shalommulticarservice': 'shalommulticarservicecenter',
    'refineautomahape': 'refineautomobiles',
    'refineautomobilemahape': 'refineautomobiles',
    'refinemahape': 'refineautomobiles',
    'autoverhaulwerke': 'autooverhaulwerke',
  };

  const findGmbMatch = (workshopName: string, city?: string, usedSlugs?: Set<string>) => {
    const norm = normalizeForMatch(workshopName);
    const mapped = DB_TO_SHEET_ALIASES[norm] || norm;

    const isMatch = (g: typeof GMB_PROFILES[0]) => {
      const gNorm = normalizeForMatch(g.workshopName);
      if (gNorm === norm || gNorm === mapped) return true;
      if (norm.includes(gNorm) || gNorm.includes(norm)) return true;
      if (mapped.includes(gNorm) || gNorm.includes(mapped)) return true;
      const shorter = norm.length < gNorm.length ? norm : gNorm;
      const longer = norm.length < gNorm.length ? gNorm : norm;
      if (shorter.length >= 6 && longer.startsWith(shorter.slice(0, 6))) {
        const words1 = workshopName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const gWords = g.workshopName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const overlap = words1.filter(w => gWords.some(gw => gw.includes(w) || w.includes(gw)));
        if (overlap.length >= 2) return true;
      }
      return false;
    };

    const allMatches = GMB_PROFILES.filter(g => isMatch(g) && (!usedSlugs || !usedSlugs.has(g.slug)));

    if (allMatches.length === 0) return null;
    if (allMatches.length === 1) return allMatches[0];

    if (city) {
      const cityNorm = normalizeForMatch(city);
      const cityMatch = allMatches.find(g =>
        normalizeForMatch(g.businessName).includes(cityNorm) ||
        normalizeForMatch(g.address).includes(cityNorm)
      );
      if (cityMatch) return cityMatch;
    }

    return allMatches[0];
  };

  const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&h=400&fit=crop';
  const DEFAULT_GALLERY_IMAGES = [
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=600&fit=crop',
  ];

  const GMB_PROFILES: { workshopName: string; businessName: string; address: string; slug: string; mapUrl: string; embedUrl: string }[] = [
    { workshopName: 'Head Office', businessName: 'MY FNG - Multi-Brand Car Servicing and Repairs Across India', address: 'A/309, Centrum Business Square, Road No 16, Wagle Industrial Estate, Thane, Maharashtra', slug: 'my-fng-multi-brand-car-servicing-and-repairs-india', mapUrl: 'https://maps.google.com/maps?cid=9338020820420071773', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.99218692169!2d72.9548026!3d19.1955436!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b96498d0c98b%3A0x819750761257115d!2sMY%20FNG%20-%20Multi-Brand%20Car%20Servicing%20and%20Repairs%20Across%20India!5e0!3m2!1sen!2sin!4v1783244338893!5m2!1sen!2sin' },
    { workshopName: 'Perfect Touch Automobiles', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Vartak Nagar, Thane West', address: 'Ravi Est Road, Vartak Nagar, Thane West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-thane', mapUrl: 'https://maps.google.com/maps?cid=5904923044467479011', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.0726936581495!2d72.9673013!3d19.235663399999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7bbc656872bfd%3A0xe99a624e00b4912!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Manpada%2C%20Thane%20West!5e0!3m2!1sen!2sin!4v1783244351025!5m2!1sen!2sin' },
    { workshopName: 'Car Carer', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Manpada, Thane West', address: 'Hill Garden, Kokanipada, Thane West, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-manpada-thane', mapUrl: 'https://maps.google.com/maps?cid=1052054665275590930', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.0726936581495!2d72.9673013!3d19.235663399999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7bbc656872bfd%3A0xe99a624e00b4912!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Manpada%2C%20Thane%20West!5e0!3m2!1sen!2sin!4v1783244369583!5m2!1sen!2sin' },
    { workshopName: 'Wadhwa Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Majiwada, Thane West', address: 'Sainath Nagar, Majiwada, Thane West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-majiwada-thane-west', mapUrl: 'https://maps.google.com/maps?cid=5733014544512311485', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3766.348284017776!2d72.9689779!3d19.267214599999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7bb0f196255dd%3A0x22b6f8616f32da13!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Kasarvadavali%2C%20Thane%20West!5e0!3m2!1sen!2sin!4v1783244382439!5m2!1sen!2sin' },
    { workshopName: 'Car Tronics', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kasarvadavali, Thane West', address: 'Bhawani Nagar, Kasarvadavali, Thane West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-kasarvadavali-thane-west', mapUrl: 'https://maps.google.com/maps?cid=2501459740412008979', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.141582442219!2d72.968696!3d19.232660400000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x64f19a88e17d85d7%3A0xba405df484196809!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20GB%20Road%2C%20Thane%20West!5e0!3m2!1sen!2sin!4v1783244392220!5m2!1sen!2sin' },
    { workshopName: 'Autoplanet Wheels', businessName: 'My FNG - Multi Brand Car Garage & Repairs at GB Road, Thane West', address: 'GB Road, Garden Estate Pokhran Road, Thane West, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-manpada-gb-road-thane-west', mapUrl: 'https://maps.google.com/maps?cid=13420830194333739017', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.141582442219!2d72.968696!3d19.232660400000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x64f19a88e17d85d7%3A0xba405df484196809!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20GB%20Road%2C%20Thane%20West!5e0!3m2!1sen!2sin!4v1783244405365!5m2!1sen!2sin' },
    { workshopName: 'Landmax Auto Services', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kalyan-Shilphata Marg, Dombivli East', address: 'Kalyan - Shilphata Rd, Dombivli East, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-dombivli', mapUrl: 'https://maps.google.com/maps?cid=7899135893631738536', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.5213125830514!2d73.08844970000001!3d19.172419899999994!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be795530c96cfa7%3A0x277dd58f216476ac!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Rama%20Mukadam%20Road!5e0!3m2!1sen!2sin!4v1783244415012!5m2!1sen!2sin' },
    { workshopName: 'Auto Techniq', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kolegaon, Dombivli East', address: 'Rama Mukadam Road, Kolegaon, Dombivli East, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-kolegaon-dombivli-east', mapUrl: 'https://maps.google.com/maps?cid=2845665350285293228', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.5213125830514!2d73.08844970000001!3d19.172419899999994!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be795530c96cfa7%3A0x277dd58f216476ac!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Rama%20Mukadam%20Road!5e0!3m2!1sen!2sin!4v1783244426851!5m2!1sen!2sin' },
    { workshopName: 'Car Care Clinic', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Malang Gad Road, Kalyan East', address: 'Malang Gad Road, Kalyan East, Pisavli Village, Tisgaon, Dombivli, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-kalyan-east', mapUrl: 'https://maps.google.com/maps?cid=2287869461652122720', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.405521272896!2d73.13264749999999!3d19.221150599999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be795bbe0d6d115%3A0x1fc025275a3d2c60!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Malang%20Gad%20Road%2C%20Kalyan%20East!5e0!3m2!1sen!2sin!4v1783244437288!5m2!1sen!2sin' },
    { workshopName: 'Takshika Automobiles & Services', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Chikanghar, Kalyan West', address: 'Chikan Ghar Rd, Chikan Ghar, Kalyan, Maharashtra 421301', slug: 'my-fng-best-car-service-and-repairs-chikanghar-kalyan-west', mapUrl: 'https://maps.google.com/maps?cid=10600780385640890391', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3766.7444318082867!2d73.13707289999999!3d19.249966800000003!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7977df5cfbd4b%3A0x931d89986c0dc017!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Chikanghar%2C%20Kalyan%20West!5e0!3m2!1sen!2sin!4v1783244449704!5m2!1sen!2sin' },
    { workshopName: 'Om Sainath Car Care', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ambernath-Badlapur Rd, Ambernath', address: 'Ambernath-Badlapur Road, B-Cabin Road, Ambernath West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-ambernath', mapUrl: 'https://maps.google.com/maps?cid=8583333482079871862', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.0695036237!2d73.2009934!3d19.1921664!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be793a164c8ffed%3A0x771e205354166376!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ambernath-Badlapur%20Rd%2C%20Ambernath!5e0!3m2!1sen!2sin!4v1783244460666!5m2!1sen!2sin' },
    { workshopName: 'Royal Rims LLP', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Neral-Badlapur Rd, Badlapur', address: 'Neral-Badlapur Road, Kulgaon, Badlapur East, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-badlapur', mapUrl: 'https://maps.google.com/maps?cid=5934983091970685837', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.7912825977455!2d73.2402644!3d19.1606114!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7edda8e2ebdcb%3A0x525d4bad60dcbb8d!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Neral-Badlapur%20Rd%2C%20Badlapur!5e0!3m2!1sen!2sin!4v1783244604830!5m2!1sen!2sin' },
    { workshopName: 'Express Autocare', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kalyan-Sape Rd, Bhiwandi', address: 'Kalyan-Sape Road, Savad Naka to Pise Dam, Bhiwandi, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-bhiwandi', mapUrl: 'https://maps.google.com/maps?cid=13277842312733952708', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.4491364522805!2d73.154286!3d19.306307399999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be797071863aaff%3A0xb8445f3c02288ac4!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Kalyan-Sape%20Rd%2C%20Bhiwandi!5e0!3m2!1sen!2sin!4v1783244614663!5m2!1sen!2sin' },
    { workshopName: 'Coachman Autoworld', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ghotsai Rd, Titwala', address: 'Ghotsai Rd, Titwala, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-titwala', mapUrl: 'https://maps.google.com/maps?cid=10143953702899931823', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3766.067086373181!2d73.22473579999999!3d19.2794486!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7918b00bef801%3A0x8cc69025d75bdaaf!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ghotsai%20Rd%2C%20Titwala!5e0!3m2!1sen!2sin!4v1783244623904!5m2!1sen!2sin' },
    { workshopName: 'Cars Doctor', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ramdev Park Rd, Mira Road East', address: 'Naya Nagar NH School Road, Mira Road East, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-ramdev-park-mira-road-east', mapUrl: 'https://maps.google.com/maps?cid=176332123689468773', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3765.9673365062176!2d72.8611543!3d19.2837866!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be791500577d341%3A0x2727521db004365!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ramdev%20Park%20Rd%2C%20Mira%20Road%20East!5e0!3m2!1sen!2sin!4v1783244645998!5m2!1sen!2sin' },
    { workshopName: 'Carvicing Total Car Care', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Miragaon Rd, Mira Road East', address: 'Miragaon Road, Mira Road East, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-mira-road-east', mapUrl: 'https://maps.google.com/maps?cid=12870315788032845092', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3766.250925495093!2d72.8782245!3d19.271451199999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b19ca117347f%3A0xb29c8c04f4cca524!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Miragaon%20Rd%2C%20Mira%20Road%20East!5e0!3m2!1sen!2sin!4v1783244706189!5m2!1sen!2sin' },
    { workshopName: 'The Car Clinic', businessName: 'My FNG - Multi Brand Car Garage & Repairs at S Central Road, Shiravane, Nerul', address: 'MIDC Industrial Area, Nerul, Navi Mumbai, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-shiravane-nerul', mapUrl: 'https://maps.google.com/maps?cid=7322580518841501130', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.282982656348!2d73.02756649999999!3d19.051291799999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c1d0f8a18d33%3A0x659f082f68be45ca!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20S%20Central%20Road%2C%20Shiravane%2C%20Nerul!5e0!3m2!1sen!2sin!4v1783244718394!5m2!1sen!2sin' },
    { workshopName: 'CarsAZ', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Shiravane, Nerul', address: 'MIDC Industrial Area, Shiravane, Nerul, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-nerul', mapUrl: 'https://maps.google.com/maps?cid=1786849421157110030', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.35887634532!2d73.02707099999999!3d19.047952600000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c37322f7af01%3A0x18cc2a14d72e910e!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Shiravane%2C%20Nerul!5e0!3m2!1sen!2sin!4v1783244730830!5m2!1sen!2sin' },
    { workshopName: 'Refine Automobiles', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Pawne, Koparkhairane', address: 'Pawne Village MIDC Road, Pawne, Kopar Khairane, Navi Mumbai, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-koparkhairane-navi-mumbai', mapUrl: 'https://maps.google.com/maps?cid=10798882487535161274', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770.2638073655644!2d73.0248847!3d19.0960794!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c103231c284d%3A0x95dd566850b84fba!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Pawne%2C%20Koparkhairane!5e0!3m2!1sen!2sin!4v1783244746947!5m2!1sen!2sin' },
    { workshopName: 'Steph Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Bangli Road, Vasai West', address: 'Bangli Road, Mahatma Gandhi Road, Vasai West, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-vasai-west', mapUrl: 'https://maps.google.com/maps?cid=15098871612145056906', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3764.087649943141!2d72.81466379999999!3d19.3653571!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7af39cb3279c1%3A0xd189f7bbe722bc8a!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Bangli%20Road%2C%20Vasai%20West!5e0!3m2!1sen!2sin!4v1783244757147!5m2!1sen!2sin' },
    { workshopName: 'Steph Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Waliv Road, Vasai East', address: 'Waliv Road, Gavraipada, Vasai East, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-vasai-east', mapUrl: 'https://maps.google.com/maps?cid=2060443413734103226', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3763.0463137349525!2d72.8505722!3d19.410404800000002!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7af1be15c5043%3A0x1c982a5e3b6a18ba!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Waliv%20Road%2C%20Vasai%20East!5e0!3m2!1sen!2sin!4v1783244766346!5m2!1sen!2sin' },
    { workshopName: 'Steph Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Bolinj-Sopara Rd, Virar West', address: 'Bolinj-Sopara Road, Bolinj, Bandarpada Road, Virar West, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-virar-west', mapUrl: 'https://maps.google.com/maps?cid=11380870152620102093', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3762.2888468835176!2d72.7913514!3d19.443109399999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7abab6d58c5af%3A0x9df0f91af9c451cd!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Bolinj-Sopara%20Rd%2C%20Virar%20West!5e0!3m2!1sen!2sin!4v1783244777066!5m2!1sen!2sin' },
    { workshopName: 'Steph Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Boisar-Tarapur Rd, Boisar', address: 'Boisar-Tarapur Road, Boisar, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-boisar', mapUrl: 'https://maps.google.com/maps?cid=5022731953108571877', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3753.31249390062!2d72.7301933!3d19.8267264!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be71f07e8e48fe1%3A0x45b454198b0a56e5!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Boisar-Tarapur%20Rd%2C%20Boisar!5e0!3m2!1sen!2sin!4v1783244786080!5m2!1sen!2sin' },
    { workshopName: 'Autooverhaul Werke', businessName: 'My FNG - Multi Brand Car Garage & Repairs in Palghar', address: 'Shivneri Nagar, Palghar, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-palghar', mapUrl: 'https://maps.google.com/maps?cid=2150262516104754377', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3756.5380414688907!2d72.7563361!3d19.689704499999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be71d9a573e295f%3A0x1dd7445da642f4c9!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20in%20Palghar!5e0!3m2!1sen!2sin!4v1783244794954!5m2!1sen!2sin' },
    { workshopName: 'Shalom Multi Car Service Center', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Saki Vihar Rd, Andheri East', address: 'Saki Vihar Road, Marol, Andheri East, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-marol-andheri-east', mapUrl: 'https://maps.google.com/maps?cid=17179374910215896790', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.673211065223!2d72.8930283!3d19.121986900000003!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c9ecc4026105%3A0xee696675eaad3ed6!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Saki%20Vihar%20Rd%2C%20Andheri%20East!5e0!3m2!1sen!2sin!4v1783244812827!5m2!1sen!2sin' },
    { workshopName: 'SS Cars', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Jankalyan Nagar, Malad West', address: 'Charkop Naka, Baf Hira Nagar Road, Malad West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-jankalyan-nagar-malad-west', mapUrl: 'https://maps.google.com/maps?cid=5871850074948606159', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.673211065223!2d72.8930283!3d19.121986900000003!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c9ecc4026105%3A0xee696675eaad3ed6!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Saki%20Vihar%20Rd%2C%20Andheri%20East!5e0!3m2!1sen!2sin!4v1783244812827!5m2!1sen!2sin' },
    { workshopName: 'Hasnain Auto Garage', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Moti Nagar, Mulund West', address: 'Moti Nagar, Mulund Colony, Mulund West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-moti-nagar-mulund-west', mapUrl: 'https://maps.google.com/maps?cid=13391761220544515356', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768.6080080430493!2d72.9324778!3d19.168628599999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b9e20a06e72b%3A0xb9d917e0a3684d1c!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Moti%20Nagar%2C%20Mulund%20West!5e0!3m2!1sen!2sin!4v1783244946072!5m2!1sen!2sin' },
    { workshopName: 'Starline Auto', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ambedkar Nagar, Dadar West', address: 'Kamgar Nagar, Kamgar Nagar Number 1 Road, Dadar West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-ambedkar-nagar-dadar-west', mapUrl: 'https://maps.google.com/maps?cid=3976202849164761856', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3772.2349722678146!2d72.82825919999999!3d19.009364899999994!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7cf1949170135%3A0x372e4f6cab5c9b00!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ambedkar%20Nagar%2C%20Dadar%20West!5e0!3m2!1sen!2sin!4v1783244936665!5m2!1sen!2sin' },
    { workshopName: 'Cars Doctor - Kalpana Auto Service', businessName: 'My FNG - Multi Brand Car Garage & Repairs at SV Rd, Vile Parle West', address: 'Navpada, Dadabhai Cross Road No 3, Vile Parle West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-vile-parle-west', mapUrl: 'https://maps.google.com/maps?cid=710477492697919403', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3769.952617066852!2d72.8439449!3d19.1097345!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c90da4622e4d%3A0x9dc1f83ed2b6fab!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20SV%20Rd%2C%20Vile%20Parle%20West!5e0!3m2!1sen!2sin!4v1783244927697!5m2!1sen!2sin' },
    { workshopName: 'Jaya Auto', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Dr. EM Rd, Mahalaxmi', address: 'Agripada, Maulana Azad Road, Mahalaxmi, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-mahalaxmi-mumbai', mapUrl: 'https://maps.google.com/maps?cid=4089000231838676816', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3772.9168787485087!2d72.8271147!3d18.979278!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7cff0d8845abb%3A0x38bf0c0be13bf750!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Dr.%20EM%20Rd%2C%20Mahalaxmi!5e0!3m2!1sen!2sin!4v1783244914450!5m2!1sen!2sin' },
    { workshopName: 'Rapid Car Service', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Milind Nagar, Ghatkopar West', address: 'Govind Nagar, Asalpha, Ghatkopar West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-milind-nagar-ghatkopar-west', mapUrl: 'https://maps.google.com/maps?cid=9992277547142083649', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3770.286517640573!2d72.8931266!3d19.095082500000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7c9f6a66dcff9%3A0x8aabb37cde83f441!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Milind%20Nagar%2C%20Ghatkopar%20West!5e0!3m2!1sen!2sin!4v1783244902691!5m2!1sen!2sin' },
    { workshopName: 'Sumati Automobiles', businessName: 'My FNG - Multi Brand Car Garage & Repairs at HOC Colony, Panvel', address: 'Old Thane Naka Road, Panvel, Navi Mumbai, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-plot-71-panvel', mapUrl: 'https://maps.google.com/maps?cid=12739516267242259149', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3772.4770128904547!2d73.1066243!3d18.9986909!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7e91e123c1509%3A0xb0cbda8c574902cd!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20HOC%20Colony%2C%20Panvel!5e0!3m2!1sen!2sin!4v1783244893319!5m2!1sen!2sin' },
    { workshopName: 'Multibrand A1 Service Center', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Shivaji Nagar, Panvel', address: 'Shivaji Road, Panvel, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-sector-15-panvel', mapUrl: 'https://maps.google.com/maps?cid=556627525135831026', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3772.6638143189066!2d73.1148592!3d18.990449!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7e9df64926717%3A0x7b989c8f3ed0ff2!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Shivaji%20Nagar%2C%20Panvel!5e0!3m2!1sen!2sin!4v1783244883684!5m2!1sen!2sin' },
    { workshopName: 'Nityanand Auto Zone', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Steel Market Rd, Kalamboli', address: 'Sector AWC, Kalamboli, Panvel, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-kalamboli', mapUrl: 'https://maps.google.com/maps?cid=13844971644996931744', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.568542413511!2d73.1112204!3d19.0387247!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7e99cb5de43ed%3A0xc023385b7965d0a0!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Steel%20Market%20Rd%2C%20Kalamboli!5e0!3m2!1sen!2sin!4v1783244873129!5m2!1sen!2sin' },
    { workshopName: 'Pelia Industries', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Yashwant Nagar, Khopoli', address: 'Yashwant Nagar, Khopoli, Maharashtra', slug: 'my-fng-car-service-and-repairs-in-khopoli', mapUrl: 'https://maps.google.com/maps?cid=195388331792230564', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3777.0573670308336!2d73.3258252!3d18.7955966!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be807942ecb086d%3A0x2b628a70dbb68a4!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Yashwant%20Nagar%2C%20Khopoli!5e0!3m2!1sen!2sin!4v1783244863745!5m2!1sen!2sin' },
    { workshopName: 'Maha Mantra Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kandarpada, Dahisar West', address: 'Mandapeshwar, Laxman Mhatre Road, Dahisar West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-kandarpada-dahisar-west', mapUrl: 'https://maps.google.com/maps?cid=10422963848436870074', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3766.773498169049!2d72.8536127!3d19.2487007!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b1a55b9e5f69%3A0x90a5ce659cd16bba!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Kandarpada%2C%20Dahisar%20West!5e0!3m2!1sen!2sin!4v1783244853880!5m2!1sen!2sin' },
    { workshopName: 'Shreeji Automobiles', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Charkop, Kandivali West', address: 'Bhut Nagar, DP Road, Kandivali West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-charkop-kandivali-west', mapUrl: 'https://maps.google.com/maps?cid=10849364526673053823', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.819525544518!2d72.8327259!3d19.2030834!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b748714c43af%3A0x9690af8dfb12487f!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Charkop%2C%20Kandivali%20West!5e0!3m2!1sen!2sin!4v1783244838169!5m2!1sen!2sin' },
    { workshopName: 'Autodoc', businessName: 'My FNG - Multi Brand Car Garage & Repairs at New Link Rd, Borivali West', address: 'Sharda Estate Road, Lokmanya Tilak Road, Borivali West, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-borivali-west', mapUrl: 'https://maps.google.com/maps?cid=5553365994448258959', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3767.2436715858744!2d72.8448969!3d19.2282093!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7b1d8c70ed88f%3A0x4d1184f2eed2878f!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20New%20Link%20Rd%2C%20Borivali%20West!5e0!3m2!1sen!2sin!4v1783244695099!5m2!1sen!2sin' },
    { workshopName: 'Highway Motors', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Mahul, Chembur', address: 'Ambapada, Wadala Chembur Road, Mahul, Trombay, Chembur, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-mahul-chembur', mapUrl: 'https://maps.google.com/maps?cid=15718005619996371206', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3771.9291982203877!2d72.88870039999999!3d19.0228413!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3be7cf264531601b%3A0xda2192d5757a2906!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Mahul%2C%20Chembur!5e0!3m2!1sen!2sin!4v1783244681099!5m2!1sen!2sin' },
    { workshopName: 'The Motor Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ashoka Nagar, Kharadi, Pune', address: 'Aaravi Marg, Ashoka Nagar, Kharadi, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-ashoka-nagar-kharadi-pune', mapUrl: 'https://maps.google.com/maps?cid=8718316333549619403', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3782.3165345667644!2d73.93855930000001!3d18.5597629!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c3a24400e5e7%3A0x78fdae8384b608cb!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ashoka%20Nagar%2C%20Kharadi%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244670519!5m2!1sen!2sin' },
    { workshopName: 'Penta Services', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ganesh Temple, Saswad, Pune', address: 'Sopan Nagar, Saswad Road, Saswad, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-saswad-pune', mapUrl: 'https://maps.google.com/maps?cid=16930542103673114869', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3786.8134410026955!2d74.0241855!3d18.3557936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2ef6b02f8bbf1%3A0xeaf55e57683b10f5!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ganesh%20Temple%2C%20Saswad%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244658690!5m2!1sen!2sin' },
    { workshopName: 'Unity Auto Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Kate Petrol Pump, Pimple Saudagar, Pimpri-Chinchwad, Pune', address: 'Pimple Saudagar, Pimpri-Chinchwad, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-pimple-saudagar-pimpri-chinchwad', mapUrl: 'https://maps.google.com/maps?cid=4762588774595209298', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.433751594066!2d73.8006041!3d18.5995504!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b906bbf0ed2b%3A0x42181d41d902a852!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Kate%20Petrol%20Pump%2C%20Pimple%20Saudagar%2C%20Pimpri-Chinchwad%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244589707!5m2!1sen!2sin' },
    { workshopName: 'The Motor Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Pashan Link Rd, Baner, Pune', address: 'Parshan, Baner-Parshan Link Road, Baner, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-baner-pune', mapUrl: 'https://maps.google.com/maps?cid=6558989866479742967', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3782.442067040399!2d73.7981028!3d18.5540984!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2bf2ad94448f9%3A0x5b06368854e96ff7!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Pashan%20Link%20Rd%2C%20Baner%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244578866!5m2!1sen!2sin' },
    { workshopName: 'AB Autoline', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Ahilyanagar Highway, Wagholi, Pune', address: 'Bakori Road, Wagholi, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-wagholi-pune', mapUrl: 'https://maps.google.com/maps?cid=12994117400297441003', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.5983009745732!2d74.0046124!3d18.5921403!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c58eb46b6b73%3A0xb45460ee067386eb!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Ahilyanagar%20Highway%2C%20Wagholi%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244564942!5m2!1sen!2sin' },
    { workshopName: 'Four Tech Auto', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Santoshi Mata Rd, Katraj, Pune', address: 'Santoshi Mata Road, Santosh Nagar, Katraj, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-katraj-pune', mapUrl: 'https://maps.google.com/maps?cid=4642216826512932997', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.8262352519087!2d73.8588738!3d18.4461971!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2eb4e125cfa7d%3A0x406c779bb2a50085!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Santoshi%20Mata%20Rd%2C%20Katraj%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244555201!5m2!1sen!2sin' },
    { workshopName: 'The Motor Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Sakore Nagar, Vimanagar, Pune', address: 'Sakore Nagar, Viman Nagar, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-vimanagar-pune', mapUrl: 'https://maps.google.com/maps?cid=5496891404460920430', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3782.23481721216!2d73.91230829999999!3d18.5634494!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c1a511a7da07%3A0x4c48e19bcbca8e6e!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Sakore%20Nagar%2C%20Vimanagar%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244544682!5m2!1sen!2sin' },
    { workshopName: 'The Motor Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Hinjawadi Aundh Rd, Wakad, Pune', address: 'Shankar Kalat Nagar, Wakad, Pimpri-Chinchwad, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-wakad-pune', mapUrl: 'https://maps.google.com/maps?cid=18142451708426430146', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.345847286374!2d73.76959029999999!3d18.6035078!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b9b5900ffdf5%3A0xfbc6efb4bb6fa6c2!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Hinjawadi%20Aundh%20Rd%2C%20Wakad%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244534745!5m2!1sen!2sin' },
    { workshopName: 'The Garage', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Dattawadi, Tathawade, Pune', address: 'Dattwadi, Tathawade, Pimpri-Chinchwad, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-tathawade-pune', mapUrl: 'https://maps.google.com/maps?cid=7307106200573416306', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3780.789991986956!2d73.749264!3d18.628513299999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b99e4d780df7%3A0x65680e5fed3b9372!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Dattawadi%2C%20Tathawade%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244523053!5m2!1sen!2sin' },
    { workshopName: 'Pune Automotive', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Park Town Rd, Hadapsar, Pune', address: 'Amanora Park Town Road, Crescent Road, Hadapsar, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-hadapsar-pune', mapUrl: 'https://maps.google.com/maps?cid=2614240928643400602', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3783.2668278037377!2d73.9406422!3d18.5168405!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c37434db749f%3A0x2447a6461513c39a!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Park%20Town%20Rd%2C%20Hadapsar%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244511554!5m2!1sen!2sin' },
    { workshopName: 'The Motor Works', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Anand Nagar, Suncity, Pune', address: 'Anand Nagar, Suncity, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-anand-nagar-suncity-pune', mapUrl: 'https://maps.google.com/maps?cid=9582181483204343923', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3784.1859254256246!2d73.81095839999999!3d18.475235599999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2953cc23ea67f%3A0x84fabf4a57b87873!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Anand%20Nagar%2C%20Suncity%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244494990!5m2!1sen!2sin' },
    { workshopName: 'AB Autoline', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Lohgaon-Wagholi Rd, Baner, Pune', address: 'Dadachi Vasti, Patil Vasti Road, Lohegaon, Pune, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-lohgaon-wagholi-road-pune', mapUrl: 'https://maps.google.com/maps?cid=6164793631015437369', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3781.629624385054!2d73.936133!3d18.5907294!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c5d2ff735479%3A0x558dbf251a440439!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Lohgaon-Wagholi%20Rd%2C%20Baner%2C%20Pune!5e0!3m2!1sen!2sin!4v1783244484104!5m2!1sen!2sin' },
    { workshopName: 'Shree Samarth Autoworld', businessName: 'My FNG - Multi Brand Car Garage & Repairs at Pathardi Phata, Nashik', address: 'Pathardi-Gaulane Road, Pathardi Phata, Nashik, Maharashtra', slug: 'my-fng-best-car-service-and-repairs-in-pathardi-phata-nashik', mapUrl: 'https://maps.google.com/maps?cid=18435111874953271411', embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3750.909461047359!2d73.7548199!3d19.928219800000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bdd9543ea0d1c55%3A0xffd6ac93ad2cd873!2sMy%20FNG%20-%20Multi%20Brand%20Car%20Garage%20%26%20Repairs%20at%20Pathardi%20Phata%2C%20Nashik!5e0!3m2!1sen!2sin!4v1783244473852!5m2!1sen!2sin' },
  ];

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

      const gmbMatch = findGmbMatch(workshopName, cityName);
      const displayName = gmbMatch?.businessName || workshopName;
      const gmbSlug = gmbMatch?.slug || generateSlug(`${workshopName}-${cityName}`);

      const gmbArea = (displayName || '').replace(/^My\s*FNG\s*[-–—]\s*Multi[\s-]*Brand\s*Car\s*(Garage\s*&\s*Repairs|Servicing\s*and\s*Repairs\s*Across\s*India)\s*(at|in)?\s*/i, '').trim() || cityName;
      const defaultDesc = `Welcome to ${displayName}, your trusted automotive service partner in ${gmbArea}! We specialize in providing high-quality car maintenance and repair services to keep your vehicle running smoothly.

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
      const defaultShortDesc = `Premier auto service center in ${gmbArea} offering comprehensive car maintenance, repair, and detailing services with expert technicians.`;
      const defaultMetaTitle = `${displayName} - Best Car Service Center | MyFNG`;
      const defaultMetaDesc = `${displayName} in ${gmbArea} offers expert car servicing, AC repair, battery replacement, brake service, and more. Trusted auto service center with skilled technicians. Book now!`;

      setFormData(prev => ({
        ...prev,
        workshop_id: workshopId,
        slug: isNewPage ? gmbSlug : prev.slug,
        google_maps_url: gmbMatch?.mapUrl || workshop.public_gmb_url || prev.google_maps_url,
        map_embed_url: gmbMatch?.embedUrl || prev.map_embed_url,
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

      if (gmbMatch) {
        setGmbPreview({ business_name: gmbMatch.businessName, formatted_address: gmbMatch.address } as any);
      } else {
        setGmbPreview(null);
      }
      setSelectedGbpLocation('');
      if (gbpConnected && gbpLocations.length === 0) fetchGoogleBusinessLocations();

      if (isNewPage) {
        toast.success(gmbMatch
          ? `GMB matched: ${gmbMatch.businessName} → /${gmbMatch.slug}`
          : `Auto-filled defaults for ${workshopName}. You can edit everything below.`
        );
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

    if (!editingPage && selectedWorkshopIds.length > 1) {
      handleMultiCreate();
      return;
    }

    const effectiveWorkshopId = formData.workshop_id || (selectedWorkshopIds.length === 1 ? selectedWorkshopIds[0] : '');
    if (!editingPage && !effectiveWorkshopId) {
      toast.error('Please select at least one workshop');
      return;
    }
    if (!editingPage && effectiveWorkshopId && !formData.workshop_id) {
      setFormData(prev => ({ ...prev, workshop_id: effectiveWorkshopId }));
    }

    setSaving(true);

    try {
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

      await fetch('/api/workshops/public-pages/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: formData.slug }),
      }).catch(() => null);

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
    if (!confirm(`Delete public page for "${page.gmb_data?.business_name || page.workshop?.name || page.slug}"? This cannot be undone.`)) return;
    try {
      const slug = String(page.slug || '').trim().toLowerCase();
      const { error } = await supabase.from('workshop_public_pages').delete().eq('id', page.id);
      if (error) throw error;
      await fetch('/api/workshops/public-pages/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      }).catch(() => null);
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
      is_featured: page.is_featured || false,
      noindex: page.noindex || false,
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
      cover_image: DEFAULT_COVER_IMAGE,
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
      gallery_images: [...DEFAULT_GALLERY_IMAGES],
      meta_title: '',
      meta_description: '',
      meta_keywords: [],
      brands: [],
      packages: [],
      faqs: [],
      is_published: false,
      is_featured: false,
      noindex: false,
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
    setSelectedWorkshopIds([]);
  };

  const parseBulkInput = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split('\t').length > 1 ? line.split('\t') : line.split('|').map(s => s.trim());
      if (parts.length < 4) return null;
      const workshopName = parts[0]?.trim();
      const businessName = parts[1]?.trim();
      const address = parts[2]?.trim();
      let slug = parts[3]?.trim();
      if (!workshopName || !slug) return null;
      if (slug.startsWith('http')) {
        const urlParts = slug.split('/');
        slug = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
      }
      slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
      const normInput = normalizeForMatch(workshopName);
      const matched = workshops.find(w => {
        const normW = normalizeForMatch(w.name || '');
        return normW === normInput || normW.includes(normInput) || normInput.includes(normW);
      });
      const existingPage = pages.find(p => p.slug === slug);
      const existingWorkshopPage = matched ? pages.find(p => p.workshop_id === matched.id) : null;
      let status = 'ready';
      if (existingPage) status = 'slug_exists';
      else if (existingWorkshopPage) status = 'workshop_has_page';
      else if (!matched) status = 'no_match';
      return { workshopName, businessName, address, slug, matchedWorkshop: matched || null, status };
    }).filter(Boolean) as typeof bulkData;
    setBulkData(parsed);
  };

  const handleBulkCreate = async () => {
    const readyItems = bulkData.filter(d => d.status === 'ready');
    if (readyItems.length === 0) {
      toast.error('No valid entries to create');
      return;
    }
    if (!confirm(`Create ${readyItems.length} public pages? This cannot be undone.`)) return;
    
    setBulkCreating(true);
    setBulkProgress({ done: 0, total: readyItems.length, errors: [] });
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setBulkCreating(false); return; }
    
    const defaultServicesLocal = [
      'AC Service', 'Battery Service', 'Brake Service', 'Clutch Service',
      'Tyre & Wheel Care', 'Denting & Painting', 'Car Detailing', 'Engine Repair',
      'Suspension Service', 'Roadside Assistance', 'Car Garage', 'Multibrand Workshop', 'Car Service Center'
    ];
    const defaultBrandsLocal = [
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
    const defaultPackagesLocal = [
      { name: 'Basic Service', price: '₹2,999', features: ['Engine Oil Replacement', 'Oil Filter Replacement', 'Air Filter Cleaning', 'Spark Plugs Servicing', 'Interior Vacuuming & Body Wash'] },
      { name: 'General Service', price: '₹5,000', features: ['Everything in Basic +', 'Brake Pads & Fluid Check', 'Battery Terminal Cleaning', 'AC Performance Check', 'Test Drive & Final Inspection'] },
      { name: 'Premium Service', price: '₹6,800', features: ['Everything in General +', 'All Brake Cleaning & Lubrication', 'AC Disinfectant Spray', 'Tyre Rotation & Torque', 'Diagnostics Scan & Report'] },
      { name: 'Platinum Service', price: '₹11,300', features: ['Everything in Premium +', 'Engine Compression Test', 'Throttle Body & EGR Cleaning', 'Interior Deep Cleaning', 'Paint Protection & Underbody Coating'] },
    ];
    const defaultFaqsLocal = [
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
    
    let done = 0;
    const errors: string[] = [];
    
    for (const item of readyItems) {
      try {
        const w = item.matchedWorkshop;
        const cityName = w.city || '';
        const workshopName = w.name || '';
        const gmbProfile = GMB_PROFILES.find(g => g.businessName === item.businessName) || GMB_PROFILES.find(g => g.slug === item.slug);
        const gmbArea = (item.businessName || '').replace(/^My\s*FNG\s*[-–—]\s*Multi[\s-]*Brand\s*Car\s*(Garage\s*&\s*Repairs|Servicing\s*and\s*Repairs\s*Across\s*India)\s*(at|in)?\s*/i, '').trim() || cityName;
        const aboutText = `Welcome to ${item.businessName || workshopName}, your trusted automotive service partner in ${gmbArea}! We specialize in providing high-quality car maintenance and repair services to keep your vehicle running smoothly.

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

        const pageData: Record<string, any> = {
          workshop_id: w.id,
          slug: item.slug,
          profile_image: '',
          cover_image: DEFAULT_COVER_IMAGE,
          short_description: `Premier auto service center in ${gmbArea} offering comprehensive car maintenance, repair, and detailing services with expert technicians.`,
          full_description: aboutText,
          services_offered: defaultServicesLocal,
          business_hours: {
            monday: '24 Hours', tuesday: '24 Hours', wednesday: '24 Hours', thursday: '24 Hours',
            friday: '24 Hours', saturday: '24 Hours', sunday: '24 Hours',
          },
          whatsapp_number: '9167779696',
          alternate_phone: '9672132022',
          website_url: 'https://www.myfng.in',
          facebook_url: 'https://www.facebook.com/myfngcarservices',
          instagram_url: 'https://www.instagram.com/myfngcarservices',
          youtube_url: 'https://www.youtube.com/@myfng_car_servicing',
          google_maps_url: gmbProfile?.mapUrl || w.public_gmb_url || '',
          map_embed_url: gmbProfile?.embedUrl || '',
          gallery_images: [...DEFAULT_GALLERY_IMAGES],
          meta_title: `${item.businessName || workshopName} ${cityName} - Best Car Service Center | MyFNG`,
          meta_description: `${item.businessName || workshopName} in ${cityName} offers expert car servicing, AC repair, battery replacement, brake service, and more. Trusted auto service center with skilled technicians. Book now!`,
          meta_keywords: [`car service ${cityName.toLowerCase()}`, `auto workshop ${cityName.toLowerCase()}`, `car repair ${cityName.toLowerCase()}`, workshopName.toLowerCase()],
          brands: defaultBrandsLocal,
          packages: defaultPackagesLocal,
          faqs: defaultFaqsLocal,
          is_published: false,
          is_featured: false,
          created_by: user.id,
          updated_by: user.id,
          gmb_data: item.businessName ? { business_name: item.businessName, formatted_address: item.address } : null,
        };

        const { error } = await (supabase as any).from('workshop_public_pages').insert([pageData]);
        if (error) throw error;
        done++;
        setBulkProgress(prev => ({ ...prev, done }));
      } catch (err: any) {
        errors.push(`${item.workshopName}: ${err?.message || 'Unknown error'}`);
        setBulkProgress(prev => ({ ...prev, errors: [...prev.errors, `${item.workshopName}: ${err?.message || 'Unknown error'}`] }));
      }
    }
    
    setBulkCreating(false);
    if (errors.length === 0) {
      toast.success(`Successfully created ${done} public pages!`);
    } else {
      toast.error(`Created ${done} pages, ${errors.length} failed`);
    }
    fetchPages();
  };

  const availableWorkshops = workshops.filter(w => !pages.find(p => p.workshop_id === w.id));

  const toggleWorkshopSelection = (id: string) => {
    setSelectedWorkshopIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedWorkshopIds.length === availableWorkshops.length) {
      setSelectedWorkshopIds([]);
    } else {
      setSelectedWorkshopIds(availableWorkshops.map(w => w.id));
    }
  };

  const handleMultiCreate = async () => {
    if (selectedWorkshopIds.length === 0) return;
    if (!confirm(`Create public pages for ${selectedWorkshopIds.length} workshops? All defaults + GMB slugs will be applied.`)) return;

    setMultiCreating(true);
    setMultiProgress({ done: 0, total: selectedWorkshopIds.length });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Not authenticated'); setMultiCreating(false); return; }

    const { data: existingSlugsData } = await supabase.from('workshop_public_pages').select('slug');
    const existingSlugs = new Set((existingSlugsData || []).map((p: any) => p.slug));

    let done = 0;
    let skipped = 0;
    const errors: string[] = [];
    const usedSlugs = new Set<string>();

    for (const wId of selectedWorkshopIds) {
      const w = workshops.find(ws => ws.id === wId);
      if (!w) continue;

      const cityName = w.city || '';
      const workshopName = w.name || '';
      const gmbMatch = findGmbMatch(workshopName, cityName, usedSlugs);
      const displayName = gmbMatch?.businessName || workshopName;
      const slug = gmbMatch?.slug || generateSlug(`${workshopName}-${cityName}`);
      usedSlugs.add(slug);

      if (existingSlugs.has(slug)) {
        skipped++;
        setMultiProgress({ done: done + skipped + errors.length, total: selectedWorkshopIds.length });
        continue;
      }

      const gmbArea = (displayName || '').replace(/^My\s*FNG\s*[-–—]\s*Multi[\s-]*Brand\s*Car\s*(Garage\s*&\s*Repairs|Servicing\s*and\s*Repairs\s*Across\s*India)\s*(at|in)?\s*/i, '').trim() || cityName;
      const aboutText = `Welcome to ${displayName}, your trusted automotive service partner in ${gmbArea}! We specialize in providing high-quality car maintenance and repair services to keep your vehicle running smoothly.

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

      try {
        const pageData: Record<string, any> = {
          workshop_id: wId,
          slug,
          profile_image: '',
          cover_image: DEFAULT_COVER_IMAGE,
          short_description: `Premier auto service center in ${gmbArea} offering comprehensive car maintenance, repair, and detailing services with expert technicians.`,
          full_description: aboutText,
          services_offered: defaultServices,
          business_hours: { monday: '24 Hours', tuesday: '24 Hours', wednesday: '24 Hours', thursday: '24 Hours', friday: '24 Hours', saturday: '24 Hours', sunday: '24 Hours' },
          whatsapp_number: '9167779696',
          alternate_phone: '9672132022',
          website_url: 'https://www.myfng.in',
          facebook_url: 'https://www.facebook.com/myfngcarservices',
          instagram_url: 'https://www.instagram.com/myfngcarservices',
          youtube_url: 'https://www.youtube.com/@myfng_car_servicing',
          google_maps_url: gmbMatch?.mapUrl || w.public_gmb_url || '',
          map_embed_url: gmbMatch?.embedUrl || '',
          gallery_images: [...DEFAULT_GALLERY_IMAGES],
          meta_title: `${displayName} - Best Car Service Center | MyFNG`,
          meta_description: `${displayName} in ${cityName} offers expert car servicing, AC repair, battery replacement, brake service, and more. Book now!`,
          meta_keywords: [`car service ${cityName.toLowerCase()}`, `auto workshop ${cityName.toLowerCase()}`, `car repair ${cityName.toLowerCase()}`, workshopName.toLowerCase()],
          brands: defaultBrands,
          packages: defaultPackages,
          faqs: defaultFaqsData,
          is_published: false,
          is_featured: false,
          created_by: user.id,
          updated_by: user.id,
          gmb_data: gmbMatch ? { business_name: gmbMatch.businessName, formatted_address: gmbMatch.address } : null,
        };

        const { error } = await (supabase as any).from('workshop_public_pages').insert([pageData]);
        if (error) throw error;
        done++;
      } catch (err: any) {
        errors.push(`${workshopName}: ${err?.message || 'Unknown error'}`);
      }
      setMultiProgress({ done: done + errors.length, total: selectedWorkshopIds.length });
    }

    setMultiCreating(false);
    setSelectedWorkshopIds([]);
    const msg = [`Created ${done}`];
    if (skipped > 0) msg.push(`${skipped} skipped (slug exists)`);
    if (errors.length > 0) msg.push(`${errors.length} failed`);
    if (errors.length > 0) {
      toast.error(`${msg.join(', ')}: ${errors.slice(0, 3).join('; ')}`);
    } else {
      toast.success(`${msg.join(', ')}!`);
    }
    setShowModal(false);
    fetchPages();
  };

  const filteredPages = pages.filter(page =>
    page.workshop?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.gmb_data?.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      {/* Bulk Create Section */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowBulkCreate(!showBulkCreate)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-gray-900">Bulk Create Public Pages</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">From GMB Sheet</span>
          </div>
          {showBulkCreate ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {showBulkCreate && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-3">
              Paste tab-separated or pipe-separated data: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">Workshop Name | Business Name (GMB) | Address | Slug URL</code>
            </p>
            <textarea
              placeholder={`Perfect Touch Automobiles\tMy FNG - Multi Brand Car Garage & Repairs at Vartak Nagar, Thane West\tRavi Est Road, Vartak Nagar, Thane West, Maharashtra\thttps://myfng.in/service-partner/my-fng-best-car-service-and-repairs-in-thane\nCar Carer\tMy FNG - Multi Brand Car Garage & Repairs at Manpada, Thane West\tHill Garden, Kokanipada, Thane West, Maharashtra\thttps://myfng.in/service-partner/my-fng-car-service-and-repairs-in-manpada-thane`}
              onChange={(e) => parseBulkInput(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
            />
            
            {bulkData.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-600">Total: <strong>{bulkData.length}</strong></span>
                    <span className="text-green-600">Ready: <strong>{bulkData.filter(d => d.status === 'ready').length}</strong></span>
                    <span className="text-red-600">No Match: <strong>{bulkData.filter(d => d.status === 'no_match').length}</strong></span>
                    <span className="text-yellow-600">Exists: <strong>{bulkData.filter(d => d.status === 'slug_exists' || d.status === 'workshop_has_page').length}</strong></span>
                  </div>
                  <button
                    onClick={handleBulkCreate}
                    disabled={bulkCreating || bulkData.filter(d => d.status === 'ready').length === 0}
                    className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-60 text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    {bulkCreating ? `Creating ${bulkProgress.done}/${bulkProgress.total}...` : `Create ${bulkData.filter(d => d.status === 'ready').length} Pages`}
                  </button>
                </div>
                
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-8">#</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Workshop</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">GMB Business Name</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Slug</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkData.map((item, idx) => (
                        <tr key={idx} className={`border-b border-gray-100 ${
                          item.status === 'ready' ? 'bg-green-50/50' : 
                          item.status === 'no_match' ? 'bg-red-50/50' : 'bg-yellow-50/50'
                        }`}>
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-gray-900">{item.workshopName}</span>
                            {item.matchedWorkshop && (
                              <span className="block text-[10px] text-green-600">→ {item.matchedWorkshop.name} ({item.matchedWorkshop.city})</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-[250px] truncate">{item.businessName}</td>
                          <td className="px-3 py-2 text-gray-500 font-mono max-w-[200px] truncate">{item.slug}</td>
                          <td className="px-3 py-2">
                            {item.status === 'ready' && <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-[10px] font-medium"><CheckCircle className="w-3 h-3" /> Ready</span>}
                            {item.status === 'no_match' && <span className="inline-flex items-center gap-1 text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-[10px] font-medium"><XCircle className="w-3 h-3" /> No Match</span>}
                            {item.status === 'slug_exists' && <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full text-[10px] font-medium"><XCircle className="w-3 h-3" /> Slug Exists</span>}
                            {item.status === 'workshop_has_page' && <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full text-[10px] font-medium"><XCircle className="w-3 h-3" /> Has Page</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {bulkProgress.errors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                    {bulkProgress.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-600">{err}</p>
                    ))}
                  </div>
                )}
              </>
            )}
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
                  <h3 className="font-bold text-lg text-gray-900">{page.gmb_data?.business_name || page.workshop?.name}</h3>
                  {page.gmb_data?.business_name && page.gmb_data.business_name !== page.workshop?.name && (
                    <p className="text-xs text-blue-500">{page.workshop?.name}</p>
                  )}
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
                  {editingPage ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Workshop</label>
                          <select value={formData.workshop_id} disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-100">
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
                        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.noindex} onChange={(e) => setFormData(prev => ({ ...prev, noindex: e.target.checked }))} className="w-4 h-4 rounded" /> Noindex</label>
                        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))} className="w-4 h-4 rounded" /> Featured</label>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-gray-600">Select Workshops ({selectedWorkshopIds.length} selected)</label>
                        <button type="button" onClick={toggleSelectAll} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {selectedWorkshopIds.length === availableWorkshops.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg divide-y divide-gray-100">
                        {availableWorkshops.map(w => {
                          const gmbMatch = findGmbMatch(w.name || '', w.city || '');
                          const isSelected = selectedWorkshopIds.includes(w.id);
                          return (
                            <label key={w.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
                              <input type="checkbox" checked={isSelected} onChange={() => {
                                const newSelected = isSelected
                                  ? selectedWorkshopIds.filter(x => x !== w.id)
                                  : [...selectedWorkshopIds, w.id];
                                setSelectedWorkshopIds(newSelected);
                                if (newSelected.length === 1) handleWorkshopChange(newSelected[0]);
                              }} className="w-4 h-4 rounded text-blue-600" />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-900">{w.name}</span>
                                <span className="text-xs text-gray-500 ml-1">- {w.city}</span>
                                {gmbMatch && <span className="block text-[10px] text-green-600 truncate">→ {gmbMatch.slug}</span>}
                              </div>
                              {gmbMatch ? (
                                <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">GMB</span>
                              ) : (
                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium shrink-0">Auto</span>
                              )}
                            </label>
                          );
                        })}
                        {availableWorkshops.length === 0 && (
                          <p className="px-3 py-4 text-sm text-gray-500 text-center">All workshops already have public pages</p>
                        )}
                      </div>
                      {selectedWorkshopIds.length > 1 && (
                        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-purple-700"><strong>{selectedWorkshopIds.length}</strong> workshops selected — all will be created with GMB slugs + default data</p>
                            <button type="button" onClick={handleMultiCreate} disabled={multiCreating} className="bg-purple-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-60">
                              {multiCreating ? `Creating ${multiProgress.done}/${multiProgress.total}...` : `Create ${selectedWorkshopIds.length} Pages`}
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedWorkshopIds.length === 1 && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">URL Slug *</label>
                            <input type="text" value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                            <p className="text-[10px] text-gray-400 mt-0.5">myfng.in/workshop/{formData.slug || 'slug'}</p>
                          </div>
                          <div className="flex items-end gap-3 pb-1">
                            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.is_published} onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))} className="w-4 h-4 rounded" /> Published</label>
                        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.noindex} onChange={(e) => setFormData(prev => ({ ...prev, noindex: e.target.checked }))} className="w-4 h-4 rounded" /> Noindex</label>
                            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))} className="w-4 h-4 rounded" /> Featured</label>
                          </div>
                        </div>
                      )}
                    </>
                  )}
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
