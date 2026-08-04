export type FooterWorkshopLocation = {
  slug: string;
  label: string;
  /** Shown in the smaller "Popular Service Areas" column */
  popular?: boolean;
};

export const FOOTER_WORKSHOP_LOCATIONS: FooterWorkshopLocation[] = [
  { slug: 'my-fng-best-car-service-and-repairs-in-thane', label: 'Car Service in Vartak Nagar', popular: true },
  { slug: 'my-fng-car-service-and-repairs-in-manpada-thane', label: 'Car Service in Manpada', popular: true },
  { slug: 'my-fng-best-car-service-and-repairs-in-majiwada-thane-west', label: 'Car Service in Majiwada', popular: true },
  { slug: 'my-fng-car-service-and-repairs-in-dombivli', label: 'Car Service in Dombivli East', popular: true },
  { slug: 'my-fng-best-car-service-and-repairs-in-kasarvadavali-thane-west', label: 'Car Service in Kasarvadavali' },
  { slug: 'my-fng-car-service-and-repairs-in-manpada-gb-road-thane-west', label: 'Car Service in Ghodbunder Road' },
  { slug: 'my-fng-best-car-service-and-repairs-in-kolegaon-dombivli-east', label: 'Car Service in Kolegaon, Dombivli' },
  { slug: 'my-fng-best-car-service-and-repairs-chikanghar-kalyan-west', label: 'Car Service in Kalyan West' },
  { slug: 'my-fng-car-service-and-repairs-in-badlapur', label: 'Car Service in Badlapur' },
  { slug: 'my-fng-car-service-and-repairs-in-titwala', label: 'Car Service in Titwala' },
  { slug: 'my-fng-best-car-service-and-repairs-in-ramdev-park-mira-road-east', label: 'Car Service in Mira Road East' },
  { slug: 'my-fng-best-car-service-and-repairs-in-koparkhairane-navi-mumbai', label: 'Car Service in Koparkhairane' },
  { slug: 'my-fng-car-service-and-repairs-in-vasai-west', label: 'Car Service in Vasai West' },
  { slug: 'my-fng-car-service-and-repairs-in-vasai-east', label: 'Car Service in Vasai East' },
  { slug: 'my-fng-car-service-and-repairs-in-virar-west', label: 'Car Service in Virar West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-palghar', label: 'Car Service in Palghar' },
  { slug: 'my-fng-car-service-and-repairs-in-marol-andheri-east', label: 'Car Service in Andheri East' },
  { slug: 'my-fng-best-car-service-and-repairs-in-jankalyan-nagar-malad-west', label: 'Car Service in Malad West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-moti-nagar-mulund-west', label: 'Car Service in Mulund West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-ambedkar-nagar-dadar-west', label: 'Car Service in Dadar West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-mahalaxmi-mumbai', label: 'Car Service in Mahalaxmi' },
  { slug: 'my-fng-best-car-service-and-repairs-in-milind-nagar-ghatkopar-west', label: 'Car Service in Ghatkopar West' },
  { slug: 'my-fng-car-service-and-repairs-in-sector-15-panvel', label: 'Car Service in Panvel' },
  { slug: 'my-fng-best-car-service-and-repairs-in-kalamboli', label: 'Car Service in Kalamboli' },
  { slug: 'my-fng-car-service-and-repairs-in-khopoli', label: 'Car Service in Khopoli' },
  { slug: 'my-fng-best-car-service-and-repairs-in-kandarpada-dahisar-west', label: 'Car Service in Dahisar West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-charkop-kandivali-west', label: 'Car Service in Kandivali West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-borivali-west', label: 'Car Service in Borivali West' },
  { slug: 'my-fng-best-car-service-and-repairs-in-mahul-chembur', label: 'Car Service in Chembur' },
  { slug: 'my-fng-best-car-service-and-repairs-in-mira-road-east', label: 'Car Service in Miragaon, Mira Road' },
  { slug: 'my-fng-best-car-service-and-repairs-in-shiravane-nerul', label: 'Car Service in Shiravane, Nerul' },
  { slug: 'my-fng-best-car-service-and-repairs-in-ashoka-nagar-kharadi-pune', label: 'Car Service in Kharadi, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-saswad-pune', label: 'Car Service in Saswad, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-pimple-saudagar-pimpri-chinchwad', label: 'Car Service in Pimple Saudagar' },
  { slug: 'my-fng-best-car-service-and-repairs-in-baner-pune', label: 'Car Service in Baner, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-wagholi-pune', label: 'Car Service in Wagholi, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-katraj-pune', label: 'Car Service in Katraj, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-vimanagar-pune', label: 'Car Service in Vimanagar, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-wakad-pune', label: 'Car Service in Wakad, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-tathawade-pune', label: 'Car Service in Tathawade, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-hadapsar-pune', label: 'Car Service in Hadapsar, Pune' },
  { slug: 'my-fng-best-car-service-and-repairs-in-pathardi-phata-nashik', label: 'Car Service in Pathardi Phata, Nashik' },
];

export type FooterWorkshopLink = {
  href: string;
  label: string;
};

export function footerLocationsToLinks(locations: FooterWorkshopLocation[]): FooterWorkshopLink[] {
  return locations.map((loc) => ({
    href: `/workshop/${loc.slug}`,
    label: loc.label,
  }));
}

export function filterFooterLocationsByPublishedSlugs(
  publishedSlugs: Iterable<string>,
): { locations: FooterWorkshopLink[]; popular: FooterWorkshopLink[] } {
  const published = new Set(publishedSlugs);
  const filtered = FOOTER_WORKSHOP_LOCATIONS.filter((loc) => published.has(loc.slug));
  return {
    locations: footerLocationsToLinks(filtered),
    popular: footerLocationsToLinks(filtered.filter((loc) => loc.popular)),
  };
}
