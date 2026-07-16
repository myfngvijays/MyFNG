export function assistantAsksForCar(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return /which car|car do you have|car model|aapki car|gaadi|gadi|vehicle model|kon si car/i.test(t);
}

export function assistantAsksForAddress(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (
    /complete address|pickup address|pick.?up address|your address|where should we pick|delivery address|full address/i.test(
      t,
    ) || (/address/i.test(t) && /pickup|pick up|complete|provide|share/i.test(t))
  );
}

export function assistantAsksForPincode(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/booking summary|mobile number|otp|verify|address|complete address/i.test(t)) return false;
  return (
    /pin\s*code|6-digit pin|6 digit pin|postal code|area pin|your pin|location pin|serviceable pin/i.test(t) ||
    (/pin/i.test(t) && /6.?digit|six.?digit|location|area|where|operate|serviceable/i.test(t))
  );
}

export function assistantAsksForName(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/booking summary|registration number|vehicle number|car registration/i.test(t)) return false;
  return /what'?s your name|your (full )?name|may i know your name|please share your name|tell me your name|get started with your booking/i.test(
    t,
  );
}

export function assistantNeedsMobileVerification(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/booking summary|registration number|vehicle number/i.test(t)) return false;
  return /mobile|phone number|phone|otp|whatsapp|verify|verification|10.digit/i.test(t);
}

export function assistantAsksForPickupDate(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/registration number|vehicle number|car registration|booking summary/i.test(t)) return false;
  if (/what time would you prefer|pickup time|available slots.*10 am/i.test(t)) return false;
  return (
    /when would you like|schedule the service|preferred date|pickup date|select a future date|when do you want|what date|pick a date|choose a date|service date|date for pickup|date for the service/i.test(
      t,
    )
  );
}

export function assistantAsksForPickupTime(text: string): boolean {
  const t = String(text || '').toLowerCase();
  if (/registration number|vehicle number|car registration|booking summary/i.test(t)) return false;
  return (
    /what time would you prefer/i.test(t) ||
    (/pickup service is available between/i.test(t) && !/registration number|car registration/i.test(t)) ||
    /available slots.*10 am|what time.*pickup|preferred time|pickup time/i.test(t)
  );
}

export function assistantAsksForVehicleNumber(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return /registration number|vehicle number|car number|number plate|rc number|gaadi number/i.test(t);
}

export function assistantShowsBookingSummary(text: string): boolean {
  return /booking summary/i.test(String(text || ''));
}

export function assistantMessageShowsServiceList(text: string): boolean {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*]\s/.test(l) || /^\d+[.)]\s/.test(l));
  const serviceHits = bullets.filter((l) =>
    /service|tyre|wheel|detailing|denting|electrical|suspension|battery|brake|clutch|engine|ac/i.test(l),
  );
  return serviceHits.length >= 3;
}

export type BookingSummaryData = {
  service?: string;
  price?: string;
  car?: string;
  vehicleNo?: string;
  pinCode?: string;
  name?: string;
  phone?: string;
  address?: string;
  date?: string;
  time?: string;
};

export function parseBookingSummary(text: string): BookingSummaryData | null {
  const raw = String(text || '');
  if (!assistantShowsBookingSummary(raw)) return null;
  const pick = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const m = raw.match(pattern);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };
  const data: BookingSummaryData = {
    service: pick([/🔧\s*Service:\s*(.+)/i, /Service:\s*(.+)/i]),
    price: pick([/💰\s*Price:\s*(.+)/i, /Price:\s*(.+)/i]),
    car: pick([/🚗\s*Car:\s*(.+)/i, /Car:\s*(.+)/i]),
    vehicleNo: pick([/🚘\s*Vehicle No:\s*(.+)/i, /Vehicle No:\s*(.+)/i]),
    pinCode: pick([/📍\s*PIN Code:\s*(.+)/i, /PIN Code:\s*(.+)/i]),
    name: pick([/👤\s*Name:\s*(.+)/i, /Name:\s*(.+)/i]),
    phone: pick([/📞\s*Phone:\s*(.+)/i, /Phone:\s*(.+)/i]),
    address: pick([/🏠\s*Address:\s*(.+)/i, /Address:\s*(.+)/i]),
    date: pick([/📅\s*Date:\s*(.+)/i, /Date:\s*(.+)/i]),
    time: pick([/🕐\s*Time:\s*(.+)/i, /Time:\s*(.+)/i]),
  };
  return Object.values(data).some(Boolean) ? data : null;
}
