'use client';

import { useState } from 'react';
import { RSA_WHATSAPP, rsaRequestUtm } from '@/lib/rsa/emergencyPages';

type Props = {
  serviceLabel: string;
  whatsappService: string;
  campaign?: string;
  showDropLink?: boolean;
};

export default function RsaServiceRequestForm({ serviceLabel, whatsappService, campaign, showDropLink }: Props) {
  const [locationValue, setLocationValue] = useState('');
  const [locating, setLocating] = useState(false);

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
            `/api/location/google-reverse?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
          );
          const data = await res.json().catch(() => null);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const phone = String(data.get('phone') || '');
    const location = String(data.get('location') || '');
    const dropLocationLink = String(data.get('drop_location_link') || '').trim();
    const dropLine = dropLocationLink
      ? `%0ADrop Location (Google Link): ${encodeURIComponent(dropLocationLink)}`
      : '';
    const utmParams = rsaRequestUtm(campaign || whatsappService);
    const utmLine = (
      [
        ['UTM Source', utmParams.utm_source],
        ['UTM Medium', utmParams.utm_medium],
        ['UTM Campaign', utmParams.utm_campaign],
        ['UTM Term', utmParams.utm_term],
        ['UTM Content', utmParams.utm_content],
      ] as Array<[string, string | undefined]>
    )
      .filter(([, value]) => Boolean(value && value.trim()))
      .map(([label, value]) => `${encodeURIComponent(label)}: ${encodeURIComponent(String(value))}`)
      .join('%0A');
    const utmSection = utmLine ? `%0A%0AUTM Details:%0A${utmLine}` : '';
    const msg = `Hello MYFNG Team,%0A%0AI need Roadside Assistance (RSA).%0A%0APhone: ${encodeURIComponent(phone)}%0AService: ${encodeURIComponent(whatsappService)}%0ALocation: ${encodeURIComponent(location)}${dropLine}${utmSection}%0A%0APlease dispatch help ASAP.`;
    window.open(`https://wa.me/${RSA_WHATSAPP}?text=${msg}`, '_blank');
    form.reset();
    setLocationValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <p className="text-sm text-[#5c6778]">
        Request <span className="font-semibold text-[#023D95]">{serviceLabel}</span>. We connect on WhatsApp.
      </p>
      <input
        className="w-full rounded-xl border border-[#f3b4b4] bg-[#fffafa] px-3 py-3 text-sm text-[#142033] outline-none focus:border-[#e11d48]"
        type="tel"
        name="phone"
        placeholder="Mobile Number"
        required
      />
      <div className="relative">
        <input
          className="w-full rounded-xl border border-[#f3b4b4] bg-[#fffafa] px-3 py-3 pr-12 text-sm text-[#142033] outline-none focus:border-[#e11d48]"
          name="location"
          placeholder="Current Location / Landmark"
          value={locationValue}
          onChange={(e) => setLocationValue(e.target.value)}
          required
        />
        <button
          type="button"
          onClick={handleUseMyLocation}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-[#f3b4b4] bg-white text-[#e11d48]"
          aria-label="Use my location"
        >
          {locating ? '…' : '📍'}
        </button>
      </div>
      {showDropLink ? (
        <input
          className="w-full rounded-xl border border-[#f3b4b4] bg-[#fffafa] px-3 py-3 text-sm text-[#142033] outline-none focus:border-[#e11d48]"
          type="url"
          name="drop_location_link"
          placeholder="Drop Location Google Link (Optional)"
        />
      ) : null}
      <button
        type="submit"
        className="rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] px-4 py-3 text-base font-extrabold text-white"
      >
        Send Help on WhatsApp
      </button>
    </form>
  );
}
