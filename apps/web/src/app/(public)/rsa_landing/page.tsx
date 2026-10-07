'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Footer from '@/components/landing/Footer';
import RSAMembershipPlansCarousel from '@/components/membership/RSAMembershipPlansCarousel';
import MembershipTermsSection from '@/components/membership/MembershipTermsSection';
import { rsaRequestUtm } from '@/lib/rsa/emergencyPages';

const RSA_WHATSAPP = '919594996161';
const RSA_PHONE = '+919152307030';

const RSA_REVIEWS = [
  { text: 'Jumpstart on Eastern Express, Thane. Technician reached in 22 minutes.', name: 'Rahul • Thane • Swift', when: '6 Oct 2026, 9:40 PM' },
  { text: 'Towing from the Mumbai highway was smooth. The car reached the workshop safely.', name: 'Amit • Mumbai • i20', when: '5 Oct 2026, 6:15 PM' },
  { text: 'Night puncture in Pune. Spare was fitted on the spot.', name: 'Sachin • Pune • City', when: '5 Oct 2026, 11:20 PM' },
  { text: 'Accident recovery in Navi Mumbai. The car was loaded carefully.', name: 'Praveen • Navi Mumbai • Creta', when: '4 Oct 2026, 8:05 PM' },
  { text: 'Battery died in a Thane basement. Jumpstart done, no tow needed.', name: 'Mehul • Thane • Baleno', when: '4 Oct 2026, 7:30 AM' },
  { text: 'WagonR stopped near Palghar. Help arrived before I reached office.', name: 'Rohit • Palghar • WagonR', when: '3 Oct 2026, 8:10 AM' },
  { text: 'Rain breakdown in Navi Mumbai. Live tracking matched the arrival.', name: 'Arun • Navi Mumbai • Polo', when: '3 Oct 2026, 4:45 PM' },
  { text: 'Tracked the technician live until he reached Ghodbunder Road.', name: 'Neeraj • Thane • Verna', when: '2 Oct 2026, 1:25 PM' },
  { text: 'Fortuner towed to the workshop without any extra scratches.', name: 'Deepak • Pune • Fortuner', when: '2 Oct 2026, 10:05 AM' },
  { text: 'Late-night support in Andheri. The team stayed on the call till help arrived.', name: 'Ankit • Mumbai • Amaze', when: '1 Oct 2026, 11:50 PM' },
  { text: 'Clear price before the job started. Puncture fixed in about 20 minutes.', name: 'Vivek • Thane • Tiago', when: '1 Oct 2026, 3:15 PM' },
  { text: 'Flat tyre on the way to work. Spare changed in 15 minutes.', name: 'Jay • Navi Mumbai • Nexon', when: '30 Sep 2026, 8:40 AM' },
  { text: 'Early morning jumpstart in Pune. Car started before the school run.', name: 'Sourav • Pune • Alto', when: '29 Sep 2026, 6:55 AM' },
  { text: 'Dispatch kept me updated. Technician was at the spot in half an hour.', name: 'Harsh • Mumbai • Brezza', when: '28 Sep 2026, 5:30 PM' },
  { text: 'Car would not move after a breakdown. Towing was arranged the same hour.', name: 'Rakesh • Thane • XUV300', when: '27 Sep 2026, 2:10 PM' },
  { text: 'Highway towing handled properly. Drop location was exactly where I sent the pin.', name: 'Gagan • Pune • Scorpio', when: '26 Sep 2026, 9:05 PM' },
] as const;

