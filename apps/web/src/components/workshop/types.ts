import type { ElementType } from 'react';

export type WorkshopPublicPage = {
  cover_image?: string | null;
  profile_image?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  services_offered?: string[] | null;
  gallery_images?: string[] | null;
  business_hours?: Record<string, string> | null;
  is_featured?: boolean | null;
  website_url?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  youtube_url?: string | null;
  google_maps_url?: string | null;
  views_count?: number | null;
};

export type Workshop = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  audit_score?: number | null;
};

export type ContactLink = {
  href: string;
  label: string;
  icon: ElementType;
  className?: string;
  target?: string;
  rel?: string;
};
