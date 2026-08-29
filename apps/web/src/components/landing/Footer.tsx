'use client';

import { useState, useEffect, useRef } from 'react';
import TrackedLink from '@/components/tracking/TrackedLink';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';
import { POPULAR_BRAND_PAGES } from '@/lib/popular-brands';
import {
  DEFAULT_APP_STORE_URL,
  DEFAULT_PLAY_STORE_URL,
} from '@/lib/mobile-app-version-config';
import type { FooterWorkshopLink } from '@/lib/workshop/footer-locations';

const ctaTitles = [
  "Serious Car Owners Don't Postpone Maintenance.",
  "Your Car Deserves Expert Care – Not Guesswork.",
  "Avoid Expensive Repairs. Service On Time.",
  "Mumbai & Pune's Trusted Multi-Brand Car Service.",
];

export default function Footer() {
  const [ctaIndex, setCtaIndex] = useState(0);
  const [ctaFading, setCtaFading] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  const [footerPhone, setFooterPhone] = useState('');
  const [popularWorkshopLinks, setPopularWorkshopLinks] = useState<FooterWorkshopLink[]>([]);
  const [allWorkshopLinks, setAllWorkshopLinks] = useState<FooterWorkshopLink[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/public/workshop-footer-locations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setPopularWorkshopLinks(Array.isArray(data.popular) ? data.popular : []);
        setAllWorkshopLinks(Array.isArray(data.locations) ? data.locations : []);
      })
      .catch(() => {
        if (!cancelled) {
          setPopularWorkshopLinks([]);
          setAllWorkshopLinks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCtaFading(true);
      setTimeout(() => {
        setCtaIndex((prev) => (prev + 1) % ctaTitles.length);
        setCtaFading(false);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleSection = (id: string) => {
    if (!isMobile) return;
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isOpen = (id: string) => openSections.has(id);

  const AccordionTitle = ({ id, children, size }: { id: string; children: React.ReactNode; size?: string }) => (
    <h4
      onClick={() => toggleSection(id)}
      className={`text-white ${size || 'text-[14px]'} uppercase tracking-[1px] mb-5 font-semibold ${
        isMobile ? 'cursor-pointer relative pr-5' : ''
      }`}
      style={isMobile ? { marginBottom: isOpen(id) ? '20px' : '0px' } : {}}
    >
      {children}
      {isMobile && (
        <span className="absolute right-0 top-0 transition-all duration-300">
          {isOpen(id) ? '−' : '+'}
        </span>
      )}
    </h4>
  );

  const listClass = (id: string) =>
    isMobile
      ? `list-none p-0 m-0 overflow-hidden transition-all duration-400 ${isOpen(id) ? 'max-h-[1000px]' : 'max-h-0'}`
      : 'list-none p-0 m-0';

  const locationGridClass = (id: string) =>
    isMobile
      ? `overflow-hidden transition-all duration-400 ${isOpen(id) ? 'max-h-[2000px]' : 'max-h-0'}`
      : '';

  return (
    <>
      {/* GRADIENT CTA SECTION */}
      <section
        className="py-[10px] px-5 pb-[35px] text-center text-white relative overflow-hidden"
        style={{
          background: '#023d95',
          backgroundSize: '400% 400%',
          animation: 'gradientMove 12s ease infinite',
        }}
      >
        <div className="max-w-[900px] mx-auto">
          <h2
            className="text-[28px] md:text-[32px] font-extrabold text-white mb-4 transition-opacity duration-300"
            style={{ opacity: ctaFading ? 0 : 1 }}
          >
            {ctaTitles[ctaIndex]}
          </h2>
          <p className="text-[16px] md:text-[18px] opacity-90 mb-9 leading-relaxed">
            Book your car service today with My FNG – Transparent pricing, expert technicians,
            <br className="hidden md:inline" /> and reliable car care across Mumbai &amp; Pune.
          </p>
          <div className="flex justify-center gap-5 flex-wrap">
            <TrackedLink
              href="/book-service"
              className="py-[14px] px-[30px] text-[16px] font-semibold rounded-lg bg-[#f97316] text-white hover:bg-[#ea580c] hover:-translate-y-[3px] transition-all duration-300 no-underline"
            >
              🚗 Book Car Service Now
            </TrackedLink>
            <TrackedLink
              href="/misa-ai"
              className="py-[14px] px-[30px] text-[16px] font-semibold rounded-lg border-2 border-white text-white bg-transparent hover:bg-white hover:text-[#0f172a] transition-all duration-300 no-underline"
            >
              🤖 Book via MISA AI
            </TrackedLink>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="text-[#d6d6d6] pt-[10px]" style={{ background: '#0088e8' }}>
        <div className="w-[92%] max-w-[1500px] mx-auto">

          {/* TOP GRID */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-0 md:gap-10 pb-4 border-b border-white/[0.08]"
            style={isMobile ? { gap: 0, paddingBottom: 0 } : {}}
          >
            {/* Quick Links */}
            <div className={isMobile ? 'border-b border-white/[0.08] py-0 mb-[15px]' : ''}>
              <AccordionTitle id="quick-links">Quick Links</AccordionTitle>
              <ul className={listClass('quick-links')}>
                {[
                  { href: '/about-us', label: 'About Us' },
                  { href: '/blogs', label: 'Our Blogs' },
                  { href: '/contact-us', label: 'Contact Us' },
                  { href: '/privacy-policy', label: 'Privacy Policy' },
                  { href: '/privacy-notice', label: 'Privacy Notice (DPDP)' },
                  { href: '/data-rights', label: 'Data Rights' },
                  { href: '/terms-and-conditions', label: 'Terms & Conditions' },
                  { href: '/workshop-locator', label: 'Workshop Locator' },
                  { href: '/car-loan', label: 'Car Loan' },
                  { href: '/faqs', label: 'FAQs' },
                  { href: '/car-roadside-assistance', label: 'Roadside Assistance' },
                ].map((item) => (
                  <li key={item.href} className="mb-0">
                    <TrackedLink
                      href={item.href}
                      className="text-white text-[11px] font-bold no-underline hover:text-white hover:pl-1.5 transition-all duration-300"
                    >
                      {item.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Our Services */}
            <div className={isMobile ? 'border-b border-white/[0.08] py-0 mb-[15px]' : ''}>
              <AccordionTitle id="services">Our Services</AccordionTitle>
              <ul className={listClass('services')}>
                {DEFAULT_SERVICES.map((s) => ({
                  href: `/car-services/${INTERNAL_SLUG_TO_MARKETING[s.slug] ?? s.slug}`,
                  label: s.title,
                })).map((item) => (
                  <li key={item.href} className="mb-0">
                    <TrackedLink
                      href={item.href}
                      className="text-white text-[11px] font-bold no-underline hover:text-white hover:pl-1.5 transition-all duration-300"
                    >
                      {item.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Luxury Brands */}
            <div className={isMobile ? 'border-b border-white/[0.08] py-0 mb-[15px]' : ''}>
              <AccordionTitle id="luxury-brands">Luxury Brands</AccordionTitle>
              <ul className={listClass('luxury-brands')}>
                {[
                  'Mercedes', 'BMW', 'Audi', 'Jaguar', 'Land Rover',
                  'Porsche', 'Rolls Royce', 'Mitsubishi', 'Volvo',
                ].map((brand) => (
                  <li key={brand} className="mb-0">
                    <span className="text-white text-[11px] font-bold">{brand}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Popular Brands */}
            <div className={isMobile ? 'border-b border-white/[0.08] py-0 mb-[15px]' : ''}>
              <AccordionTitle id="popular-brands">Popular Brands</AccordionTitle>
              <ul className={listClass('popular-brands')}>
                {POPULAR_BRAND_PAGES.map((brand) => (
                  <li key={brand.slug} className="mb-0">
                    <TrackedLink
                      href={brand.pagePath}
                      className="text-white text-[11px] font-bold no-underline hover:text-white hover:pl-1.5 transition-all duration-300"
                    >
                      {brand.name}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Popular Service Areas */}
            <div className={isMobile ? 'border-b border-white/[0.08] py-0 mb-[15px]' : ''}>
              <AccordionTitle id="service-areas">Popular Service Areas</AccordionTitle>
              <ul className={listClass('service-areas')}>
                {popularWorkshopLinks.map((item) => (
                  <li key={item.href} className="mb-0">
                    <TrackedLink
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-[11px] font-bold no-underline hover:text-white hover:pl-1.5 transition-all duration-300"
                    >
                      {item.label}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* REMAINING LOCATIONS */}
          <div className={`${isMobile ? 'mt-[15px] border-b border-white/[0.08] py-0 mb-[15px]' : 'mt-4'}`}>
            <AccordionTitle id="all-locations">Trusted Car Service Centers Near You</AccordionTitle>
            <div
              className={`grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 ${locationGridClass('all-locations')}`}
            >
              {allWorkshopLinks.map((loc) => (
                <TrackedLink
                  key={loc.href + loc.label}
                  href={loc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-white text-[10px] font-bold no-underline hover:text-white transition-all duration-300"
                >
                  {loc.label}
                </TrackedLink>
              ))}
            </div>
          </div>

          {/* FOOTER BOTTOM */}
          <div className="mt-5 pt-[30px] border-t border-white/[0.08]">
            <div className="bg-white rounded-2xl px-4 sm:px-6 md:px-8 py-6 sm:py-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10">

                {/* Company Info */}
                <div className="text-center md:text-left">
                  <img
                    src="/logo.png"
                    alt="MyFNG - Multi Brand Car Service"
                    className="w-[150px] h-auto block mb-3 mx-auto md:mx-0"
                  />
                  <p className="text-[11px] leading-[1.7] font-semibold text-gray-700">
                    MY FNG – Your Friendly Neighbourhood Garage.<br />
                    Multi-brand car servicing &amp; repairs across Mumbai &amp; Pune.
                  </p>
                  <p className="text-[11px] leading-[1.7] font-semibold mt-2 text-gray-700">
                    A/309, Centrum Business Square, Road No 16,<br />
                    Wagle Industrial Estate, Thane (W), Thane-400604
                  </p>
                </div>

                {/* Contact Info */}
                <div className="text-center md:text-left">
                  <h4 className="text-gray-900 text-[11px] font-semibold mb-3">Contact Us</h4>
                  <div className="text-[11px] leading-[2] font-semibold text-gray-700">
                    <div><span className="text-blue-800 font-bold">Email:</span> support@myfng.in</div>
                    <div><span className="text-blue-800 font-bold">Car Service:</span> +91-9152307030</div>
                    <div><span className="text-blue-800 font-bold">Roadside Assistance:</span> +91-9152307030</div>
                    <div><span className="text-blue-800 font-bold">Working Days:</span> Monday – Saturday</div>
                    <div><span className="text-blue-800 font-bold">Hours:</span> 09:30 AM - 06:30 PM</div>
                  </div>
                </div>

                {/* App Download */}
                <div className="text-center md:text-left">
                  <h4 className="text-gray-900 text-[11px] font-semibold mb-3">Download MyFNG App</h4>
                  <div className="flex flex-row md:flex-col gap-2.5 justify-center md:justify-start items-center md:items-start flex-wrap">
                    <a href={DEFAULT_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                      <img
                        src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                        alt="Download on Play Store"
                        className="w-[145px] sm:w-[160px] block"
                      />
                    </a>
                    <a href={DEFAULT_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                      <img
                        src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                        alt="Download on App Store"
                        className="w-[145px] sm:w-[160px] block"
                      />
                    </a>
                  </div>
                </div>

                {/* Book Service + Social */}
                <div className="text-center md:text-left">
                  <h4 className="text-gray-900 text-[11px] font-semibold mb-3">Book Service</h4>
                  <div className="flex flex-col gap-3 mt-2.5">
                    <input
                      id="footer-mobile"
                      name="footer-mobile"
                      type="tel"
                      autoComplete="tel"
                      placeholder="Enter your mobile number"
                      value={footerPhone}
                      onChange={(e) => setFooterPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && footerPhone.length === 10) {
                          window.location.href = `/book-service?prefill_phone=${footerPhone}`;
                        }
                      }}
                      className="py-3 px-3.5 rounded-[10px] border border-gray-300 bg-white text-gray-900 text-[13px] outline-none placeholder:text-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href =
                          footerPhone.length >= 10
                            ? `/book-service?prefill_phone=${footerPhone}`
                            : '/book-service';
                      }}
                      className="py-3 rounded-[10px] border-none text-white font-semibold cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_6px_15px_rgba(37,99,235,0.4)] transition-all duration-300"
                      style={{ background: 'linear-gradient(135deg, #1e40af, #2563eb)' }}
                    >
                      Submit
                    </button>
                  </div>

                  {/* Social Icons */}
                  <div className="flex gap-5 mt-2.5 justify-center md:justify-start">
                    <a
                      href="https://www.facebook.com/myfngcarservices"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[30px] h-[30px] rounded-[30%] flex items-center justify-center text-white text-[16px] hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-all duration-300"
                      style={{ background: '#1877F2' }}
                      aria-label="Facebook"
                    >
                      <svg width="14" height="14" viewBox="0 0 320 512" fill="currentColor"><path d="M80 299.3V512H196V299.3h86.5l18-97.8H196V142.2c0-21.1 13-38.2 40.1-38.2H288V18.6S259.1 0 225.4 0C147.3 0 106 39.6 106 111.4v90.1H80v97.8z"/></svg>
                    </a>
                    <a
                      href="https://www.instagram.com/myfngcarservices/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[30px] h-[30px] rounded-[30%] flex items-center justify-center text-white text-[16px] hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-all duration-300"
                      style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}
                      aria-label="Instagram"
                    >
                      <svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor"><path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9S160.5 370.9 224.1 370.9 339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"/></svg>
                    </a>
                    <a
                      href="https://linkedin.com/company/myfngcarservices"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[30px] h-[30px] rounded-[30%] flex items-center justify-center text-white text-[16px] hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-all duration-300"
                      style={{ background: '#0077B5' }}
                      aria-label="LinkedIn"
                    >
                      <svg width="14" height="14" viewBox="0 0 448 512" fill="currentColor"><path d="M100.3 448H7.4V148.9h92.9zM53.8 108.1C24.1 108.1 0 83.5 0 53.8a53.8 53.8 0 0 1 107.6 0c0 29.7-24.1 54.3-53.8 54.3zM447.9 448h-92.7V302.4c0-34.7-.7-79.2-48.3-79.2-48.3 0-55.7 37.7-55.7 76.7V448h-92.8V148.9h89.1v40.8h1.3c12.4-23.5 42.7-48.3 87.9-48.3 94 0 111.3 61.9 111.3 142.3V448z"/></svg>
                    </a>
                    <a
                      href="https://youtube.com/channel/UCil_RltFnCtXeAha5TrNtew/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[30px] h-[30px] rounded-[30%] flex items-center justify-center text-white text-[16px] hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-all duration-300"
                      style={{ background: '#FF0000' }}
                      aria-label="YouTube"
                    >
                      <svg width="14" height="14" viewBox="0 0 576 512" fill="currentColor"><path d="M549.7 124.1c-6.3-23.7-24.8-42.3-48.3-48.6C458.8 64 288 64 288 64S117.2 64 74.6 75.5c-23.5 6.3-42 24.9-48.3 48.6-11.4 42.9-11.4 132.3-11.4 132.3s0 89.4 11.4 132.3c6.3 23.7 24.8 41.5 48.3 47.8C117.2 448 288 448 288 448s170.8 0 213.4-11.5c23.5-6.3 42-24.2 48.3-47.8 11.4-42.9 11.4-132.3 11.4-132.3s0-89.4-11.4-132.3zm-317.5 213.5V175.2l142.7 81.2-142.7 81.2z"/></svg>
                    </a>
                    <a
                      href="https://x.com/myfngcarservice"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-[30px] h-[30px] rounded-[30%] flex items-center justify-center text-white text-[16px] hover:-translate-y-1 hover:scale-110 hover:shadow-[0_6px_18px_rgba(0,0,0,0.3)] transition-all duration-300"
                      style={{ background: '#000000' }}
                      aria-label="X (Twitter)"
                    >
                      <svg width="14" height="14" viewBox="0 0 512 512" fill="currentColor"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172l95.9 126.7L389.2 48zm-24.8 373.8h39.1L151.1 88h-42L364.4 421.8z"/></svg>
                    </a>
                  </div>
                </div>
            </div>
          </div>
          </div>

          {/* Copyright */}
          <div className="py-4 border-t border-white/[0.08] mt-5 text-[11px] text-white/90 space-y-1">
            <p className="font-semibold text-white">Grievance &amp; Data Protection Officer</p>
            <p>
              Nitish Jha ·{' '}
              <a className="underline hover:text-white" href="mailto:cs-reply@myfng.in">
                cs-reply@myfng.in
              </a>
              {' · '}
              <a className="underline hover:text-white" href="tel:+919152307030">
                +91-9152307030
              </a>
            </p>
            <p className="text-white/75">
              A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Maharashtra 400604
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-5 border-t border-white/[0.08] text-[11px] text-[#aaa]">
            <span>© {new Date().getFullYear()} My FNG Autocare Private Limited. All Rights Reserved.</span>
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition-all duration-300"
            >
              Partner Login →
            </a>
          </div>

        </div>
      </footer>

      {/* Keyframe animation for gradient CTA */}
      <style>{`
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </>
  );
}