const RSA_FAQS_FALLBACK = [
  {
    question: 'Is MYFNG RSA available 24×7?',
    answer: 'Yes. MYFNG roadside assistance is available 24×7 for emergency support.',
  },
  {
    question: 'Do you provide towing and on-road repairs?',
    answer: 'Yes. We provide towing and minor roadside repairs depending on the issue.',
  },
  {
    question: 'How can I book RSA quickly?',
    answer: 'You can submit the request form or WhatsApp us to get help immediately.',
  },
  {
    question: 'Do you offer live tracking?',
    answer: 'Yes. Live GPS tracking is available to track technician in real-time.',
  },
] as const;

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const form = e.currentTarget;
  const data = new FormData(form);
  const name = String(data.get('name') || 'RSA Customer');
  const phone = data.get('phone') as string;
  const city = String(data.get('city') || 'Not shared');
  const service = data.get('service') as string;
  const location = data.get('location') as string;
  const dropLocationLink = String(data.get('drop_location_link') || '').trim();
  const dropLine = dropLocationLink
    ? `%0ADrop Location (Google Link): ${encodeURIComponent(dropLocationLink)}`
    : '';
  const utmParams = rsaRequestUtm(service || 'roadside-assistance');
  const utmEntries: Array<[string, string | undefined]> = [
    ['UTM Source', utmParams.utm_source],
    ['UTM Medium', utmParams.utm_medium],
    ['UTM Campaign', utmParams.utm_campaign],
    ['UTM Term', utmParams.utm_term],
    ['UTM Content', utmParams.utm_content],
  ];
  const utmLine = utmEntries
    .filter(([, value]) => Boolean(value && value.trim()))
    .map(([label, value]) => `${encodeURIComponent(label)}: ${encodeURIComponent(String(value))}`)
    .join('%0A');
  const utmSection = utmLine ? `%0A%0AUTM Details:%0A${utmLine}` : '';
  const msg = `Hello MYFNG Team,%0A%0AI need Roadside Assistance (RSA).%0A%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0ACity: ${encodeURIComponent(city)}%0AService: ${encodeURIComponent(service)}%0ALocation: ${encodeURIComponent(location)}${dropLine}${utmSection}%0A%0APlease dispatch help ASAP.`;
  window.open(`https://wa.me/${RSA_WHATSAPP}?text=${msg}`, '_blank');
  form.reset();
}

