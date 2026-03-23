import type { ElementType } from 'react';

export type GmbReview = {
  author_name: string;
  author_photo: string;
  rating: number;
  text: string;
  time: number;
  relative_time: string;
  reply?: string;
};

export type GmbPhoto = {
  photo_reference: string;
  width: number;
  height: number;
};

export type GmbCategory = {
  name: string;       // gcid:car_repair
  display_name: string;
};

export type GmbServiceItem = {
  display_name: string;
  description?: string;
  price?: string;
};

export type GmbAttribute = {
  name: string;
  display_name?: string;
  values: (string | boolean | number)[];
};

export type GmbSpecialHour = {
  date: string;        // YYYY-MM-DD
  closed: boolean;
  open_time?: string;
  close_time?: string;
};

export type GmbData = {
  // Core identifiers
  place_id?: string;
  gmb_location_name?: string;
  // Business info
  business_name?: string;
  description?: string;
  formatted_address?: string;
  latlng?: { lat: number; lng: number } | null;
  // Contact
  phone_number?: string;
  international_phone?: string;
  website?: string;
  google_maps_uri?: string;
  // Ratings & reviews
  rating?: number | null;
  total_reviews?: number;
  reviews?: GmbReview[];
  // Hours
  opening_hours?: string[];
  special_hours?: GmbSpecialHour[];
  open_status?: string;           // OPEN | CLOSED_PERMANENTLY | CLOSED_TEMPORARILY
  // Categories & services
  primary_category?: GmbCategory | null;
  additional_categories?: GmbCategory[];
  service_items?: GmbServiceItem[];
  // Attributes (parking, wifi, etc.)
  attributes?: GmbAttribute[];
  // Photos
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
