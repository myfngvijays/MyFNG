'use client';

import React, { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { Globe, Upload, Image as ImageIcon, CheckCircle, XCircle, Star, X, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import DashboardLayout from '@/components/DashboardLayout';
import { WorkshopPageHeader, WorkshopPageShell } from '@/components/workshop/WorkshopUi';

export default function WorkshopAdminPublicPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const { userProfile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState<any>(null);
  const [workshop, setWorkshop] = useState<any>(null);
  const [uploadingImages, setUploadingImages] = useState<{ [key: string]: boolean }>({});
  const [formData, setFormData] = useState({
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
    is_published: false,
    is_featured: false
  });
  const [serviceInput, setServiceInput] = useState('');
  const [galleryInput, setGalleryInput] = useState('');

  useEffect(() => {
    if (userProfile?.workshop_id) {
      fetchPublicPage();
      fetchWorkshop();
    }
  }, [userProfile]);

  const fetchWorkshop = async () => {
    if (!userProfile?.workshop_id) return;
    
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', userProfile.workshop_id)
        .single();

      if (error) throw error;
      setWorkshop(data);
    } catch (error: any) {
      console.error('Error fetching workshop:', error);
    }
  };

  const fetchPublicPage = async () => {
    if (!userProfile?.workshop_id) return;

    try {
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select('*')
        .eq('workshop_id', userProfile.workshop_id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setPage(data);
        setFormData({
          slug: data.slug || '',
          profile_image: data.profile_image || '',
          cover_image: data.cover_image || '',
          short_description: data.short_description || '',
          full_description: data.full_description || '',
          services_offered: data.services_offered || [],
          business_hours: data.business_hours || {
            monday: '', tuesday: '', wednesday: '', thursday: '',
            friday: '', saturday: '', sunday: ''
          },
          whatsapp_number: data.whatsapp_number || '',
          alternate_phone: data.alternate_phone || '',
          website_url: data.website_url || '',
          facebook_url: data.facebook_url || '',
          instagram_url: data.instagram_url || '',
          youtube_url: data.youtube_url || '',
          google_maps_url: data.google_maps_url || '',
          gallery_images: data.gallery_images || [],
          meta_title: data.meta_title || '',
          meta_description: data.meta_description || '',
          meta_keywords: data.meta_keywords || [],
          is_published: data.is_published || false,
          is_featured: data.is_featured || false
        });
      } else {
        // Generate slug from workshop name if page doesn't exist
        if (workshop) {
          const slug = workshop.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
          setFormData(prev => ({ ...prev, slug }));
        }
      }
    } catch (error: any) {
      console.error('Error fetching public page:', error);
      toast.error('Failed to load public page');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  useEffect(() => {
    if (workshop && !page) {
      setFormData(prev => ({
        ...prev,
        slug: prev.slug || generateSlug(workshop.name),
        whatsapp_number: prev.whatsapp_number || workshop.phone || '',
        alternate_phone: prev.alternate_phone || workshop.phone || ''
      }));
    }
  }, [workshop, page]);

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
    if (!userProfile?.workshop_id) {
      toast.error('Workshop ID not found');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `workshop-public-pages/${userProfile.workshop_id}/${fileName}`;

      setUploadingImages(prev => ({ ...prev, [type]: true }));

      const { data, error } = await supabase.storage
        .from('workshop-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        if (error.message.includes('bucket') || error.message.includes('not found')) {
          toast.error('Storage bucket not configured. Please use image URL instead.');
          return;
        }
        throw error;
      }

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

    if (!userProfile?.workshop_id) {
      toast.error('Workshop ID not found');
      setSaving(false);
      return;
    }

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

      const pageData = {
        workshop_id: userProfile.workshop_id,
        slug: formData.slug || generateSlug(workshop?.name || 'workshop'),
        profile_image: formData.profile_image || null,
        cover_image: formData.cover_image || null,
        short_description: formData.short_description || null,
        full_description: formData.full_description || null,
        services_offered: formData.services_offered,
        business_hours: formData.business_hours,
        whatsapp_number: formData.whatsapp_number || null,
        alternate_phone: formData.alternate_phone || null,
        website_url: formData.website_url || null,
        facebook_url: formData.facebook_url || null,
        instagram_url: formData.instagram_url || null,
        youtube_url: formData.youtube_url || null,
        google_maps_url: formData.google_maps_url || null,
        gallery_images: formData.gallery_images,
        meta_title: formData.meta_title || null,
        meta_description: formData.meta_description || null,
        meta_keywords: formData.meta_keywords || [],
        is_published: formData.is_published,
        is_featured: formData.is_featured, // Workshop owner can't set featured, but can save
        updated_by: user.id,
        ...(page ? {} : { created_by: user.id }),
        ...(formData.is_published && !page ? { published_at: new Date().toISOString() } : {})
      };

      let error;
      if (page) {
        const { error: updateError } = await supabase
          .from('workshop_public_pages')
          .update(pageData)
          .eq('id', page.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('workshop_public_pages')
          .insert([pageData]);
        error = insertError;
      }

      if (error) throw error;

      toast.success(page ? 'Public page updated successfully' : 'Public page created successfully');
      fetchPublicPage();
    } catch (error: any) {
      console.error('Error saving page:', error);
      toast.error(error.message || 'Failed to save public page');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004AAD]"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!workshop) {
    return (
      <DashboardLayout role="workshop_admin">
        <WorkshopPageShell>
          <WorkshopPageHeader eyebrow="Workshop Owner" title="Manage Public Page" subtitle="Workshop public profile" />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            No workshop assigned to your account. Please contact admin.
          </div>
        </WorkshopPageShell>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
      <WorkshopPageHeader
        eyebrow="Workshop Owner"
        title="Manage Public Page"
        subtitle="Manage your workshop's public-facing page"
        right={
          page && page.is_published ? (
            <a
              href={`/workshop/${page.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#023D95] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#012f73]"
            >
              <Globe className="w-5 h-5" />
              View Public Page
            </a>
          ) : null
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {/* Workshop Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-blue-900 mb-2">Workshop: {workshop.name}</h3>
          <p className="text-sm text-blue-700">{workshop.address}, {workshop.city}, {workshop.state}</p>
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

        {/* Rest of the form fields - same as super admin version */}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Google Maps URL</label>
          <input
            type="url"
            value={formData.google_maps_url}
            onChange={(e) => setFormData(prev => ({ ...prev, google_maps_url: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
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

        {/* Status - Workshop owner can only publish, not feature */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
              className="w-4 h-4"
            />
            <span className="font-medium">Publish Page</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            When published, your page will be accessible at /workshop/{formData.slug}
          </p>
          {formData.is_featured && (
            <div className="mt-2 ml-6 flex items-center gap-2 text-sm text-blue-600">
              <Star className="w-4 h-4 fill-blue-600" />
              <span>Featured by Admin</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : page ? 'Update Page' : 'Create Page'}
          </button>
        </div>
      </form>
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
