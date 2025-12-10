'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Phone, Mail, Clock, Globe, Facebook, Instagram, Youtube, ExternalLink, Star, CheckCircle } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function WorkshopPublicPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [page, setPage] = useState<any>(null);
  const [workshop, setWorkshop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchWorkshopPage();
    }
  }, [slug]);

  const fetchWorkshopPage = async () => {
    try {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('workshop_public_pages')
        .select(`
          *,
          workshop:workshops(*)
        `)
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      if (data) {
        setPage(data);
        setWorkshop(data.workshop);

        // Update view count
        await supabase
          .from('workshop_public_pages')
          .update({ views_count: (data.views_count || 0) + 1 })
          .eq('id', data.id);
      }
    } catch (error: any) {
      console.error('Error fetching workshop page:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!page || !workshop) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Workshop Not Found</h1>
            <p className="text-gray-600">The workshop page you're looking for doesn't exist or is not published.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const services = Array.isArray(page.services_offered) ? page.services_offered : [];
  const galleryImages = Array.isArray(page.gallery_images) ? page.gallery_images : [];
  const businessHours = page.business_hours || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Cover Image */}
      {page.cover_image && (
        <div className="w-full h-64 md:h-96 bg-gray-200 relative">
          <img
            src={page.cover_image}
            alt={workshop.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-6 md:p-8 mb-8 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Profile Image */}
            {page.profile_image && (
              <div className="flex-shrink-0">
                <img
                  src={page.profile_image}
                  alt={workshop.name}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-lg"
                />
              </div>
            )}

            {/* Workshop Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{workshop.name}</h1>
                    {page.is_featured && (
                      <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <MapPin className="w-5 h-5" />
                    <span>{workshop.address}, {workshop.city}, {workshop.state} - {workshop.pincode}</span>
                  </div>
                </div>
              </div>

              {/* Short Description */}
              {page.short_description && (
                <p className="text-gray-700 text-lg mb-4">{page.short_description}</p>
              )}

              {/* Contact Info */}
              <div className="flex flex-wrap gap-4 text-sm">
                {workshop.phone && (
                  <a href={`tel:${workshop.phone}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                    <Phone className="w-4 h-4" />
                    {workshop.phone}
                  </a>
                )}
                {page.whatsapp_number && (
                  <a
                    href={`https://wa.me/${page.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-green-600 hover:text-green-800"
                  >
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </a>
                )}
                {workshop.email && (
                  <a href={`mailto:${workshop.email}`} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                    <Mail className="w-4 h-4" />
                    {workshop.email}
                  </a>
                )}
              </div>

              {/* Social Media */}
              <div className="flex gap-3 mt-4">
                {page.website_url && (
                  <a href={page.website_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600">
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {page.facebook_url && (
                  <a href={page.facebook_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-blue-600">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {page.instagram_url && (
                  <a href={page.instagram_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-pink-600">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {page.youtube_url && (
                  <a href={page.youtube_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-600">
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
                {page.google_maps_url && (
                  <a href={page.google_maps_url} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-red-600">
                    <MapPin className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Full Description */}
            {page.full_description && (
              <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">About Us</h2>
                <div className="prose max-w-none text-gray-700 whitespace-pre-line">
                  {page.full_description}
                </div>
              </div>
            )}

            {/* Services Offered */}
            {services.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Services Offered</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {services.map((service: string, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-gray-700">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{service}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {galleryImages.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Gallery</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {galleryImages.map((imageUrl: string, index: number) => (
                    <div key={index} className="aspect-square rounded-lg overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                        onClick={() => window.open(imageUrl, '_blank')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Business Hours */}
            {Object.keys(businessHours).some(day => businessHours[day]) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Business Hours
                </h3>
                <div className="space-y-2">
                  {Object.entries(businessHours).map(([day, hours]) => {
                    if (!hours) return null;
                    return (
                      <div key={day} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize font-medium">{day}</span>
                        <span className="text-gray-900">{hours as string}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Call to Action */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-md p-6 text-white">
              <h3 className="text-xl font-bold mb-4">Book a Service</h3>
              <p className="text-blue-100 mb-4">Get your vehicle serviced by our expert team</p>
              <a
                href="/book-service"
                className="block w-full text-center bg-white text-blue-600 font-bold py-3 rounded-lg hover:bg-blue-50 transition-colors"
              >
                Book Now
              </a>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Statistics</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Page Views</span>
                  <span className="font-semibold text-gray-900">{page.views_count || 0}</span>
                </div>
                {workshop.audit_score && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Audit Score</span>
                    <span className="font-semibold text-gray-900">{workshop.audit_score}/5</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
