import type { ElementType } from 'react';

export type GmbReview = {
  author_name: string;
  author_photo: string;
  rating: number;
  text: string;
  time: number;
  relative_time: string;
};

export type GmbPhoto = {
  photo_reference: string;
  width: number;
  height: number;
};

export type GmbData = {
  place_id?: string;
  business_name?: string;
  formatted_address?: string;
  rating?: number | null;
  total_reviews?: number;
  reviews?: GmbReview[];
  opening_hours?: string[];
  phone_number?: string;
  international_phone?: string;
  website?: string;
  google_maps_uri?: string;
  photos?: GmbPhoto[];
};

export type WorkshopPublicPage = {
  id?: string | null;
  cover_image?: string | null;
  profile_image?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  services_offered?: string[] | null;
  gallery_images?: string[] | null;
  business_hours?: Record<string, string> | null;
  is_featured?: boolean | null;
  whatsapp_number?: string | null;
  alternate_phone?: string | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  google_maps_url?: string | null;
  views_count?: number | null;
  brands?: WorkshopPublicPageBrand[] | null;
  packages?: WorkshopPublicPagePackage[] | null;
  faqs?: WorkshopPublicPageFaq[] | null;
  gmb_place_id?: string | null;
  gmb_data?: GmbData | null;
  gmb_last_fetched_at?: string | null;
};

export type Workshop = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  audit_score?: number | null;
  public_gmb_url?: string | null;
};

export type WorkshopPublicPageBrand = {
  name: string;
  logo_url: string;
};

export type WorkshopPublicPagePackage = {
  name: string;
  price: string | number | null;
  features: string[] | null;
};

export type WorkshopPublicPageFaq = {
  question: string;
  answer: string;
};

export type ContactLink = {
  href: string;
  label: string;
  icon: ElementType;
  className?: string;
  target?: string;
  rel?: string;
};
