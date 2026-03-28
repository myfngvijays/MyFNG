'use client';

import React, { useState } from 'react';
import Footer from '@/components/landing/Footer';
import { getCurrentOrStoredUtmParams } from '@/lib/utm';

const RSA_WHATSAPP = '919594996161';
const RSA_SUBSCRIPTION_PLANS = [
  {
    key: 'basic',
    title: 'Basic Plan',
    price: 999,
    durationLabel: '1 Year / 2 Service',
    features: [
      'Flat tyre Assistance',
      'Battery Jumpstart',
      'Towing',
      'On spot minor repairs',
      'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
    ],
  },
  {
    key: 'standard',
    title: 'Standard',
    price: 2999,
    durationLabel: '5 Years / 10 Service',
    features: [
      'Flat tyre Assistance',
      'Battery Jumpstart',
      'Towing',
      'On spot minor repairs',
      'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
    ],
  },
  {
    key: 'ultimate',
    title: 'Ultimate',
    price: 4999,
    durationLabel: '15 Years / 30 Services',
    features: [
      'Flat tyre Assistance',
      'Battery Jumpstart',
      'Towing',
      'On spot minor repairs',
      'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
    ],
  },
  {
    key: 'family',
    title: 'Family',
    price: 9990,
    durationLabel: '15 Years / 50 Services',
    features: [
      'Upto 3 Vehicles',
      'Flat tyre Assistance',
      'Battery Jumpstart',
      'Towing',
      'Key Unlock Assistance in unlocking your vehicle if keys are misplaced',
    ],
  },
  {
    key: 'premium',
    title: 'Premium',
    price: 9990,
    durationLabel: '1 Year / Unlimited Service - 20% OFF',
    features: [
      'No capping on free services',
      '1 Night Hotel Accommodation',
      'Cab Arrangement (Free up to 50 km)',
      'No capping on free services',
    ],
  },
] as const;

const RSA_PLAN_TERMS = [
  'Members are entitled to 2 free RSA services per year under all plans, excluding the Premium Plan.',
  "Towing distance is calculated on a round-trip basis (from the service provider’s location to the vehicle’s location and then to the destination).",
  'Key Unlock Assistance is subject to the type of lock system used in the vehicle.',
  'On-Spot Minor Repairs are limited to small fixes that can be completed without requiring extensive tools or garage equipment.',
  'Hotel accommodation is subject to availability and limited to one night.',
  'Cab arrangement is limited to 50 km and additional charges may apply for distances exceeding this limit.',
  'Ambulance service is provided in case of accidents only and is subject to availability.',
] as const;

