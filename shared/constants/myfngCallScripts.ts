/** Spoken MyFNG Call IQ lines. Shown in Call Scripts even when the table read is blocked. */

export type MyfngCallScript = {
  id: string;
  script_title: string;
  script_content: string;
  script_type: string;
  language: 'hi' | 'en';
  category: string;
  is_active: true;
};

export const MYFNG_CALL_SCRIPTS: MyfngCallScript[] = [
  {
    id: 'myfng-ciq-opening-hi',
    script_type: 'OPENING',
    script_title: 'MyFNG Call IQ · Opening',
    language: 'hi',
    category: 'GREETING',
    is_active: true,
    script_content:
      'Namaste sir/madam, main MY FNG se bol raha hoon. Hum Mumbai, Navi Mumbai aur Thane mein 50 se zyada verified A-grade partner workshops ke through car service karte hain. Yeh workshops company ke nahi hain, verified partner network hain. Aapki gaadi ki service ke baare mein baat kar sakta hoon?',
  },
  {
    id: 'myfng-ciq-opening-en',
    script_type: 'OPENING',
    script_title: 'MyFNG Call IQ · Opening (English)',
    language: 'en',
    category: 'GREETING',
    is_active: true,
    script_content:
      'Hello sir/madam, this is MY FNG. We connect car owners in Mumbai, Navi Mumbai and Thane with 50+ verified A-grade partner workshops. These workshops are a partner network, not company-owned. May I talk about your car service?',
  },
  {
    id: 'myfng-ciq-questions',
    script_type: 'QUALIFICATION',
    script_title: 'MyFNG Call IQ · 4 questions',
    language: 'hi',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Plan suggest karne se pehle yeh 4 cheezein poochho:\n1. Aap kis location se hain?\n2. Car ka make aur model kya hai?\n3. Last service kab hui thi?\n4. Service aaj chahiye, is hafte, ya baad mein?\n\nService type bhi confirm karo: periodic, repair, engine, AC, brake, denting ya painting.',
  },
  {
    id: 'myfng-ciq-reg-hi',
    script_type: 'QUALIFICATION',
    script_title: 'MyFNG Call IQ · Registration before price',
    language: 'hi',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Price batane se pehle registration number lo. Saath mein make, model, fuel type aur year confirm karo. Number ke bina generic price mat do. Estimate usi car ka do.',
  },
  {
    id: 'myfng-ciq-reg-en',
    script_type: 'QUALIFICATION',
    script_title: 'MyFNG Call IQ · Registration before price (English)',
    language: 'en',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Before any price, take the registration number, plus make, model, fuel type and year. Do not quote a generic number. Give the estimate for that car.',
  },
  {
    id: 'myfng-ciq-pitch-hi',
    script_type: 'USP_PITCH',
    script_title: 'MyFNG Call IQ · Pitch',
    language: 'hi',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Pehle zarurat suno, phir plan suggest karo. Push mat karo.\nPackages: General, Premium, Platinum, ya custom repair.\n\nUSPs:\n- Free pickup aur drop\n- Kaam ke photo aur video\n- Sirf OEM ya OES spare parts\n- Transparent pricing, koi hidden charge nahi\n- Warranty: 3 mahine ya 1,000 km\n- Jahan possible ho, same-day service\n- 6 mahine ya 5,000 km ke andar free inspection aur top-up',
  },
  {
    id: 'myfng-ciq-pitch-en',
    script_type: 'USP_PITCH',
    script_title: 'MyFNG Call IQ · Pitch (English)',
    language: 'en',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Ask what they need first, then suggest General, Premium, Platinum, or a custom repair. Do not push.\nUSPs: free pickup and drop, photo and video of the work, OEM or OES parts only, transparent pricing with no hidden charges, warranty of 3 months or 1,000 km, same-day service where possible, and a free inspection plus top-up within 6 months or 5,000 km.',
  },
  {
    id: 'myfng-ciq-pickup',
    script_type: 'PICKUP_CONFIRMATION',
    script_title: 'MyFNG Call IQ · Pickup or visit',
    language: 'hi',
    category: 'INFORMATION_GATHERING',
    is_active: true,
    script_content:
      'Kya hum aapki gaadi aapke location se free pickup kar lein, aur service ke baad drop kar dein? Aap chahein toh khud workshop visit bhi kar sakte hain. Aapko kya theek rahega, pickup ya visit?',
  },
  {
    id: 'myfng-ciq-workshop',
    script_type: 'WORKSHOP',
    script_title: 'MyFNG Call IQ · Workshop aapka hai?',
    language: 'hi',
    category: 'OBJECTION_HANDLING',
    is_active: true,
    script_content:
      'Agar customer pooche "workshop aapka hai?":\n"Nahi sir/madam. MY FNG workshops own nahi karta. Hum verified A-grade partner workshops ke through service karte hain."\n\nKabhi mat bolo: humare workshop, apne workshop, ya our own workshop.',
  },
  {
    id: 'myfng-ciq-close-hi',
    script_type: 'CLOSING',
    script_title: 'MyFNG Call IQ · Booking close',
    language: 'hi',
    category: 'CLOSING',
    is_active: true,
    script_content:
      'Kya main aapka slot book kar dun? Weekend slots jaldi bhar jaate hain, weekday pe time better milta hai. Pickup chahiye ya aap visit karenge? Confirm ho jaaye toh booking pakki kar do.',
  },
  {
    id: 'myfng-ciq-close-en',
    script_type: 'CLOSING',
    script_title: 'MyFNG Call IQ · Booking close (English)',
    language: 'en',
    category: 'CLOSING',
    is_active: true,
    script_content:
      'Shall I book your slot? Weekend slots fill up fast, and weekdays are easier. Do you want pickup, or will you visit the workshop? Once they agree, confirm the booking.',
  },
  {
    id: 'myfng-ciq-obj-hi',
    script_type: 'REJECTION_HANDLING',
    script_title: 'MyFNG Call IQ · Objections',
    language: 'hi',
    category: 'OBJECTION_HANDLING',
    is_active: true,
    script_content:
      '"Soch ke batata hoon."\nPrice hai, trust hai, ya time? Registration number pe exact estimate de sakta hoon, ya ek weekday slot hold kar dun.\n\n"Apne mechanic ko bolunga."\nLocal garage guesswork karta hai. Yahan photo-video, warranty, OEM/OES parts aur pickup milta hai. Compare karke decide kar lijiye.\n\n"Sirf price dekh raha hoon."\nGeneric number galat padta hai. Registration ya make-model dijiye, usi car ka estimate deta hoon.\n\n"Gaadi theek chal rahi hai."\nTime pe service badi repair se bachati hai. Inspection aur top-up bhi cover rehta hai.\n\n"Time nahi hai."\nFree pickup aur drop hai. Aapko workshop aane ki zarurat nahi.\n\n"Agle mahine karunga."\nLast service kab hui thi? Delay se kharcha badh sakta hai. Date abhi fix kar dete hain.',
  },
  {
    id: 'myfng-ciq-obj-en',
    script_type: 'REJECTION_HANDLING',
    script_title: 'MyFNG Call IQ · Objections (English)',
    language: 'en',
    category: 'OBJECTION_HANDLING',
    is_active: true,
    script_content:
      '"I\'ll think about it."\nAsk if it is price, trust, or timing. Offer an estimate on the registration number, or hold a weekday slot.\n\n"I\'ll call my regular mechanic."\nA local garage is guesswork. Here they get photos and videos, warranty, OEM/OES parts, and pickup. Let them compare.\n\n"I\'m just checking prices."\nA generic number is wrong. Take the registration or make and model, then quote that car.\n\n"My car is running fine."\nA service on time avoids a bigger repair. Inspection and top-up are included.\n\n"I don\'t have time."\nFree pickup and drop. They do not have to visit the workshop.\n\n"I\'ll do it next month."\nAsk the last service date. Delay can cost more. Fix the date now.',
  },
  {
    id: 'myfng-ciq-followup',
    script_type: 'FOLLOW_UP',
    script_title: 'MyFNG Call IQ · Follow-up',
    language: 'hi',
    category: 'FOLLOW_UP',
    is_active: true,
    script_content:
      'Hello sir/madam, MY FNG se bol raha hoon. Aapki gaadi ki service pending thi. Aaj ya is hafte slot nikalun, ya aap baad mein workshop visit karna chahenge?',
  },
];

export function callScriptDisplayTitle(title?: string | null): string {
  const clean = String(title || 'Script')
    .replace(/^MyFNG Call IQ\s*·\s*/i, '')
    .replace(/\s*\(English\)\s*$/i, '')
    .trim();
  return clean || 'Script';
}

export function withMyfngCallScripts<T extends { script_title?: string | null }>(
  rows: T[],
): Array<T | MyfngCallScript> {
  const titles = new Set(rows.map((row) => String(row.script_title || '')));
  const extra = MYFNG_CALL_SCRIPTS.filter((script) => !titles.has(script.script_title));
  return [...extra, ...rows];
}
