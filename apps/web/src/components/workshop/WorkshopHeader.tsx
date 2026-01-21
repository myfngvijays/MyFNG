import { Facebook, Globe, Instagram, MapPin, Star, Youtube } from 'lucide-react';
import type { ContactLink, Workshop, WorkshopPublicPage } from './types';

type WorkshopHeaderProps = {
  page: WorkshopPublicPage;
  workshop: Workshop;
  contactLinks: ContactLink[];
  hasCover: boolean;
};

export default function WorkshopHeader({ page, workshop, contactLinks, hasCover }: WorkshopHeaderProps) {
  const address = [workshop.address, workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ');
  const sectionClassName = hasCover ? '-mt-16 sm:-mt-20 md:-mt-24' : 'mt-6';

  type SocialLink = { href?: string | null; label: string; icon: typeof Globe; className?: string };
  type SocialLinkWithHref = SocialLink & { href: string };

  const rawSocialLinks: SocialLink[] = [
    { href: page.website_url, label: 'Website', icon: Globe, className: 'hover:text-blue-600' },
    { href: page.facebook_url, label: 'Facebook', icon: Facebook, className: 'hover:text-blue-600' },
    { href: page.instagram_url, label: 'Instagram', icon: Instagram, className: 'hover:text-pink-600' },
    { href: page.youtube_url, label: 'YouTube', icon: Youtube, className: 'hover:text-red-600' },
    { href: page.google_maps_url, label: 'Google Maps', icon: MapPin, className: 'hover:text-red-600' },
  ];

  const socialLinks = rawSocialLinks.filter((item): item is SocialLinkWithHref => Boolean(item.href));

  return (
    <section className={`${sectionClassName} relative z-10`}>
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          {page.profile_image && (
            <div className="flex-shrink-0">
              <img
                src={page.profile_image}
                alt={workshop.name || 'Workshop profile'}
                className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-white shadow-lg"
              />
            </div>
          )}

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">{workshop.name}</h1>
              {page.is_featured && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" aria-label="Featured" />}
            </div>

            {address && (
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <MapPin className="w-4 h-4" />
                <span className="text-sm sm:text-base">{address}</span>
              </div>
            )}

            {page.short_description && (
              <p className="text-gray-700 text-base sm:text-lg mb-5">{page.short_description}</p>
            )}

            <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
              {contactLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target={link.target}
                    rel={link.rel}
                    className={`flex items-center gap-2 ${link.className || 'text-gray-600 hover:text-gray-800'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </div>

            {socialLinks.length > 0 && (
              <div className="flex gap-3 mt-5">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-gray-500 transition ${link.className || ''}`}
                      aria-label={link.label}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