const RSA_FAQS = [
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
  const utmParams = getCurrentOrStoredUtmParams();
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
    :root{--bg:#0b1220;--text:#ffffff;--muted:rgba(255,255,255,.72);--brand:#ff4d2e;--brand2:#ff8a00;--card: rgba(255,255,255,.06);--border: rgba(255,255,255,.12);--shadow: 0 18px 60px rgba(0,0,0,.35);--radius: 18px;}
    .rsa-landing *{box-sizing:border-box}
    .rsa-landing{scroll-behavior:smooth;margin:0;font-family:"Poppins",system-ui,-apple-system,Segoe UI,Roboto,Arial;color:#ffffff;background:#070b14;min-height:100vh}
    .rsa-landing a{color:inherit;text-decoration:none}
    .rsa-landing h1,.rsa-landing h2,.rsa-landing h3,.rsa-landing h4,.rsa-landing h5,.rsa-landing h6{color:#ffffff}
    .rsa-landing summary{color:#ffffff}
    .rsa-landing .price{color:#ffffff}
    .rsa-landing select.input{color:#ffffff}
    .rsa-landing select.input option{color:#1a1a1a;background:#fff}
    .rsa-landing .container{max-width:1180px;margin:auto;padding:0 12px}
    .rsa-landing header{position:sticky;top:0;z-index:50;background: rgba(255,255,255,.96);backdrop-filter: blur(14px);border-bottom:1px solid rgba(12,24,52,.12)}
    .rsa-landing .nav{display:flex;align-items:center;justify-content:space-between;padding:8px 0;gap:10px}
    .rsa-landing .brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.3px}
    .rsa-landing .brand-logo{height:28px;width:auto;display:block}
    .rsa-landing .nav-links{display:flex;gap:18px;align-items:center;font-size:14px;color:rgba(12,24,52,.72)}
    .rsa-landing .nav-links a:hover{color:#0a3f95}
    .rsa-landing .nav-cta{display:flex;gap:10px;align-items:center}
    .rsa-landing .btn{border:1px solid var(--border);background: rgba(204,41,0,1);color:#00000;padding:10px 14px;border-radius:14px;font-weight:700;font-size:14px;cursor:pointer;transition:.2s ease;display:inline-flex;gap:8px;align-items:center;justify-content:center;white-space:nowrap}
    .rsa-landing .btn:hover{transform: translateY(-1px); background: rgba(0,0,0)}
    .rsa-landing .btn.primary{background: linear-gradient(135deg, var(--brand2), var(--brand));border: none;box-shadow: 0 16px 40px rgba(255,77,46,.22);color:#2a0a07}
    .rsa-landing .btn.whatsapp{background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 16px 40px rgba(18,140,126,.28);color:#ffffff}
    .rsa-landing .btn.primary:hover{filter:brightness(1.05)}
    .rsa-landing .btn.small{padding:9px 12px;border-radius:12px;width:130px;font-size:16px}
    .rsa-landing .hero{position:relative;overflow:hidden;padding: 34px 0 28px;background: radial-gradient(600px 420px at 12% 25%, rgba(246, 84, 22, 0.24), transparent 70%),radial-gradient(560px 400px at 78% 40%, rgba(145, 26, 18, 0.26), transparent 75%),linear-gradient(110deg,#571008 0%,#63140a 34%,#6f180d 58%,#7d1b12 100%)}
    .rsa-landing .hero::before{content:"";position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.04),rgba(0,0,0,.18));pointer-events:none}
    .rsa-landing .hero-grid{position:relative;z-index:2;display:grid;grid-template-columns: 1.04fr .96fr;gap:20px;align-items:stretch}
    .rsa-landing .badge{display:inline-flex;gap:8px;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(0,0,0,.18);color:rgba(255,255,255,.84);font-size:12px;font-weight:600;width:fit-content}
    .rsa-landing .dot{width:8px;height:8px;border-radius:50%;background:#ff6a46;box-shadow:0 0 0 4px rgba(255,106,70,.18)}
    .rsa-landing h1{margin:14px 0 10px;font-size:25px;line-height:1.2;letter-spacing:-.3px}
    .rsa-landing .gradient-text{background: linear-gradient(135deg,#ffa037,#ff6f2f 55%,#ff4d2e);-webkit-background-clip:text;background-clip:text;color:transparent}
    .rsa-landing .lead{color:rgba(255,255,255,.84);font-size:16px;line-height:1.55;margin:0 0 14px;max-width:590px}
    .rsa-landing .lead-location{display:inline}
    .rsa-landing .chips{display:flex;gap:8px;flex-wrap:wrap;margin: 10px 0 0}
    .rsa-landing .chip{display:inline-flex;gap:7px;align-items:center;padding:7px 12px;border-radius:999px;border:1px solid rgba(0,0,0);background:rgba(255,255,255);font-size:12px;font-weight:700;color:rgba(0,0,0)}
    .rsa-landing .hero-actions{display:none}
    .rsa-landing .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}
    .rsa-landing .stat{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);border-radius:14px;padding:12px}
    .rsa-landing .stat strong{display:block;font-size:22px;color:#ffffff;line-height:1.2}
    .rsa-landing .stat span{color:rgba(255,255,255,.68);font-size:12px}
    .rsa-landing .card{border:1px solid rgba(255,255,255,.11);background: linear-gradient(180deg,#11192f 0%,#0f1629 100%);border-radius: 20px;box-shadow: var(--shadow);padding:16px}
    .rsa-landing .card h3{margin:0 0 4px;font-size:24px;color:#ffffff}
    .rsa-landing .hero-copy{display:flex;flex-direction:column;justify-content:center;height:100%}
    .rsa-landing .card p{margin:0 0 12px;color:rgba(255,255,255,.68);font-size:13px}
    .rsa-landing .form{display:grid;gap:9px;margin-top:10px}
    .rsa-landing .input{width:100%;padding:11px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.09);background: rgba(255,255,255,.04);color:#ffffff;outline:none;font-size:13px}
    .rsa-landing .input::placeholder{color:rgba(255,255,255,.5)}
    .rsa-landing .input:focus{border-color: rgba(255,127,50,.8)}
    .rsa-landing .form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .rsa-landing .location-wrap{position:relative}
    .rsa-landing .location-wrap .input{padding-right:42px}
    .rsa-landing .loc-btn{position:absolute;right:7px;top:7px;height:28px;width:28px;border:1px solid rgba(255,255,255,.92);border-radius:8px;background:#ffffff;color:#ff4d2e;font-weight:800;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.2)}
    .rsa-landing .send-btn{border:none;border-radius:11px;padding:12px 14px;background:linear-gradient(135deg,#25D366,#128C7E);box-shadow:0 16px 40px rgba(18,140,126,.28);font-size:16px;font-weight:800;color:#fffff;cursor:pointer}
    .rsa-landing .send-btn:hover{filter:brightness(1.04)}
    .rsa-landing .note{margin-top:10px;font-size:12px;color:rgba(255,255,255,.70)}
    .rsa-landing section{padding: 46px 0;background:#070b14}
    .rsa-landing .section-title{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .rsa-landing .section-title h2{margin:0;font-size:28px;letter-spacing:-.3px;color:#ffffff}
    .rsa-landing .section-title p{margin:0;color:rgba(255,255,255,.68);max-width:620px}
    .rsa-landing .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .grid-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing .feature{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px}
    .rsa-landing .feature .icon{width:42px;height:42px;border-radius:14px;background: rgba(255,138,0,.16);border:1px solid rgba(255,138,0,.25);display:grid;place-items:center;margin-bottom:10px;font-weight:900;color:#ffb86b}
    .rsa-landing .feature h4{margin:0 0 6px;font-size:16px;color:#ffffff}
    .rsa-landing .feature p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.6}
    .rsa-landing .pricing{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .rsa-landing .plan-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px}
    .rsa-landing .plan-card{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);border-radius:20px;overflow:hidden;display:flex;flex-direction:column}
    .rsa-landing .plan-card .topline{height:4px;background:linear-gradient(90deg,#ff8a00,#ff4d2e)}
    .rsa-landing .plan-card .body{padding:16px;display:flex;flex-direction:column;gap:10px;height:100%}
    .rsa-landing .plan-card h3{margin:0;font-size:18px;color:#ffffff}
    .rsa-landing .plan-card .price{font-size:26px;font-weight:900;line-height:1}
    .rsa-landing .plan-card .duration{font-size:12px;font-weight:700;color:#ffcf99}
    .rsa-landing .plan-card .list li{font-size:13px}
    .rsa-landing .terms-card{margin-top:16px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);border-radius:18px;padding:16px}
    .rsa-landing .terms-card h4{margin:0 0 8px;color:#ffffff}
    .rsa-landing .price-card{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: 22px;padding:18px}
    .rsa-landing .price-card h3{margin:0 0 8px;color:#ffffff}
    .rsa-landing .price{font-size:34px;font-weight:900;letter-spacing:-.5px;margin:10px 0;color:#ffffff;line-height: 24px;}
    .rsa-landing .price small{font-size:11px;color:rgba(255,255,255,.70);font-weight:700}
    .rsa-landing .list{margin:12px 0 0;padding:0;list-style:none;display:grid;gap:8px}
    .rsa-landing .list li{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.70);font-size:14px}
    .rsa-landing .tick{width:18px;height:18px;border-radius:50%;background: rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.35);display:grid;place-items:center;color:#22c55e;flex:0 0 auto;margin-top:2px;font-size:12px;font-weight:900}
    .rsa-landing .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .rsa-landing .step{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px}
    .rsa-landing .step b{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:12px;background: rgba(255,77,46,.16);border:1px solid rgba(255,77,46,.30);margin-bottom:10px;color:#ffb3a6;font-weight:900}
    .rsa-landing .step h4{margin:0 0 6px;color:#ffffff}
    .rsa-landing .step p{margin:0;color:rgba(255,255,255,.68);font-size:13px;line-height:1.6}
    .rsa-landing .testimonials{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .rsa-landing .review{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:16px;min-width:300px}
    .rsa-landing .stars{color:#ffcc66;letter-spacing:1px;font-size:14px}
    .rsa-landing .review p{color:rgba(255,255,255,.70);font-size:13px;line-height:1.7;margin:10px 0 12px}
    .rsa-landing .review strong{display:block;color:#ffffff}
    .rsa-landing .review span{color:rgba(255,255,255,.65);font-size:12px}
    .rsa-landing details{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:14px 16px}
    .rsa-landing details + details{margin-top:10px}
    .rsa-landing summary{cursor:pointer;font-weight:700;list-style:none}
    .rsa-landing summary::-webkit-details-marker{display:none}
    .rsa-landing details p{color:rgba(255,255,255,.70);font-size:13px;line-height:1.7;margin:10px 0 0}
    .rsa-landing .faq-item{border:1px solid rgba(255,255,255,.10);background: rgba(255,255,255,.05);border-radius: var(--radius);padding:14px 16px}
    .rsa-landing .faq-item + .faq-item{margin-top:10px}
    .rsa-landing .faq-question{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:none;background:transparent;color:#ffffff;font-weight:700;text-align:left;cursor:pointer;font-size:15px;padding:0}
    .rsa-landing .faq-answer{color:rgba(255,255,255,.70);font-size:15px;line-height:1.7;margin:10px 0 0}
    .rsa-landing .faq-chevron{font-size:12px;opacity:.9;transition:transform .2s ease}
    .rsa-landing .faq-chevron.open{transform:rotate(180deg)}
    .rsa-landing footer{padding: 26px 0;border-top:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.65);font-size:13px;background:#070b14}
    .rsa-landing .marquee{overflow:hidden;position:relative}
    .rsa-landing .marquee-track{display:flex;gap:18px;width:max-content;animation:rsa-scroll 70s linear infinite}
    .rsa-landing section[id], .rsa-landing aside[id]{scroll-margin-top:88px}
    @keyframes rsa-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @media (min-width: 640px){.rsa-landing .container{padding:0 16px}.rsa-landing .nav{padding:12px 0;gap:12px}.rsa-landing .brand-logo{height:32px}}
    @media (min-width: 768px){.rsa-landing .container{padding:0 24px}.rsa-landing .nav{padding:16px 0}.rsa-landing .brand-logo{height:40px}}
    @media (max-width: 980px){.rsa-landing .hero{padding:24px 0 24px}.rsa-landing .hero-grid{grid-template-columns:1fr;gap:14px}.rsa-landing h1{font-size:32px}.rsa-landing .lead{font-size:16px}.rsa-landing .hero-copy{justify-content:flex-start}.rsa-landing .grid-4{grid-template-columns:repeat(2,1fr)}.rsa-landing .grid-3{grid-template-columns:repeat(2,1fr)}.rsa-landing .steps{grid-template-columns:repeat(2,1fr)}.rsa-landing .pricing{grid-template-columns:1fr}.rsa-landing .plan-grid{grid-template-columns:repeat(2,1fr)}.rsa-landing .testimonials{grid-template-columns:repeat(2,1fr)}.rsa-landing .nav-links{display:none}}
    @media (max-width: 560px){.rsa-landing h1{font-size:32px}.rsa-landing .lead{font-size:15px;line-height:1.5;max-width:100%}.rsa-landing .lead-location{display:inline}.rsa-landing .form-row{grid-template-columns:1fr}.rsa-landing .grid-3,.rsa-landing .plan-grid{grid-template-columns:1fr}.rsa-landing .grid-4{grid-template-columns:repeat(2,1fr)}.rsa-landing .steps{grid-template-columns:1fr}.rsa-landing .testimonials{grid-template-columns:1fr}.rsa-landing .stats{grid-template-columns:repeat(2,1fr)}.rsa-landing .stat strong{font-size:24px}.rsa-landing #services .section-title,.rsa-landing #process .section-title{justify-content:center;text-align:center}.rsa-landing #services .section-title h2{font-size:20px;line-height:1.15;letter-spacing:-.6px;white-space:nowrap}.rsa-landing #services .section-title p,.rsa-landing #process .section-title p{margin-left:auto;margin-right:auto}.rsa-landing #services .feature,.rsa-landing #process .step{text-align:center}.rsa-landing #services .feature .icon,.rsa-landing #process .step b{margin-left:auto;margin-right:auto}.rsa-landing .faq-question{font-size:14px}.rsa-landing .faq-answer{font-size:13px}}
  `}} />
      <div className="rsa-landing">
        <header>
          <div className="container">
            <div className="nav">
              <a className="brand" href="/" aria-label="Go to homepage">
                <img src="/logo.png" alt="MY FNG" className="brand-logo" />
              </a>
              <nav className="nav-links">
                <a href="#services" onClick={(e) => scrollToSection(e, 'services')}>Services</a>
                <a href="#pricing" onClick={(e) => scrollToSection(e, 'pricing')}>Pricing</a>
                <a href="#process" onClick={(e) => scrollToSection(e, 'process')}>Process</a>
                <a href="#reviews" onClick={(e) => scrollToSection(e, 'reviews')}>Reviews</a>
                <a href="#faq" onClick={(e) => scrollToSection(e, 'faq')}>FAQ</a>
                <a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>Contact</a>
              </nav>
              <div className="nav-cta">
                <a className="btn small" href={`tel:+919610448949`} rel="noopener noreferrer">CALL NOW</a>
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
                      <option>Fuel Delivery</option>
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
                    <div className="stat"><strong>32000+</strong><span>Rescues Done</span></div>
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
              <div className="feature"><div className="icon">⚡</div><h4>Battery Jumpstart</h4><p>ETA: 10-30 Min</p><p>Instant battery start at your location.</p></div>
              <div className="feature"><div className="icon">⛽</div><h4>Fuel Delivery</h4><p>ETA: 20-30 Min</p><p>Emergency petrol/diesel delivery.</p></div>
              <div className="feature"><div className="icon">🚗</div><h4>Car Towing Services</h4><p>ETA: 20-30 Min</p><p>Safe towing to nearest workshop.</p></div>
              <div className="feature"><div className="icon">🧯</div><h4>Accidental Car Towing</h4><p>ETA: 30-35 Min</p><p>Accident vehicle recovery & transport.</p></div>
              <div className="feature"><div className="icon">🛠</div><h4>Roadside Assistance</h4><p>ETA: 10-20 Min</p><p>Minor on‑road repairs support.</p></div>
              <div className="feature"><div className="icon">📍</div><h4>Car Tracking Services</h4><p>ETA: 20-30 Min</p><p>Live location and tracking support.</p></div>
              <div className="feature"><div className="icon">🧰</div><h4>Periodic Car Service</h4><p>ETA: 60 Secs</p><p>Book periodic maintenance booking in Seconds.</p></div>
              <div className="feature"><div className="icon">🛞</div><h4>Flat Tyre Assistance</h4><p>ETA: 15-30 Min</p><p>Tyre change or puncture fix instantly.</p></div>
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
                <div style={{ marginTop: 12 }}>
                  <a className="btn primary" href="tel:+919610448949" onClick={(e) => scrollToSection(e, 'contact')}>
                    Call Now For Immediate Help
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
                    <span>Jumpstart, puncture, fuel &amp; minor fixes</span>
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
                <div style={{ marginTop: 12 }}>
                  <a
                    className="btn primary whatsapp"
                    href={`https://wa.me/${RSA_WHATSAPP}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp for Quote
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
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart done quickly for my Swift in Pune. Reached in 20 minutes.</p><strong>Rahul • Pune • Maruti Swift</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Towing arranged for my i20 in Mumbai highway. Very professional.</p><strong>Amit • Mumbai • Hyundai i20</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Flat tyre help at night in Delhi. Technician polite.</p><strong>Sachin • Delhi • Honda City</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fuel delivered in Bangalore Outer Ring Road. Lifesaver.</p><strong>Karthik • Bangalore • Kia Seltos</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Accident towing handled carefully in Hyderabad.</p><strong>Praveen • Hyderabad • Creta</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Battery jumpstart in Ahmedabad parking basement.</p><strong>Mehul • Ahmedabad • Baleno</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fast service for my WagonR in Jaipur.</p><strong>Rohit • Jaipur • WagonR</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Car stopped in rain, got help in Chennai quickly.</p><strong>Arun • Chennai • Polo</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Tracking feature was accurate in Gurgaon.</p><strong>Neeraj • Gurgaon • Verna</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Very smooth towing for my Fortuner in Noida.</p><strong>Deepak • Noida • Fortuner</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Night support in Indore saved my trip.</p><strong>Ankit • Indore • Amaze</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Good behavior and fair price in Nagpur.</p><strong>Vivek • Nagpur • Tiago</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Tyre replaced in 15 mins in Surat.</p><strong>Jay • Surat • Nexon</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart early morning in Kolkata.</p><strong>Sourav • Kolkata • Alto</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Excellent coordination in Lucknow.</p><strong>Harsh • Lucknow • Brezza</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Technician arrived quickly in Bhopal.</p><strong>Rakesh • Bhopal • XUV300</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Highway towing handled perfectly in Chandigarh.</p><strong>Gagan • Chandigarh • Scorpio</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Fuel delivery within 25 minutes in Kochi.</p><strong>Nithin • Kochi • Jazz</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Jumpstart done quickly for my Swift in Pune. Reached in 20 minutes.</p><strong>Rahul • Pune • Maruti Swift</strong></div>
                <div className="review"><div className="stars">★★★★★</div><p>Towing arranged for my i20 in Mumbai highway. Very professional.</p><strong>Amit • Mumbai • Hyundai i20</strong></div>
              </div>
            </div>
          </div>
        </section>

        <section id="plans">
          <div className="container">
            <div className="section-title">
              <div>
                <h2>Best Plans for You</h2>
                <p>Subscription packages which suit your car and your pocket.</p>
              </div>
            </div>

            <div className="plan-grid">
              {RSA_SUBSCRIPTION_PLANS.map((plan) => (
                <div className="plan-card" key={plan.key}>
                  <div className="topline" />
                  <div className="body">
                    <h3>{plan.title}</h3>
                    <div className="price">₹{plan.price.toLocaleString('en-IN')}</div>
                    <div className="duration">{plan.durationLabel}</div>
                    <ul className="list">
                      {plan.features.map((feature, idx) => (
                        <li key={`${plan.key}-${idx}-${feature}`}>
                          <span className="tick">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div style={{ marginTop: 'auto' }}>
                      <a className="btn primary" href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>
                        Buy Now
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
              <ul className="list">
                {RSA_PLAN_TERMS.map((term) => (
                  <li key={term}>
                    <span className="tick">✓</span>
                    <span>{term}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="faq">
          <div className="container">
            <div className="section-title"><div><h2>FAQs</h2><p>Frequently asked questions about MYFNG Roadside Assistance.</p></div></div>
            {RSA_FAQS.map((faq, idx) => {
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