export default function RsaLandingPage() {
  const [locationValue, setLocationValue] = useState('');
  const [locating, setLocating] = useState(false);
  const [selectedRsaService, setSelectedRsaService] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [rsaFaqs, setRsaFaqs] = useState<Array<{ question: string; answer: string }>>([...RSA_FAQS_FALLBACK]);

  useEffect(() => {
    fetch('/api/public/faqs?group=RSA&section=rsa&platform=web', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const items = Array.isArray(json?.items) ? json.items : [];
        if (!items.length) return;
        setRsaFaqs(
          items.map((item: { q?: string; a?: string; question?: string; answer?: string }) => ({
            question: String(item.q || item.question || ''),
            answer: String(item.a || item.answer || ''),
          })).filter((item: { question: string; answer: string }) => item.question && item.answer && !/fuel/i.test(item.question)),
        );
      })
      .catch(() => {});
  }, []);

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    sectionId: 'services' | 'pricing' | 'process' | 'reviews' | 'faq' | 'contact'
  ) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (!section) return;
    const headerOffset = 88;
    const y = section.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    window.history.replaceState(null, '', `#${sectionId}`);
  };

  const handleUseMyLocation = () => {
    if (locating) return;
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      window.alert('Geolocation is not available on this device.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const res = await fetch(
            `/api/location/google-reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
          );
          const data: any = await res.json().catch(() => null);
          const resolved =
            (typeof data?.address === 'string' && data.address.trim()) ||
            (typeof data?.shortLabel === 'string' && data.shortLabel.trim()) ||
            `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setLocationValue(resolved);
        } catch {
          setLocationValue(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        window.alert('Location permission denied. Please allow location access.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
    :root{--bg:#F5F7FA;--text:#142033;--muted:#5c6778;--brand:#023D95;--brand2:#0088E8;--card:#ffffff;--border:#d7e4f5;--shadow:0 18px 50px rgba(2,61,149,.10);--radius:18px;}
    .rsa-landing *{box-sizing:border-box}
    .rsa-landing{scroll-behavior:smooth;margin:0;font-family:"Poppins",system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#142033;background:#F5F7FA;min-height:100vh}
    .rsa-landing a{color:inherit;text-decoration:none}
    .rsa-landing h1,.rsa-landing h2,.rsa-landing h3,.rsa-landing h4,.rsa-landing h5,.rsa-landing h6{color:#023D95}
    .rsa-landing summary{color:#023D95}
    .rsa-landing .price{color:#023D95}
    .rsa-landing select.input{color:#142033}
    .rsa-landing select.input option{color:#142033;background:#fff}
    .rsa-landing .container{max-width:1180px;margin:auto;padding:0 12px}
    .rsa-landing header{position:sticky;top:0;z-index:50;background: rgba(255,255,255,.96);backdrop-filter: blur(14px);border-bottom:1px solid rgba(12,24,52,.12)}
    .rsa-landing .nav{display:flex;align-items:center;justify-content:space-between;padding:8px 0;gap:10px}
    .rsa-landing .brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.3px;text-decoration:none;color:inherit}
    .rsa-landing .brand-logo{height:28px;width:auto;display:block}
    .rsa-landing .nav-links{display:flex;gap:18px;align-items:center;font-size:14px;color:rgba(12,24,52,.72)}
    .rsa-landing .nav-links a:hover{color:#0a3f95}
    .rsa-landing .nav-cta{display:flex;gap:10px;align-items:center}
    .rsa-landing .btn{border:none;background:linear-gradient(135deg,#e11d48,#dc2626);color:#ffffff;padding:10px 14px;border-radius:14px;font-weight:700;font-size:14px;cursor:pointer;transition:.2s ease;display:inline-flex;gap:8px;align-items:center;justify-content:center;white-space:nowrap;box-shadow:0 10px 24px rgba(220,38,38,.22)}
    .rsa-landing .btn:hover{transform: translateY(-1px); filter:brightness(1.05)}
    .rsa-landing .btn.primary{background: linear-gradient(135deg, #0088E8, #023D95);border: none;box-shadow: 0 16px 40px rgba(2,61,149,.22);color:#ffffff}
    .rsa-landing .btn.whatsapp{background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 16px 40px rgba(18,140,126,.28);color:#ffffff}
    .rsa-landing .btn.primary:hover{filter:brightness(1.05)}
    .rsa-landing .btn.small{padding:9px 12px;border-radius:12px;width:130px;font-size:16px}
    .rsa-landing .hero{position:relative;overflow:hidden;padding: 34px 0 28px;background: radial-gradient(620px 420px at 12% 20%, rgba(255,255,255,.16), transparent 70%),linear-gradient(115deg,#023D95 0%,#0357b8 48%,#0088E8 100%)}
    .rsa-landing .hero::before{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(255,255,255,.04),rgba(2,61,149,.12));pointer-events:none}
    .rsa-landing .hero h1,.rsa-landing .hero h3{color:#ffffff}
    .rsa-landing .hero-grid{position:relative;z-index:2;display:grid;grid-template-columns: 1.04fr .96fr;gap:20px;align-items:stretch}
    .rsa-landing .badge{display:inline-flex;gap:8px;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:linear-gradient(135deg,#e11d48,#dc2626);color:#ffffff;font-size:12px;font-weight:600;width:fit-content;box-shadow:0 8px 22px rgba(220,38,38,.28)}
    .rsa-landing .dot{width:8px;height:8px;border-radius:50%;background:#ffffff;box-shadow:0 0 0 4px rgba(255,255,255,.28)}
    .rsa-landing h1{margin:14px 0 10px;font-size:25px;line-height:1.2;letter-spacing:-.3px}
    .rsa-landing .gradient-text{background:none;-webkit-text-fill-color:#d7ecff;color:#d7ecff}
    .rsa-landing .lead{color:rgba(255,255,255,.84);font-size:16px;line-height:1.55;margin:0 0 14px;max-width:590px}
    .rsa-landing .lead-location{display:inline}
    .rsa-landing .chips{display:flex;gap:8px;flex-wrap:wrap;margin: 10px 0 0}
    .rsa-landing .chip{display:inline-flex;gap:7px;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.92);font-size:12px;font-weight:700;color:#023D95}
    .rsa-landing .hero-actions{display:none}
    .rsa-landing .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
    .rsa-landing .stat{border:1px solid #f3b4b4;background:#fff8f8;border-radius:14px;padding:12px;box-shadow:0 0 0 3px rgba(239,68,68,.06)}
    .rsa-landing .stat strong{display:block;font-size:22px;color:#023D95;line-height:1.2}
    .rsa-landing .stat span{color:#5c6778;font-size:12px}
    .rsa-landing .card{border:1px solid #f3b4b4;background:#ffffff;border-radius: 20px;box-shadow: 0 0 0 4px rgba(239,68,68,.08), var(--shadow);padding:16px}
    .rsa-landing .card h3{margin:0 0 4px;font-size:24px;color:#023D95}
    .rsa-landing .hero-copy{display:flex;flex-direction:column;justify-content:center;height:100%}
    .rsa-landing .card p{margin:0 0 12px;color:#5c6778;font-size:13px}
    .rsa-landing .form{display:grid;gap:9px;margin-top:10px}
    .rsa-landing .input{width:100%;padding:11px 12px;border-radius:11px;border:1px solid #f3b4b4;background:#fffafa;color:#142033;outline:none;font-size:13px}
    .rsa-landing .input::placeholder{color:#8aa0b8}
    .rsa-landing .input:focus{border-color:#e11d48;box-shadow:0 0 0 3px rgba(225,29,72,.12)}
    .rsa-landing .form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rsa-landing .location-wrap{position:relative}
    .rsa-landing .location-wrap .input{padding-right:42px}
    .rsa-landing .loc-btn{position:absolute;right:7px;top:7px;height:28px;width:28px;border:1px solid #d7e4f5;border-radius:8px;background:#ffffff;color:#0088E8;font-weight:800;cursor:pointer;box-shadow:0 6px 16px rgba(2,61,149,.12)}
    .rsa-landing .send-btn{border:none;border-radius:11px;padding:12px 14px;background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 16px 40px rgba(18,140,126,.28);font-size:16px;font-weight:800;color:#fffff;cursor:pointer}
    .rsa-landing .send-btn:hover{filter:brightness(1.04)}
    .rsa-landing .note{margin-top:10px;font-size:12px;color:#5c6778}
    .rsa-landing section{padding: 46px 0;background:#F5F7FA}
    .rsa-landing section:nth-of-type(even){background:#ffffff}
    .rsa-landing .section-title{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .rsa-landing .section-title h2{margin:0;font-size:28px;letter-spacing:-.3px;color:#023D95}
    .rsa-landing .section-title p{margin:0;color:#5c6778;max-width:620px}
    .rsa-landing .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing a.feature{display:block;color:inherit;text-decoration:none;transition:transform .15s ease}
    .rsa-landing a.feature:hover{transform:translateY(-2px)}
    .rsa-landing .feature{border:1px solid #f3b4b4;background:#ffffff;border-radius: var(--radius);padding:16px;box-shadow:0 0 0 3px rgba(239,68,68,.07), 0 10px 30px rgba(220,38,38,.06)}
    .rsa-landing .feature .icon{width:42px;height:42px;border-radius:14px;background:#e8f3ff;border:1px solid #d7e4f5;display:grid;place-items:center;margin-bottom:10px;font-weight:900;color:#023D95}
    .rsa-landing .feature h4{margin:0 0 6px;font-size:16px;color:#023D95}
    .rsa-landing .feature p{margin:0;color:#5c6778;font-size:13px;line-height:1.6}
    .rsa-landing .pricing{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .rsa-landing .plan-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
    .rsa-plans-wrap{margin-top:0}
    .rsa-plans-copy{margin-bottom:18px}
    .rsa-plans-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;align-items:stretch}
    .rsa-plans-card{min-width:0}
    .rsa-plans-loading{padding:24px 0;color:#5c6778;font-size:13px;text-align:center}
    .membership-terms-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .membership-terms-list li{display:flex;gap:10px;align-items:flex-start;color:#3d4a5c;font-size:14px;line-height:1.55}
    .membership-terms-list-dark .membership-terms-check{color:#34D399;font-weight:900;flex-shrink:0;margin-top:1px}
    .rsa-landing .plan-card{border:1px solid #d7e4f5;background:#ffffff;border-radius:20px;overflow:hidden;display:flex;flex-direction:column}
    .rsa-landing .plan-card .topline{height:4px;background:linear-gradient(90deg,#023D95,#0088E8)}
    .rsa-landing .plan-card .body{padding:16px;display:flex;flex-direction:column;gap:10px;height:100%}
    .rsa-landing .plan-card h3{margin:0;font-size:18px;color:#023D95}
    .rsa-landing .plan-card .price{font-size:26px;font-weight:900;line-height:1}
    .rsa-landing .plan-card .duration{font-size:12px;font-weight:700;color:#0088E8}
    .rsa-landing .plan-card .list li{font-size:13px}
    .rsa-landing .terms-card{margin-top:16px;border:1px solid #d7e4f5;background:#ffffff;border-radius:18px;padding:16px}
    .rsa-landing .terms-card h4{margin:0 0 8px;color:#023D95}
    .rsa-landing .price-card{border:1px solid #d7e4f5;background:#ffffff;border-radius: 22px;padding:18px;box-shadow:0 10px 30px rgba(2,61,149,.05)}
    .rsa-landing .price-card h3{margin:0 0 8px;color:#023D95}
    .rsa-landing .price{font-size:34px;font-weight:900;letter-spacing:-.5px;margin:10px 0;color:#023D95;line-height: 24px;}
    .rsa-landing .price small{font-size:11px;color:#5c6778;font-weight:700}
    .rsa-landing .list{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:8px}
    .rsa-landing .list li{display:flex;gap:10px;align-items:flex-start;color:#3d4a5c;font-size:14px}
    .rsa-landing .tick{width:18px;height:18px;border-radius:50%;background: rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.35);display:grid;place-items:center;color:#22c55e;flex:0 0 auto;margin-top:2px;font-size:12px;font-weight:900}
    .rsa-landing .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing .step{border:1px solid #d7e4f5;background:#ffffff;border-radius: var(--radius);padding:16px}
    .rsa-landing .step b{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:12px;background:#e8f3ff;border:1px solid #d7e4f5;margin-bottom:10px;color:#023D95;font-weight:900}
    .rsa-landing .step h4{margin:0 0 6px;color:#023D95}
    .rsa-landing .step p{margin:0;color:#5c6778;font-size:13px;line-height:1.6}
    .rsa-landing .testimonials{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .review{border:1px solid #d7e4f5;background:#ffffff;border-radius: var(--radius);padding:16px;min-width:300px}
    .rsa-landing .stars{color:#0088E8;letter-spacing:1px;font-size:14px}
    .rsa-landing .review p{color:#3d4a5c;font-size:13px;line-height:1.7;margin:10px 0 12px}
    .rsa-landing .review strong{display:block;color:#023D95}
    .rsa-landing .review span{display:block;margin-top:4px;color:#5c6778;font-size:12px}
    .rsa-landing details{border:1px solid #d7e4f5;background:#ffffff;border-radius: var(--radius);padding:14px 16px}
    .rsa-landing details + details{margin-top:10px}
    .rsa-landing summary{cursor:pointer;font-weight:700;list-style:none}
    .rsa-landing summary::-webkit-details-marker{display:none}
    .rsa-landing details p{color:#5c6778;font-size:13px;line-height:1.7;margin:10px 0 0}
    .rsa-landing .faq-item{border:1px solid #d7e4f5;background:#ffffff;border-radius: var(--radius);padding:14px 16px}
    .rsa-landing .faq-item + .faq-item{margin-top:10px}
    .rsa-landing .faq-question{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:none;background:transparent;color:#023D95;font-weight:700;text-align:left;cursor:pointer;font-size:15px;padding:0}
    .rsa-landing .faq-answer{color:#5c6778;font-size:15px;line-height:1.7;margin:10px 0 0}
    .rsa-landing .faq-chevron{font-size:12px;opacity:.9;transition:transform .2s ease}
    .rsa-landing .faq-chevron.open{transform:rotate(180deg)}
    .rsa-landing footer{padding: 26px 0;border-top:1px solid #d7e4f5;color:#5c6778;font-size:13px;background:#ffffff}
    .rsa-landing .marquee{overflow:hidden;position:relative}
    .rsa-landing .marquee-track{display:flex;gap:18px;width:max-content;animation:rsa-scroll 70s linear infinite}
    .rsa-landing section[id], .rsa-landing aside[id]{scroll-margin-top:88px}
    @keyframes rsa-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media (min-width: 640px){.rsa-landing .container{padding:0 16px}.rsa-landing .nav{padding:12px 0;gap:12px}.rsa-landing .brand-logo{height:32px}}
    @media (min-width: 768px){.rsa-landing .container{padding:0 24px}.rsa-landing .nav{padding:16px 0}.rsa-landing .brand-logo{height:40px}}
    @media (max-width: 980px){.rsa-landing .hero{padding:24px 0 24px}.rsa-landing .hero-grid{grid-template-columns:1fr;gap:14px}.rsa-landing h1{font-size:32px}.rsa-landing .lead{font-size:16px}.rsa-landing .hero-copy{justify-content:flex-start}.rsa-landing .grid-4{grid-template-columns:repeat(2,1fr)}.rsa-landing .grid-3{grid-template-columns:repeat(2,1fr)}.rsa-landing .steps{grid-template-columns:repeat(2,1fr)}.rsa-landing .pricing{grid-template-columns:1fr}.rsa-landing .plan-grid{grid-template-columns:repeat(2,1fr)}.rsa-plans-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.rsa-landing .testimonials{grid-template-columns:repeat(2,1fr)}.rsa-landing .nav-links{display:none}}
    @media (max-width: 560px){.rsa-landing h1{font-size:32px}.rsa-landing .lead{font-size:15px;line-height:1.5;max-width:100%}.rsa-landing .lead-location{display:inline}.rsa-landing .form-row{grid-template-columns:1fr}.rsa-landing .grid-3,.rsa-landing .plan-grid{grid-template-columns:1fr}.rsa-plans-grid{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.rsa-plans-grid::-webkit-scrollbar{display:none}.rsa-plans-card{flex:0 0 78%;max-width:280px}.rsa-landing .grid-4{grid-template-columns:repeat(2,1fr)}.rsa-landing .steps{grid-template-columns:1fr}.rsa-landing .testimonials{grid-template-columns:1fr}.rsa-landing .stats{grid-template-columns:repeat(2,1fr)}.rsa-landing .stat strong{font-size:24px}.rsa-landing #services .section-title,.rsa-landing #process .section-title{justify-content:center;text-align:center}.rsa-landing #services .section-title h2{font-size:20px;line-height:1.15;letter-spacing:-.6px;white-space:nowrap}.rsa-landing #services .section-title p,.rsa-landing #process .section-title p{margin-left:auto;margin-right:auto}.rsa-landing #services .feature,.rsa-landing #process .step{text-align:center}.rsa-landing #services .feature .icon,.rsa-landing #process .step b{margin-left:auto;margin-right:auto}.rsa-landing .faq-question{font-size:14px}.rsa-landing .faq-answer{font-size:13px}}
  `}} />
      <div className="rsa-landing">
        <header>
          <div className="container">
            <div className="nav">
              <Link href="/" className="brand" aria-label="Go to MyFNG home">
                <img src="/logo.png" alt="MY FNG" className="brand-logo" />
              </Link>
              <nav className="nav-links">
                <a href="#services" onClick={(e) => scrollToSection(e, 'services')}>Services</a>
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')}>Pricing</a>
                <a href="#process" onClick={(e) => scrollToSection(e, 'process')}>Process</a>
                <a href="#reviews" onClick={(e) => scrollToSection(e, 'reviews')}>Reviews</a>
                <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')}>FAQ</a>
                <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact</a>
              </nav>
              <div className="nav-cta">
                <a className="btn small" href={`tel:${RSA_PHONE}`} rel="noopener noreferrer">CALL NOW</a>
              </div>
            </div>
          </div>
        </header>

        <main className="hero">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-copy">
                <div className="badge"><span className="dot" />24×7 Emergency Support • AI-Powered Emergency Dispatch</div>
                <h1>24x7 Car Towing & On-Road Help<br /><span className="gradient-text">Live Tracking Available</span></h1>
                <p className="lead">Car breakdown? Flat tyre? Battery dead? MYFNG roadside assistance connects you with verified technicians in <b>under 30 minutes</b> <span className="lead-location">(subject to location).</span></p>
                <div className="chips">
                  <div className="chip">⏱️ Under 30 Min</div>
                  <div className="chip">🛡️ Trusted Technicians</div>
                  <div className="chip">📍 Live Location Tracking</div>
                  <div className="chip">🛡️ Trusted by 32,000+ Car Owners PAN India</div>
                </div>
              </div>
              <aside className="card" id="contact">
                <h3>Quick RSA Request</h3>
                <p>Share your details. We will connect instantly.</p>
                <form
                  className="form"
                  onSubmit={(e) => {
                    handleSubmit(e);
                    setSelectedRsaService('');
                    setLocationValue('');
                  }}
                >
                  <input type="hidden" name="name" value="RSA Customer" />
                  <input type="hidden" name="city" value="Not shared" />
                  <div className="form-row">
                    <input className="input" type="tel" name="phone" placeholder="Mobile Number" required />
                    <select
                      className="input"
                      name="service"
                      value={selectedRsaService}
                      onChange={(e) => setSelectedRsaService(e.target.value)}
                      required
                    >
                      <option value="">Select Service</option>
                      <option>Jump Start</option>
                      <option>Towing Service</option>
                      <option>Flat Tyre Fix</option>
                      <option>Minor Repair</option>
                      <option>Accident Support</option>
                    </select>
                  </div>
                  <div className="location-wrap">
                    <input
                      className="input"
                      type="text"
                      name="location"
                      placeholder="Current Location / Landmark"
                      value={locationValue}
                      onChange={(e) => setLocationValue(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="loc-btn"
                      aria-label="Use my location"
                      onClick={handleUseMyLocation}
                      disabled={locating}
                      title={locating ? 'Detecting location...' : 'Use current location'}
                    >
                      {locating ? '…' : '📍'}
                    </button>
                  </div>
                  {selectedRsaService === 'Towing Service' ? (
                    <input
                      className="input"
                      type="url"
                      name="drop_location_link"
                      placeholder="Drop Location Google Link (Optional)"
                    />
                  ) : null}
                  <button className="send-btn" type="submit">🚨 Send Help on WhatsApp</button>
                  <div className="stats">
                    <div className="stat"><strong>24×7</strong><span>Emergency Assistance</span></div>
                    <div className="stat"><strong>30 Min</strong><span>Avg Dispatch Time</span></div>
                    <div className="stat"><strong>Live GPS</strong><span>Track Technician</span></div>
                    <div className="stat"><strong>52000+</strong><span>Rescues Done</span></div>
                  </div>
                </form>
              </aside>
            </div>
          </div>
        </main>

        <section id="services">
          <div className="container">
            <div className="section-title"><div><h2>Roadside Assistance Services</h2><p>Quick on‑road solutions for every car emergency.</p></div></div>
            <div className="grid-4">
              <Link className="feature" href="/car-roadside-assistance/battery-jumpstart"><div className="icon">⚡</div><h4>Battery Jumpstart</h4><p>ETA: 10-30 Min</p><p>Instant battery start at your location.</p></Link>
              <Link className="feature" href="/car-roadside-assistance/car-towing"><div className="icon">🚗</div><h4>Car Towing Services</h4><p>ETA: 20-30 Min</p><p>Safe towing to nearest workshop.</p></Link>
              <Link className="feature" href="/car-roadside-assistance/car-towing#accident"><div className="icon">🧯</div><h4>Accidental Car Towing</h4><p>ETA: 30-35 Min</p><p>Accident vehicle recovery & transport.</p></Link>
              <a className="feature" href="#contact"><div className="icon">🛠</div><h4>Roadside Assistance</h4><p>ETA: 10-20 Min</p><p>Minor on‑road repairs support.</p></a>
              <a className="feature" href="#contact"><div className="icon">📍</div><h4>Car Tracking Services</h4><p>ETA: 20-30 Min</p><p>Live location and tracking support.</p></a>
              <Link className="feature" href="/car-services/periodic-car-service"><div className="icon">🧰</div><h4>Periodic Car Service</h4><p>ETA: 60 Secs</p><p>Book periodic maintenance booking in Seconds.</p></Link>
              <Link className="feature" href="/car-roadside-assistance/flat-tyre"><div className="icon">🛞</div><h4>Flat Tyre Assistance</h4><p>ETA: 15-30 Min</p><p>Tyre change or puncture fix instantly.</p></Link>
            </div>
          </div>
        </section>

        <section id="pricing">
          <div className="container">
            <div className="section-title">
              <div>
                <h2>Pricing</h2>
                <p>Clear and affordable pricing. Exact cost depends on location, vehicle type and distance.</p>
              </div>
            </div>

            <div className="pricing">
              <div className="price-card">
                <h3>Towing</h3>
                <div className="price">₹25/km <small>onwards</small> <br /><small>Base charge covers first dispatch &amp; loading. Distance charges applicable after minimum km.</small></div>
                <ul className="list">
                  <li>
                    <span className="tick">✓</span>
                    <span>Safe towing with proper equipment</span>
                  </li>
                  <li>
                    <span className="tick">✓</span>
                    <span>Pickup from breakdown spot</span>
                  </li>
                  <li>
                    <span className="tick">✓</span>
                    <span>Drop to nearest service location</span>
                  </li>
                </ul>
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <a
                    className="btn"
                    href={`tel:${RSA_PHONE}`}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#e11d48,#dc2626)', border: 'none', color: '#ffffff', justifyContent: 'center' }}
                  >
                    📞 Call Now
                  </a>
                  <a
                    className="btn whatsapp"
                    href={`https://wa.me/${RSA_WHATSAPP}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    💬 WhatsApp
                  </a>
                </div>
              </div>

              <div className="price-card">
                <h3>RSA Support</h3>
                <div className="price">
                  On Demand <small>as per service</small> <br /><small>Final pricing may vary based on your location, vehicle type and service requirement.</small>
                </div>
                <ul className="list">
                  <li>
                    <span className="tick">✓</span>
                    <span>Jumpstart, puncture &amp; minor fixes</span>
                  </li>
                  <li>
                    <span className="tick">✓</span>
                    <span>AI-powered emergency dispatch</span>
                  </li>
                  <li>
                    <span className="tick">✓</span>
                    <span>24×7 customer support</span>
                  </li>
                </ul>
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <a
                    className="btn"
                    href={`tel:${RSA_PHONE}`}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#e11d48,#dc2626)', border: 'none', color: '#ffffff', justifyContent: 'center' }}
                  >
                    📞 Call Now
                  </a>
                  <a
                    className="btn whatsapp"
                    href={`https://wa.me/${RSA_WHATSAPP}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    💬 WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="process">
          <div className="container">
            <div className="section-title"><div><h2>How It Works</h2><p>Get emergency support in 4 simple steps.</p></div></div>
            <div className="steps">
              <div className="step"><b>1</b><h4>Raise Request</h4><p>Call/WhatsApp and share your issue & location.</p></div>
              <div className="step"><b>2</b><h4>AI Dispatch</h4><p>We assign nearest available technician instantly.</p></div>
              <div className="step"><b>3</b><h4>Get Help</h4><p>Repair on-site or tow your vehicle safely if needed.</p></div>
              <div className="step"><b>4</b><h4>Done</h4><p>Service completed and confirmation shared with you.</p></div>
            </div>
          </div>
        </section>

        <section id="reviews">
          <div className="container">
            <div className="section-title"><div><h2>Reviews</h2><p>Trusted by customers for quick response and professional roadside support.</p></div></div>
            <div className="marquee">
              <div className="marquee-track">
                {[0, 1].map((copy) =>
                  RSA_REVIEWS.map((review) => (
                    <div className="review" key={`${copy}-${review.when}`}>
                      <div className="stars">★★★★★</div>
                      <p>{review.text}</p>
                      <strong>{review.name}</strong>
                      <span>{review.when}</span>
                    </div>
                  )),
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="plans">
          <div className="container">
            <RSAMembershipPlansCarousel />
          </div>
        </section>

        <section id="terms">
          <div className="container">
            <div className="section-title">
              <div>
                <h2>Terms &amp; Conditions</h2>
              </div>
            </div>
            <div className="terms-card" style={{ marginTop: 0 }}>
              <MembershipTermsSection membershipType="RSA" />
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="container">
            <div className="section-title"><div><h2>FAQs</h2><p>Frequently asked questions about MYFNG Roadside Assistance.</p></div></div>
            {rsaFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={faq.question} className="faq-item">
                  <button
                    type="button"
                    className="faq-question"
                    onClick={() => setOpenFaqIndex((prev) => (prev === idx ? null : idx))}
                  >
                    <span>{faq.question}</span>
                    <span className={`faq-chevron ${isOpen ? 'open' : ''}`}>⌄</span>
                  </button>
                  {isOpen ? <p className="faq-answer">{faq.answer}</p> : null}
                </div>
              );
            })}
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}
