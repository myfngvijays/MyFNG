'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { Globe, Search, Plus, Edit2, Eye, ExternalLink, Image as ImageIcon, CheckCircle, XCircle, Star, Upload, X, MapPin, RefreshCw, PlugZap } from 'lucide-react';
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

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchPages();
    fetchWorkshops();
    fetchGoogleBusinessStatus();
    checkGoogleBusinessConnectToast();
  }, []);

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
        .select('id, name, address, city, state, public_gmb_url')
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

  const handleWorkshopChange = (workshopId: string) => {
    const workshop = workshops.find(w => w.id === workshopId);
    if (workshop) {
      setFormData(prev => ({
        ...prev,
        workshop_id: workshopId,
        slug: editingPage ? prev.slug : generateSlug(workshop.name),
        google_maps_url: workshop.public_gmb_url || prev.google_maps_url
      }));
      setGmbPreview(null);
      setSelectedGbpLocation('');
      if (gbpConnected && gbpLocations.length === 0) fetchGoogleBusinessLocations();
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
      services_offered: [],
      business_hours: {
        monday: '', tuesday: '', wednesday: '', thursday: '',
        friday: '', saturday: '', sunday: ''
      },
      whatsapp_number: '',
      alternate_phone: '',
      website_url: '',
      facebook_url: '',
      instagram_url: '',
      youtube_url: '',
      google_maps_url: '',
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
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingPage ? 'Edit Public Page' : 'Create Public Page'}
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Workshop Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workshop *
                  </label>
                  <select
                    value={formData.workshop_id}
                    onChange={(e) => handleWorkshopChange(e.target.value)}
                    required
                    disabled={!!editingPage}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Workshop</option>
                    {workshops.map(workshop => (
                      <option key={workshop.id} value={workshop.id}>
                        {workshop.name} - {workshop.city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Slug * (e.g., delhi-auto-care)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    URL: www.domain.in/workshop/{formData.slug || 'workshop-name'}
                  </p>
                </div>

                {/* Google Maps URL + Fetch GMB */}
                {formData.workshop_id && (
                <div>
                  {gbpConnected && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Google Business Location
                        {fetchingGmb && selectedGbpLocation && (
                          <span className="ml-2 text-xs text-blue-600 font-normal animate-pulse">Fetching details...</span>
                        )}
                      </label>
                      <select
                        value={selectedGbpLocation}
                        onChange={(e) => handleGbpLocationSelect(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={loadingGbpLocations || fetchingGmb}
                      >
                        <option value="">
                          {loadingGbpLocations ? 'Loading GMB locations...' : 'Select GMB location to auto-fill details'}
                        </option>
                        {gbpLocations.map((loc, index) => (
                          <option key={`${loc.resource_name || loc.place_id || 'gbp'}-${index}`} value={loc.resource_name}>
                            {loc.title}{loc.address ? ` — ${loc.address}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedGbpLocation && !fetchingGmb && (
                        <p className="text-xs text-green-700 mt-1">✓ GMB location linked — details auto-synced daily.</p>
                      )}
                    </div>
                  )}

                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Google Maps URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={formData.google_maps_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value }))}
                      placeholder="https://maps.google.com/..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleFetchGMB}
                      disabled={fetchingGmb || (!formData.google_maps_url.trim() && !selectedGbpLocation && !gbpConnected)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetchingGmb ? 'animate-spin' : ''}`} />
                      {fetchingGmb ? 'Fetching...' : 'Re-sync GMB'}
                    </button>
                  </div>

                  {gmbPreview && (
                    <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-green-900 text-sm">GMB Data Preview</h4>
                        <div className="flex items-center gap-2">
                          {(gmbPreview as any).open_status && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${(gmbPreview as any).open_status === 'OPEN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {(gmbPreview as any).open_status === 'OPEN' ? 'Open' : (gmbPreview as any).open_status === 'CLOSED_PERMANENTLY' ? 'Closed Permanently' : 'Closed'}
                            </span>
                          )}
                          {gmbPreview.rating != null && (
                            <span className="flex items-center gap-1 text-sm font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded">
                              <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                              {gmbPreview.rating} ({gmbPreview.total_reviews || 0} reviews)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Business info */}
                      <div className="space-y-1">
                        {gmbPreview.business_name && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Business:</span> {gmbPreview.business_name}</p>
                        )}
                        {(gmbPreview as any).primary_category?.display_name && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Category:</span> {(gmbPreview as any).primary_category.display_name}
                            {(gmbPreview as any).additional_categories?.length > 0 && (
                              <span className="text-gray-500"> + {(gmbPreview as any).additional_categories.map((c: any) => c.display_name).join(', ')}</span>
                            )}
                          </p>
                        )}
                        {gmbPreview.formatted_address && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Address:</span> {gmbPreview.formatted_address}</p>
                        )}
                        {gmbPreview.phone_number && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Phone:</span> {gmbPreview.phone_number}</p>
                        )}
                        {gmbPreview.website && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Website:</span> {gmbPreview.website}</p>
                        )}
                        {(gmbPreview as any).description && (
                          <p className="text-sm text-gray-800"><span className="font-medium">Description:</span> {(gmbPreview as any).description}</p>
                        )}
                      </div>

                      {/* Services */}
                      {(gmbPreview as any).service_items?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">Services ({(gmbPreview as any).service_items.length}):</p>
                          <div className="flex flex-wrap gap-1">
                            {(gmbPreview as any).service_items.slice(0, 12).map((s: any, i: number) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{s.display_name}</span>
                            ))}
                            {(gmbPreview as any).service_items.length > 12 && (
                              <span className="text-xs text-gray-500">+{(gmbPreview as any).service_items.length - 12} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hours */}
                      {gmbPreview.opening_hours && gmbPreview.opening_hours.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">Hours:</p>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {gmbPreview.opening_hours.map((h, i) => (
                              <p key={i} className="text-xs text-gray-600">{h}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attributes */}
                      {(gmbPreview as any).attributes?.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">Attributes:</p>
                          <div className="flex flex-wrap gap-1">
                            {(gmbPreview as any).attributes.slice(0, 8).map((a: any, i: number) => (
                              <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{a.display_name || a.name}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reviews */}
                      {gmbPreview.reviews && gmbPreview.reviews.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">Recent Reviews ({gmbPreview.total_reviews || gmbPreview.reviews.length}):</p>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {gmbPreview.reviews.map((r, i) => (
                              <div key={i} className="text-xs text-gray-600 bg-white p-2 rounded border border-green-100">
                                <div className="flex items-center gap-1 mb-0.5">
                                  {r.author_photo && <img src={r.author_photo} alt="" className="w-4 h-4 rounded-full" />}
                                  <span className="font-medium">{r.author_name}</span>
                                  <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                                  {r.relative_time && <span className="text-gray-400 ml-auto">{r.relative_time}</span>}
                                </div>
                                {r.text && <p className="line-clamp-2 text-gray-600">{r.text}</p>}
                                {(r as any).reply && <p className="mt-1 text-xs text-blue-600 border-l-2 border-blue-200 pl-2 line-clamp-1">Reply: {(r as any).reply}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-green-700">✓ Hours, phone, website, description & services auto-filled below.</p>
                    </div>
                  )}
                </div>
                )}

                {/* Images */}
                <div className="space-y-4">
                  {/* Profile Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Profile Image
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formData.profile_image}
                        onChange={(e) => setFormData(prev => ({ ...prev, profile_image: e.target.value }))}
                        placeholder="Image URL"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 whitespace-nowrap">
                        <Upload className="w-4 h-4" />
                        {uploadingImages.profile ? 'Uploading...' : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, 'profile');
                          }}
                          className="hidden"
                          disabled={uploadingImages.profile}
                        />
                      </label>
                    </div>
                    {formData.profile_image && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={formData.profile_image}
                          alt="Profile preview"
                          className="w-24 h-24 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, profile_image: '' }))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cover Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cover Image
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        value={formData.cover_image}
                        onChange={(e) => setFormData(prev => ({ ...prev, cover_image: e.target.value }))}
                        placeholder="Image URL"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center gap-2 whitespace-nowrap">
                        <Upload className="w-4 h-4" />
                        {uploadingImages.cover ? 'Uploading...' : 'Upload'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file, 'cover');
                          }}
                          className="hidden"
                          disabled={uploadingImages.cover}
                        />
                      </label>
                    </div>
                    {formData.cover_image && (
                      <div className="mt-2 relative inline-block">
                        <img
                          src={formData.cover_image}
                          alt="Cover preview"
                          className="w-full max-w-md h-32 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, cover_image: '' }))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Descriptions */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Short Description
                  </label>
                  <textarea
                    value={formData.short_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, short_description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Description
                  </label>
                  <textarea
                    value={formData.full_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, full_description: e.target.value }))}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Services */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Services Offered
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={serviceInput}
                      onChange={(e) => setServiceInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddService())}
                      placeholder="Add service"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.services_offered.map((service, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                      >
                        {service}
                        <button
                          type="button"
                          onClick={() => handleRemoveService(index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Brands */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brands We Serve
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <input
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Brand name"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="url"
                      value={brandLogo}
                      onChange={(e) => setBrandLogo(e.target.value)}
                      placeholder="Logo URL"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddBrand}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.brands.map((brand, index) => (
                      <span
                        key={`${brand.name}-${index}`}
                        className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
                      >
                        {brand.name}
                        <button
                          type="button"
                          onClick={() => handleRemoveBrand(index)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Packages */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Periodic Service Packages
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      placeholder="Package name"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={packagePrice}
                      onChange={(e) => setPackagePrice(e.target.value)}
                      placeholder="Price (optional)"
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={packageFeature}
                      onChange={(e) => setPackageFeature(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPackageFeature())}
                      placeholder="Add package feature"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddPackageFeature}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Add Feature
                    </button>
                    <button
                      type="button"
                      onClick={handleAddPackage}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Add Package
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {packageFeatures.map((feature, index) => (
                      <span
                        key={`${feature}-${index}`}
                        className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                      >
                        {feature}
                        <button
                          type="button"
                          onClick={() => handleRemovePackageFeature(index)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {formData.packages.map((pkg, index) => (
                      <div
                        key={`${pkg.name}-${index}`}
                        className="border border-gray-200 rounded-lg p-3 flex items-start justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {pkg.name} {pkg.price ? `• ${pkg.price}` : ''}
                          </div>
                          {pkg.features.length ? (
                            <ul className="text-xs text-gray-600 mt-2 space-y-1">
                              {pkg.features.map((feature, featureIndex) => (
                                <li key={`${pkg.name}-feature-${featureIndex}`}>• {feature}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePackage(index)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FAQs */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    FAQs
                  </label>
                  <div className="space-y-2 mb-2">
                    <input
                      type="text"
                      value={faqQuestion}
                      onChange={(e) => setFaqQuestion(e.target.value)}
                      placeholder="FAQ question"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      value={faqAnswer}
                      onChange={(e) => setFaqAnswer(e.target.value)}
                      rows={2}
                      placeholder="FAQ answer"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddFaq}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Add FAQ
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.faqs.map((faq, index) => (
                      <div
                        key={`${faq.question}-${index}`}
                        className="border border-gray-200 rounded-lg p-3 flex items-start justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{faq.question}</div>
                          <div className="text-sm text-gray-600 mt-1">{faq.answer}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFaq(index)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Business Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Hours
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(formData.business_hours).map(day => (
                      <div key={day}>
                        <label className="block text-xs text-gray-600 mb-1 capitalize">{day}</label>
                        <input
                          type="text"
                          value={formData.business_hours[day as keyof typeof formData.business_hours]}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            business_hours: { ...prev.business_hours, [day]: e.target.value }
                          }))}
                          placeholder="9:00 AM - 6:00 PM"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alternate Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.alternate_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, alternate_phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Social Media */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                    <input
                      type="url"
                      value={formData.website_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Facebook</label>
                    <input
                      type="url"
                      value={formData.facebook_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Instagram</label>
                    <input
                      type="url"
                      value={formData.instagram_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">YouTube</label>
                    <input
                      type="url"
                      value={formData.youtube_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, youtube_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Gallery */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gallery Images <span className="text-red-500">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">
                      ({formData.gallery_images.length}/25) - Minimum 2 required
                    </span>
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="url"
                      value={galleryInput}
                      onChange={(e) => setGalleryInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGalleryImage())}
                      placeholder="Image URL"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddGalleryImage}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      Add URL
                    </button>
                    <label className={`px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                      formData.gallery_images.length >= 25
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}>
                      <Upload className="w-4 h-4" />
                      {uploadingImages.gallery ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const remainingSlots = 25 - formData.gallery_images.length;
                          if (files.length > remainingSlots) {
                            toast.error(`Only ${remainingSlots} more images can be uploaded (max 25 total)`);
                            const filesToUpload = files.slice(0, remainingSlots);
                            filesToUpload.forEach(file => handleImageUpload(file, 'gallery'));
                          } else {
                            files.forEach(file => handleImageUpload(file, 'gallery'));
                          }
                        }}
                        className="hidden"
                        disabled={uploadingImages.gallery || formData.gallery_images.length >= 25}
                      />
                    </label>
                  </div>
                  {formData.gallery_images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {formData.gallery_images.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-24 object-cover rounded border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveGalleryImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.gallery_images.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No gallery images added yet</p>
                      <p className="text-xs text-red-500 mt-1">At least 2 images are required</p>
                    </div>
                  )}
                  {formData.gallery_images.length > 0 && formData.gallery_images.length < 2 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ Add {2 - formData.gallery_images.length} more image(s) (minimum 2 required)
                      </p>
                    </div>
                  )}
                  {formData.gallery_images.length >= 25 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        ✓ Maximum limit reached (25/25 images)
                      </p>
                    </div>
                  )}
                </div>

                {/* SEO */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Title</label>
                  <input
                    type="text"
                    value={formData.meta_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                  <textarea
                    value={formData.meta_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Status */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>Published</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_featured: e.target.checked }))}
                      className="w-4 h-4"
                    />
                    <span>Featured</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingPage ? 'Update Page' : 'Create Page'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
