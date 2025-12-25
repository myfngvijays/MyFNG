import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectIntent } from './intentDetector';
import { resolveServices, getServiceCategory } from './serviceResolver';
import { resolveExactPrices, resolvePriceRanges } from './pricingResolver';
import { BookingValidationError, triggerBooking } from './bookingTrigger';
import { planNextStep } from './dialogManager';
import { REPLY_COMPOSER_SYSTEM_PROMPT } from './prompt';
import { ensureInvoiceForLead } from '@/lib/payments/chatInvoice';
import { resolveBookingTokenAmount } from '@/lib/payments/chatPaymentTypes';
import { createShortUrl } from '@/lib/services/urlShortener';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'crypto';
import type {
  ChatbotMessageRequest,
  ChatbotResponse,
  ChatbotContext,
  ServiceSuggestion,
  SuggestedOption,
} from './types';

export const dynamic = 'force-dynamic';

// Doc-mode is the “lead qualification + callback” flow (as per business prompt).
// It should be the default for the AI assistant.
// Set CHATBOT_DOC_MODE=false to disable and use the full booking workflow.
const DOC_MODE_ENABLED = (process.env.CHATBOT_DOC_MODE || 'true').toLowerCase() === 'true';

const DOC_USPS = [
  'Free pickup & drop 🚗',
  'OEM/OES genuine spare parts 🔧',
  'Photo/video proof 📸',
  '50-point comprehensive checkup 📋',
  'Same-day service (where possible)',
  '1-month / 1,000 km warranty 🛠️',
  'Free mini service within 6 months (oil top-up + inspection)',
  '50+ A-grade verified workshops',
];

type DocLang = 'en' | 'hi' | 'hinglish';

const DOC_RAG_FALLBACK_LINE = 'I’ll connect you with our service expert 👨‍💼 who can guide you better.';

function pickDocLang(context: any, userText: string): DocLang {
  const pref = (context?.preferredLanguage || 'auto') as string;
  if (pref === 'en') return 'en';
  if (pref === 'hi') return 'hi';
  // For doc mode, we treat Marathi/Gujarati as Hinglish to avoid wrong-script responses.
  const hint = detectReplyLanguageHint(userText);
  if (hint === 'hi_deva') return 'hi';
  if (hint === 'en') return 'en';
  return 'hinglish';
}

function docLine(lang: DocLang, en: string, hi: string, hinglish: string) {
  if (lang === 'en') return en;
  if (lang === 'hi') return hi;
  return hinglish;
}

function isPricingQuery(text: string) {
  return /(price|cost|charges|rate|kitna|kitne|fees|estimate|budget|quotation|quote)/i.test(text || '');
}

function isWorkshopAddressQuery(text: string) {
  return /(address|location|where is|kaha hai|kahan hai|workshop address|map|google maps|near me|nearest workshop)/i.test(text || '');
}

function isSelfDropQuery(text: string) {
  return /(self\s*drop|self\s*come|khud\s*(aana|aaun|ana)|workshop\s*me\s*(aana|aaun|ana)|khud\s*drop)/i.test(text || '');
}

function isNeedAnalysisAnswer(text: string) {
  const t = normalize(text);
  if (!t) return null as null | 'REGULAR_SERVICE' | 'REPAIR_ISSUE' | 'CLEANING_DETAILING';
  // Regular service (typos + Hindi/Hinglish)
  if (/(regular|reglar|reguler|periodic|periodik|service due|maintenance|maintainance|servic(e|ing)|oil|engine oil|general service)/i.test(t)) {
    return 'REGULAR_SERVICE';
  }
  // Repair/issue (typos + common Hindi words)
  if (/(repair|repa(ir)?|issue|isu+e|problem|probl?em|noise|noice|vibration|vibrat|ac|a\/c|cooling|brake|break|battery|battry|clutch|cluch|engine|scan|starting|start nahi|not starting|kharab|awaaz|awaj)/i.test(t)) {
    return 'REPAIR_ISSUE';
  }
  // Cleaning/detailing (typos + Hindi words)
  if (/(clean|clen|cleaning|clining|wash|car wash|detailing|detail|interior|exterior|polish|wax|spa|dry clean|deep clean|saaf|safai|dhulai)/i.test(t)) {
    return 'CLEANING_DETAILING';
  }
  return null;
}

function nextUsp(context: any) {
  const idx = typeof context?.docUspIndex === 'number' ? context.docUspIndex : 0;
  const usp = DOC_USPS[idx % DOC_USPS.length];
  return { usp, nextIndex: idx + 1 };
}

function buildDocNextQuestion(lang: DocLang, ctx: any) {
  if (!ctx?.docNeedType) {
    return docLine(
      lang,
      'What do you need today — regular service, repair/issue, or cleaning/detailing?',
      'Aapko kya chahiye — regular service, repair/issue, ya cleaning/detailing?',
      'Aapko kya chahiye — regular service, repair/issue, ya cleaning/detailing?'
    );
  }
  if (!ctx?.docCarModelText && !ctx?.vehicleModel) {
    return docLine(
      lang,
      'Which car do you drive? (Make + Model)',
      'Aap kaunsi car chalate ho? (Make + Model)',
      'Aap kaunsi car chalate ho? (Make + Model)'
    );
  }
  if (!ctx?.docLastServiceText) {
    return docLine(
      lang,
      'When was the last service done / how many KM has it run?',
      'Last service kab hua tha / kitne KM chale hain?',
      'Last service kab hua tha / kitne KM chale hain?'
    );
  }
  if (!ctx?.docLocationText && !ctx?.addressText && !ctx?.cityName) {
    return docLine(
      lang,
      'Your location? (Area + City)',
      'Aapka location? (Area + City)',
      'Aapka location? (Area + City)'
    );
  }
  if (!ctx?.docPreferredServiceDateText) {
    return docLine(
      lang,
      'Preferred service date?\nToday / Later this week',
      'Preferred service date?\nToday / Later this week',
      'Preferred service date?\nToday / Later this week'
    );
  }
  if (!ctx?.customerPhone) {
    return docLine(
      lang,
      'Please share your 10-digit mobile number (for callback).',
      'Callback ke liye 10-digit mobile number share kar dijiye.',
      'Callback ke liye 10-digit mobile number share kar do.'
    );
  }
  // Optional vehicle number for faster booking/payment
  if (!ctx?.vehicleNumber) {
    return docLine(
      lang,
      'If you have it handy, share your vehicle number (e.g., MH12AB1234).',
      'Agar handy ho to vehicle number share kar dijiye (e.g., MH12AB1234).',
      'Agar handy ho to vehicle number share kar do (e.g., MH12AB1234).'
    );
  }
  return null;
}

function docClosing(lang: DocLang, ctx: any) {
  const details: string[] = [];
  if (ctx?.customerPhone) details.push(docLine(lang, `Phone: ${ctx.customerPhone}`, `Phone: ${ctx.customerPhone}`, `Phone: ${ctx.customerPhone}`));
  const car = ctx?.docCarModelText || ctx?.vehicleModel;
  if (car) details.push(docLine(lang, `Car: ${car}`, `Car: ${car}`, `Car: ${car}`));
  if (ctx?.docLastServiceText) details.push(docLine(lang, `Last service/KM: ${ctx.docLastServiceText}`, `Last service/KM: ${ctx.docLastServiceText}`, `Last service/KM: ${ctx.docLastServiceText}`));
  const loc = ctx?.docLocationText || ctx?.addressText || ctx?.cityName;
  if (loc) details.push(docLine(lang, `Location: ${loc}`, `Location: ${loc}`, `Location: ${loc}`));
  if (ctx?.docPreferredServiceDateText) details.push(docLine(lang, `Preferred date: ${ctx.docPreferredServiceDateText}`, `Preferred date: ${ctx.docPreferredServiceDateText}`, `Preferred date: ${ctx.docPreferredServiceDateText}`));

  const usp1 = 'Free pickup & drop 🚗';
  const usp2 = 'Photo/video proof 📸';

  return [
    docLine(lang, 'Thanks! ✅ Here’s what I noted:', 'Thank you! ✅ Details confirm:', 'Thanks! ✅ Details confirm:'),
    ...details,
    '',
    docLine(lang, `Quick perks: ${usp1} • ${usp2}`, `Quick perks: ${usp1} • ${usp2}`, `Quick perks: ${usp1} • ${usp2}`),
    docLine(lang, 'Our service expert will call you shortly 📞 to confirm plans and pickup address.', 'Our service expert will call you shortly 📞 to confirm plans and pickup address.', 'Our service expert will call you shortly 📞 to confirm plans and pickup address.'),
  ]
    .filter(Boolean)
    .join('\n');
}

function docKnowledgeAnswer(lang: DocLang, text: string): string | null {
  const t = normalize(text);
  if (!t) return null;
  // Warranty: handle common misspellings + Hindi words
  if (/(warranty|warr?anty|warr?enty|warantty|warrenty|warantee|guarantee|warranty\s*hai|warranty\s*kya|warantty\s*kya|waranty\s*kya|वारंटी|वारन्टी|गारंटी)/i.test(t)) {
    return docLine(
      lang,
      'We provide 1-month / 1,000 km warranty (service & parts) 🛠️',
      'Service & parts par 1-month / 1,000 km warranty milti hai 🛠️',
      'Service & parts par 1-month / 1,000 km warranty milti hai 🛠️'
    );
  }
  if (/(gst|tax)/i.test(t)) {
    return docLine(lang, 'GST is included in the invoice.', 'Invoice me GST included hota hai.', 'Invoice me GST included hota hai.');
  }
  if (/(pickup|pick up|drop|doorstep)/i.test(t)) {
    return docLine(lang, 'Pickup & drop is free 🚗', 'Pickup & drop free hai 🚗', 'Pickup & drop free hai 🚗');
  }
  if (/(genuine|oem|oes|spare)/i.test(t)) {
    return docLine(lang, 'We use OEM/OES genuine spare parts 🔧', 'OEM/OES genuine spare parts use hote hain 🔧', 'OEM/OES genuine spare parts use hote hain 🔧');
  }
  if (/(amc|subscription)/i.test(t)) {
    return docLine(lang, 'AMC packages are available. Our expert will share the best option on call.', 'AMC packages available hain. Expert call pe best option share karega.', 'AMC packages available hain. Expert call pe best option share karega.');
  }
  // Inclusions / checklist queries (keep it high-level to avoid wrong commitments)
  if (/(include|included|inclusion|what.*include|what.*included|checklist|points|30\s*point|50\s*point|general\s*service|basic\s*service)/i.test(t)) {
    return docLine(
      lang,
      'General Service typically includes a multi-point inspection (30-point), basic fluid/top-up checks, and standard maintenance checks. Exact inclusions for your car are confirmed on the callback 📞.',
      'General Service me usually multi-point inspection (30-point), basic fluid/top-up checks aur standard maintenance checks aate hain. Exact inclusions aapki car ke hisaab se callback pe confirm honge 📞.',
      'General Service me usually 30-point inspection, basic fluid/top-up checks aur standard maintenance checks aate hain. Exact inclusions callback pe confirm honge 📞.'
    );
  }
  if (/(dent|paint|denting|painting)/i.test(t)) {
    return docLine(lang, 'Dent/paint is available with quality checks + warranty terms shared on call.', 'Dent/paint available hai. Quality checks + warranty terms call pe share honge.', 'Dent/paint available hai. Quality checks + warranty terms call pe share honge.');
  }
  if (/(authorized|authorised|service center|service centre)/i.test(t)) {
    return docLine(lang, 'Many times pricing is comparable, plus you get pickup/drop + transparency.', 'Kaafi cases me pricing comparable hoti hai + pickup/drop + transparency milti hai.', 'Kaafi cases me pricing comparable hoti hai + pickup/drop + transparency milti hai.');
  }
  return null;
}

function getRagDbClient(supabase: any) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ADMIN_KEY;
  if (!supabaseUrl || !serviceRoleKey) return { db: supabase, isAdmin: false };
  return {
    db: createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    isAdmin: true,
  };
}

async function openAiEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input: text }),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  const emb = json?.data?.[0]?.embedding;
  if (!Array.isArray(emb)) return null;
  return emb as number[];
}

async function openAiDocAnswer(params: {
  lang: DocLang;
  userQuestion: string;
  chunks: Array<{ text: string; similarity: number }>;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const sys = `You are MY FNG AI Assistant.
Use ONLY the provided Context to answer.
Keep it short (2-4 lines), chat-style.
If the context doesn't contain the answer, respond exactly: "I’ll connect you with our service expert 👨‍💼 who can guide you better."
Language:
- en: English
- hi: Hindi (Devanagari)
- hinglish: Hinglish
Do not mention sources, databases, or citations.`;

  const ctx = params.chunks
    .slice(0, 6)
    .map((c, i) => `[#${i + 1}]\n${c.text}`)
    .join('\n\n');

  const user = `preferred_language: ${params.lang}\n\nUser question:\n${params.userQuestion}\n\nContext:\n${ctx}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') return null;
  return content.trim();
}

async function vectorKbAnswer(supabase: any, lang: DocLang, userText: string): Promise<string | null> {
  const emb = await openAiEmbedding(userText);
  if (!emb) return null;

  const { db } = getRagDbClient(supabase);
  const { data } = await db.rpc('kb_search', { query_embedding: emb, match_count: 8 });
  const rows = (data as any[]) || [];

  const chunks = rows
    .map((r) => ({
      text: String(r?.chunk_text || '').trim(),
      similarity: Number(r?.similarity || 0),
    }))
    .filter((c) => c.text.length >= 20);

  const strong = chunks.filter((c) => c.similarity >= 0.78).slice(0, 6);
  if (strong.length === 0) return null;

  const ans = await openAiDocAnswer({ lang, userQuestion: userText, chunks: strong });
  if (!ans) return null;
  // If the doc-answerer returns the forced fallback line, treat it as "no KB answer"
  // so we don't show a confusing partial reply (fallback + next question).
  if (normalize(ans) === normalize(DOC_RAG_FALLBACK_LINE)) return null;
  if (normalize(ans).startsWith(normalize(DOC_RAG_FALLBACK_LINE))) return null;
  return ans;
}

function newConversationId() {
  // Ensure UUID string (DB columns use uuid type).
  const webUuid = (globalThis as any)?.crypto?.randomUUID?.();
  if (typeof webUuid === 'string' && webUuid.length >= 32) return webUuid;
  try {
    return randomUUID();
  } catch {
    // RFC4122-ish v4 fallback
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = b.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

function normalize(text: string) {
  return (text || '').toLowerCase().trim();
}

function baseContextPatch(context: any, conversationId: string) {
  // Always persist critical context so we don't re-ask car model/location repeatedly.
  return {
    conversationId,
    docMode: context?.docMode,
    conversationStage: context?.conversationStage,
    customerName: context?.customerName,
    customerPhone: context?.customerPhone,
    vehicleNumber: context?.vehicleNumber,
    problemDescription: context?.problemDescription,
    modelId: context?.modelId,
    vehicleMake: context?.vehicleMake,
    vehicleModel: context?.vehicleModel,
    vehicleVariant: context?.vehicleVariant,
    vehicleClass: context?.vehicleClass,
    cityId: context?.cityId,
    cityName: context?.cityName,
    zoneId: context?.zoneId,
    addressText: context?.addressText,
    locationLat: context?.locationLat,
    locationLng: context?.locationLng,
    serviceCategory: context?.serviceCategory,
    selectedServiceTypeIds: Array.isArray(context?.selectedServiceTypeIds) ? context.selectedServiceTypeIds : [],
    selectedPackageId: context?.selectedPackageId,
    pickupRequired: typeof context?.pickupRequired === 'boolean' ? context.pickupRequired : undefined,
    paymentMethod: context?.paymentMethod,
    catalogStage: context?.catalogStage || null,
    catalogServiceOptionIds: Array.isArray(context?.catalogServiceOptionIds) ? context.catalogServiceOptionIds : [],
    catalogOptionChoices: Array.isArray(context?.catalogOptionChoices) ? context.catalogOptionChoices : [],
    lastOptionChoices: Array.isArray(context?.lastOptionChoices) ? context.lastOptionChoices : [],
  } as any;
}

function normalizeCategoryText(text: string) {
  return String(text || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function renderCategoryMenu() {
  const cats = [
    'PERIODIC SERVICE',
    'AC SERVICE',
    'BATTERY SERVICE',
    'BRAKE SERVICE',
    'CLUTCH SERVICE',
    'DENTING PAINTING',
    'TYRE & WHEEL CARE',
    'DETAILING SERVICE',
    'ENGINE SERVICE',
    'OTHER SERVICES',
  ];
  const lines: string[] = [];
  lines.push('Services categories (reply with category name or option number):');
  cats.forEach((c, i) => lines.push(`• Option ${i + 1}: ${c}`));
  return { cats, text: lines.join('\n') };
}

function resolveCategoryFromFreeText(raw: string, cats: string[]): string | null {
  const t = normalizeCategoryText(raw);
  if (!t) return null;
  // direct exact
  const exact = cats.find((c) => normalizeCategoryText(c) === t);
  if (exact) return exact;

  const low = (raw || '').toLowerCase();
  const matches: string[] = [];
  const addIf = (cond: boolean, cat: string) => {
    if (cond) matches.push(cat);
  };
  addIf(/\bperiodic\b|\bregular\b|\bservice\b/.test(low), 'PERIODIC SERVICE');
  addIf(/\bac\b|\bair\s*con\b|\bcooling\b|\bac\s*service\b/.test(low), 'AC SERVICE');
  addIf(/\bbattery\b|\bjump\b|\bstart\b|\bcrank\b/.test(low), 'BATTERY SERVICE');
  addIf(/\bbrake\b|\bbraking\b/.test(low), 'BRAKE SERVICE');
  addIf(/\bclutch\b|\bgear\b/.test(low), 'CLUTCH SERVICE');
  addIf(/\bdent\b|\bdenting\b|\bpaint\b|\bpainting\b|\bscratch\b|\bbumper\b|\bpanel\b|\bbody\b/.test(low), 'DENTING PAINTING');
  addIf(/\btyre\b|\btire\b|\bwhe?el\b|\balignment\b|\bbalancing\b|\bpuncture\b/.test(low), 'TYRE & WHEEL CARE');
  addIf(/\bdetailing\b|\bclean(ing)?\b|\bpolish\b|\bceramic\b|\bcoating\b/.test(low), 'DETAILING SERVICE');
  addIf(/\bengine\b|\bmount\b|\bnoise\b/.test(low), 'ENGINE SERVICE');
  addIf(/\bother\b|\bmisc\b|\bothers\b/.test(low), 'OTHER SERVICES');

  const uniq = Array.from(new Set(matches)).filter((m) => cats.includes(m));
  if (uniq.length === 1) return uniq[0];
  return null;
}

function categoryLabel(cat: string) {
  const t = normalizeCategoryText(cat);
  return t
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

async function fetchCategoryServiceTypes(supabase: any, category: string) {
  const { data } = await supabase
    .from('service_types')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name');
  const rows = (data || []) as Array<{ id: string; name: string; description?: string | null }>;
  return rows.filter((s) => getServiceCategory(s.name) === category);
}

async function fetchAllPackages(supabase: any) {
  const { data, error } = await supabase
    .from('service_packages')
    .select('id, name, description, total_price')
    .order('name');
  if (error) return [] as Array<{ id: string; name: string; description?: string | null; total_price?: any }>;
  const rows = (data || []) as Array<{ id: string; name: string; description?: string | null; total_price?: any }>;
  return rows;
}

async function fetchPackageItemNames(supabase: any, packageIds: string[]) {
  const map = new Map<string, string[]>();
  if (packageIds.length === 0) return map;
  try {
    const { data, error } = await supabase
      .from('service_package_items')
      .select('package_id, service_type_id')
      .in('package_id', packageIds);
    if (error || !data) return map;
    const pkgToSt = new Map<string, string[]>();
    const stIds: string[] = [];
    for (const r of data as any[]) {
      const pid = String(r?.package_id || '');
      const sid = String(r?.service_type_id || '');
      if (!pid || !sid) continue;
      pkgToSt.set(pid, [...(pkgToSt.get(pid) || []), sid]);
      stIds.push(sid);
    }
    const uniqSt = Array.from(new Set(stIds));
    const stName = new Map<string, string>();
    const chunkSize = 80;
    for (let i = 0; i < uniqSt.length; i += chunkSize) {
      const chunk = uniqSt.slice(i, i + chunkSize);
      const { data: stRows } = await supabase.from('service_types').select('id, name').in('id', chunk);
      (stRows as any[] | null)?.forEach((x: any) => {
        if (x?.id && x?.name) stName.set(String(x.id), String(x.name));
      });
    }
    for (const [pid, sids] of pkgToSt.entries()) {
      const names = sids.map((sid) => stName.get(sid)).filter(Boolean) as string[];
      map.set(pid, names);
    }
    return map;
  } catch {
    return map;
  }
}

async function searchServiceTypesByName(supabase: any, query: string) {
  const q = String(query || '').trim();
  if (!q) return [] as Array<{ id: string; name: string; description?: string | null }>;
  const { data, error } = await supabase
    .from('service_types')
    .select('id, name, description')
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .limit(8);
  if (error) return [];
  return (data || []) as Array<{ id: string; name: string; description?: string | null }>;
}

async function searchPackagesByName(supabase: any, query: string) {
  const q = String(query || '').trim();
  if (!q) return [] as Array<{ id: string; name: string; description?: string | null }>;
  const { data, error } = await supabase
    .from('service_packages')
    .select('id, name, description, total_price')
    .ilike('name', `%${q}%`)
    .limit(8);
  if (error) return [];
  return (data || []) as Array<{ id: string; name: string; description?: string | null; total_price?: any }>;
}

async function fetchServiceTypeChecklist(supabase: any, serviceTypeId: string): Promise<{ title?: string; points?: number; items: string[] } | null> {
  try {
    const { data, error } = await supabase
      .from('service_type_checklist_templates')
      .select('title, points, checklist_items')
      .eq('service_type_id', serviceTypeId)
      .maybeSingle();
    if (error || !data) return null;
    const rawItems = Array.isArray((data as any).checklist_items) ? (data as any).checklist_items : [];
    const items: string[] = rawItems
      .map((it: any) => {
        if (!it) return null;
        if (typeof it === 'string') return it;
        return String(it.name || it.label || it.title || '').trim() || null;
      })
      .filter(Boolean) as string[];
    return {
      title: (data as any).title || undefined,
      points: typeof (data as any).points === 'number' ? (data as any).points : undefined,
      items,
    };
  } catch {
    return null;
  }
}

function formatChecklistBlock(c: { title?: string; points?: number; items: string[] }) {
  const lines: string[] = [];
  const head = c.title ? c.title : c.points ? `${c.points}-point checklist` : 'Checklist';
  lines.push(`Includes (${head}):`);
  c.items.forEach((x) => lines.push(`- ${x}`));
  return lines.join('\n');
}

type ReplyLanguageHint = 'en' | 'hi_latn' | 'hi_deva' | 'mr_deva' | 'gu_gujr' | 'mixed' | 'unknown';

function detectReplyLanguageHint(text: string): ReplyLanguageHint {
  const t = text || '';
  // Script-based detection
  if (/[\u0A80-\u0AFF]/.test(t)) return 'gu_gujr'; // Gujarati
  if (/[\u0900-\u097F]/.test(t)) {
    // Devanagari (Hindi/Marathi)
    if (/(आहे|नाही|काय|कसा|कशी|माझा|माझी|तुमचा|तुमची)/.test(t)) return 'mr_deva';
    return 'hi_deva';
  }

  // Latin-script: look for Hinglish/Marathi/Gujarati common tokens
  const low = t.toLowerCase();
  const hasEnglish = /[a-z]/.test(low);
  const hasHinglish = /\b(kya|kyu|kaise|kitna|karna|karao|chahiye|batao|pahle|pehle|pickup|workshop|gadi|gaadi)\b/.test(low);
  const hasMarathiLatn = /\b(kay|kasa|kashe|ahe|nahi|tumhi|mala|majha|majhi)\b/.test(low);
  const hasGujaratiLatn = /\b(shu|kem|chhe|nathi|tame|mane|mara|mari)\b/.test(low);

  const flags = [hasHinglish, hasMarathiLatn, hasGujaratiLatn].filter(Boolean).length;
  if (flags >= 2) return 'mixed';
  if (hasGujaratiLatn) return 'gu_gujr';
  if (hasMarathiLatn) return 'mr_deva';
  if (hasHinglish) return 'hi_latn';
  if (hasEnglish) return 'en';
  return 'unknown';
}

type ScriptFamily =
  | 'latin'
  | 'devanagari'
  | 'gujarati'
  | 'bengali'
  | 'gurmukhi'
  | 'odia'
  | 'tamil'
  | 'telugu'
  | 'kannada'
  | 'malayalam'
  | 'other';

function detectScriptFamily(text: string): ScriptFamily {
  const t = text || '';
  if (/[A-Za-z]/.test(t)) return 'latin';
  if (/[\u0900-\u097F]/.test(t)) return 'devanagari';
  if (/[\u0A80-\u0AFF]/.test(t)) return 'gujarati';
  if (/[\u0980-\u09FF]/.test(t)) return 'bengali';
  if (/[\u0A00-\u0A7F]/.test(t)) return 'gurmukhi';
  if (/[\u0B00-\u0B7F]/.test(t)) return 'odia';
  if (/[\u0B80-\u0BFF]/.test(t)) return 'tamil';
  if (/[\u0C00-\u0C7F]/.test(t)) return 'telugu';
  if (/[\u0C80-\u0CFF]/.test(t)) return 'kannada';
  if (/[\u0D00-\u0D7F]/.test(t)) return 'malayalam';
  return 'other';
}

async function translateIfNeeded(userText: string, assistantText: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return assistantText;

  // If user wrote in Latin/Devanagari/Gujarati, our doc-mode already supports it well.
  // For other scripts/languages, translate doc-mode response into user's language/script.
  const script = detectScriptFamily(userText);
  if (script === 'latin' || script === 'devanagari' || script === 'gujarati') return assistantText;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You are a translation engine. Translate the assistant message into the same language and script as the user message. Keep it short, chat-style. Preserve emojis and numbers. Output ONLY the translated text.',
          },
          {
            role: 'user',
            content: `User message:\n${userText}\n\nAssistant message to translate:\n${assistantText}`,
          },
        ],
      }),
    });
    if (!res.ok) return assistantText;
    const json = (await res.json().catch(() => null)) as any;
    const out = json?.choices?.[0]?.message?.content;
    if (!out || typeof out !== 'string') return assistantText;
    return out.trim();
  } catch {
    return assistantText;
  }
}

function isGreeting(text: string) {
  const t = normalize(text);
  return /^(hi|hello|hey|hii|hlo|namaste|hola)\b/.test(t);
}

function isOnlySmallTalk(text: string) {
  const t = normalize(text);
  if (!t) return true;
  if (isGreeting(t)) return t.length <= 12;
  return /^(ok|okay|thanks|thank you|thx|cool|nice)\b/.test(t) && t.length <= 16;
}

function extractPhoneFromText(text: string): string | null {
  const digits = (text || '').replace(/\D/g, '');
  // India mobile numbers are 10 digits and typically start with 6/7/8/9.
  // This avoids false positives like "Jan 2025 / 100000" -> "2025100000".
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(last10)) return null;
  return last10;
}

function extractVehicleNumberFromText(text: string): string | null {
  // Rough Indian vehicle regex (best-effort)
  const m = (text || '')
    .toUpperCase()
    // State (2 letters) + RTO (1-2 digits) + series (1-3 letters) + number (3-4 digits)
    // Example: DL9CAY5551, MH12AB1234, GJ10DJ7477
    .match(/\b([A-Z]{2}\s?\d{1,2}\s?[A-Z]{1,3}\s?\d{3,4})\b/);
  if (!m) return null;
  return m[1].replace(/\s+/g, '');
}

function extractNameFromText(text: string): string | null {
  const t = (text || '').trim();
  const m = t.match(/\b(?:my name is|i am|i'm|main|mera naam)\s+([A-Za-z][A-Za-z\s]{1,30})/i);
  if (m?.[1]) return m[1].trim().replace(/\s+/g, ' ').slice(0, 32);
  return null;
}

function extractPickupPreference(text: string, opts?: { allowOptionNumber?: boolean }): boolean | null {
  const t = normalize(text);
  if (opts?.allowOptionNumber) {
    if (/^(1|pickup required|pickup)$/i.test(t)) return true;
    if (/^(2|self visit|self)$/i.test(t)) return false;
  }
  if (/(pickup|pick up|home pickup|pick-up|doorstep)/i.test(t)) return true;
  if (/(self|i will come|i'll come|drop off|visit workshop|workshop aunga|main aunga)/i.test(t)) return false;
  return null;
}

function extractLatLngFromMapLink(mapLink?: string | null): { lat: number; lng: number } | null {
  if (!mapLink) return null;
  try {
    const raw = decodeURIComponent(mapLink);
    const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const qp = raw.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qp) {
      const lat = Number(qp[1]);
      const lng = Number(qp[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    const center = raw.match(/[?&]center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (center) {
      const lat = Number(center[1]);
      const lng = Number(center[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // ignore
  }
  return null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

async function getNearestWorkshops(supabase: any, lat: number, lng: number) {
  const { data } = await supabase
    .from('workshops')
    .select('id,name,latitude,longitude,map_link,is_verified')
    .eq('is_verified', true)
    .limit(500);

  type Row = {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    map_link: string | null;
  };

  const rows = (data as unknown as Row[]) ?? [];
  const user = { lat, lng };

  const scored: Array<{ id: string; name: string; km: number }> = [];
  for (const w of rows) {
    let wLat = w.latitude;
    let wLng = w.longitude;
    if (typeof wLat !== 'number' || typeof wLng !== 'number' || !Number.isFinite(wLat) || !Number.isFinite(wLng)) {
      const fromLink = extractLatLngFromMapLink(w.map_link);
      if (fromLink) {
        wLat = fromLink.lat;
        wLng = fromLink.lng;
      }
    }
    if (typeof wLat !== 'number' || typeof wLng !== 'number' || !Number.isFinite(wLat) || !Number.isFinite(wLng)) continue;
    const km = haversineKm(user, { lat: wLat, lng: wLng });
    if (!Number.isFinite(km)) continue;
    scored.push({ id: w.id, name: w.name, km: Math.max(0, km) });
  }

  scored.sort((a, b) => a.km - b.km);
  return scored.slice(0, 3);
}

async function inferCityZoneFromAddress(supabase: any, addressText?: string | null) {
  const raw = (addressText || '').trim();
  if (!raw) return null as null | { cityId: string; cityName: string; zoneId: string | null };

  const parts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-4);

  const tokens: string[] = [];
  for (const p of parts) {
    const cleaned = p.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 3) tokens.push(cleaned);
  }

  const words = raw
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 6);
  tokens.push(...words);

  const seen = new Set<string>();
  const uniq = tokens.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (const token of uniq) {
    const { data } = await supabase
      .from('cities')
      .select('id, name, zone_id, is_active')
      .eq('is_active', true)
      .ilike('name', `%${token}%`)
      .limit(1);
    const row = (data || [])[0] as any;
    if (row?.id && row?.name) {
      return { cityId: row.id as string, cityName: row.name as string, zoneId: (row.zone_id as string) || null };
    }
  }

  return null;
}

async function searchCarModelsForAutocomplete(supabase: any, query: string): Promise<Array<{ id: string; make: string; model: string; variant?: string; vehicleClass?: string }>> {
  if (query.length < 2) return [];
  try {
    console.log(`[searchCarModels] Searching for: "${query}"`);

    const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = q.split(' ').filter(Boolean);
    const makePart = parts[0] || q;
    const modelPart = parts.slice(1).join(' ').trim();

    // Strategy:
    // - If user typed "tata tigor", search make ~ tata AND model_name ~ tigor
    // - If single token "tata", search in make OR model_name
    // - Fallback: OR across tokens in both columns

    const run = async (useActiveFilter: boolean) => {
      let base = supabase.from('car_models').select('id, make, model_name, variant, class').order('make').order('model_name').limit(8);
      if (useActiveFilter) base = base.eq('is_active', true);

      if (parts.length >= 2 && makePart.length >= 2 && modelPart.length >= 2) {
        // AND match (best for "tata tigor")
        return await base.ilike('make', `%${makePart}%`).ilike('model_name', `%${modelPart}%`);
      }

      if (parts.length === 1) {
        // OR match single token
        return await base.or(`make.ilike.%${q}%,model_name.ilike.%${q}%`);
      }

      // fallback OR across all tokens and columns
      const orBits = parts.flatMap((tkn) => [`make.ilike.%${tkn}%`, `model_name.ilike.%${tkn}%`]).join(',');
      return await base.or(orBits);
    };

    let { data, error } = await run(true);
    console.log(`[searchCarModels] Active filter result:`, { error, count: data?.length || 0, makePart, modelPart });

    if (error) {
      console.error('[searchCarModels] Database error:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('[searchCarModels] No results with is_active. Trying without filter...');
      const res2 = await run(false);
      data = res2.data;
      error = res2.error;
      console.log(`[searchCarModels] Without filter result:`, { error, count: data?.length || 0 });
      if (error) return [];
    }

    const rows = (data || []) as any[];
    return rows.map((c: any) => ({
      id: c.id,
      make: c.make,
      model: c.model_name,
      variant: c.variant || undefined,
      vehicleClass: c.class || undefined,
    }));
  } catch (e) {
    console.error('[searchCarModels] Exception:', e);
    return [];
  }
}

async function inferCarModelFromText(supabase: any, vehicleText?: string | null) {
  const raw = (vehicleText || '').trim();
  if (!raw) return null as null | { modelId: string; make: string; model: string; variant?: string | null; vehicleClass?: string | null };

  const t = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = t.split(/\s+/).filter(Boolean);
  const makeGuess = parts[0] || '';
  const modelGuess = parts.slice(1).join(' ').trim() || (parts[0] || t);

  // If user typed only a model word ("tigor"), do NOT apply make filter.
  // Also handle common make typos/synonyms (minimal).
  const KNOWN_MAKES = new Set([
    'maruti', 'suzuki', 'hyundai', 'tata', 'mahindra', 'honda', 'toyota', 'kia', 'mg', 'renault', 'nissan',
    'skoda', 'volkswagen', 'vw', 'ford', 'bmw', 'audi', 'mercedes', 'benz', 'jeep',
  ]);
  const shouldApplyMakeFilter = parts.length >= 2 && (KNOWN_MAKES.has(makeGuess) || makeGuess.length >= 4);

  let q = supabase
    .from('car_models')
    .select('id, make, model_name, variant, class, is_active')
    .eq('is_active', true)
    .limit(5);

  if (shouldApplyMakeFilter && makeGuess.length >= 3) q = q.ilike('make', `%${makeGuess}%`);
  if (modelGuess.length >= 3) q = q.ilike('model_name', `%${modelGuess}%`);

  let { data } = await q;

  if (!data || data.length === 0) {
    const res = await supabase
      .from('car_models')
      .select('id, make, model_name, variant, class, is_active')
      .eq('is_active', true)
      .ilike('model_name', `%${modelGuess}%`)
      .limit(5);
    data = res.data || [];
  }

  const rows = (data || []) as any[];
  if (rows.length === 0) return null;

  rows.sort((a, b) => `${a.make} ${a.model_name}`.toLowerCase().localeCompare(`${b.make} ${b.model_name}`.toLowerCase()));
  const best = rows[0];

  return {
    modelId: best.id,
    make: best.make,
    model: best.model_name,
    variant: best.variant || null,
    vehicleClass: best.class || null,
  };
}

function isWorkshopQuery(text: string) {
  const t = normalize(text);
  return /(near( me)?\s*workshop|nearest\s*workshop|workshop\s*near|close(st)?\s*workshop|nearby\s*workshop|near workshop|nearest garage)/i.test(
    t
  );
}

function extractLanguagePreference(text: string): 'en' | 'hi' | 'mr' | 'gu' | null {
  const raw = text || '';
  const t = raw.toLowerCase();
  // English phrases (common typos included)
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+guj(arati|rati|jrati)\b/.test(t)) return 'gu';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+marathi\b/.test(t)) return 'mr';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+hindi\b/.test(t)) return 'hi';
  if (/(reply|answer|tell|speak)\s+(me\s+)?(in)\s+english\b/.test(t)) return 'en';

  // Indic script keywords
  // Allow single-word commands like "gujrati", "gujarati'" etc.
  if (/^\s*(gujarati|gujrati)[^a-z]*\s*$/i.test(raw)) return 'gu';
  if (/^\s*(marathi)[^a-z]*\s*$/i.test(raw)) return 'mr';
  if (/^\s*(hindi)[^a-z]*\s*$/i.test(raw)) return 'hi';
  if (/^\s*(english)[^a-z]*\s*$/i.test(raw)) return 'en';

  if (/ગુજરાતી/.test(raw) || /\b(gujarati|gujrati)\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /ગુજરાતી/.test(raw)) return 'gu';
  }
  if (/मराठी/.test(raw) || /\bmarathi\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /मराठी/.test(raw)) return 'mr';
  }
  if (/हिंदी/.test(raw) || /\bhindi\b/.test(t)) {
    if (/\b(me|mein|ma)\b/.test(t) || /हिंदी/.test(raw)) return 'hi';
  }

  return null;
}

async function composeReply(params: {
  userMessage: string;
  context: ChatbotContext;
  stage?: string;
  deterministicFacts: any;
  fallback: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) return params.fallback;

  try {
    const dm = (params.context as any)?._dialog || null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: REPLY_COMPOSER_SYSTEM_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              userMessage: params.userMessage,
              replyLanguageHint: detectReplyLanguageHint(params.userMessage),
              preferredLanguage: params.context.preferredLanguage || 'auto',
              stage: params.stage || params.context.conversationStage || 'UNKNOWN',
              knownContext: {
                customerName: params.context.customerName || null,
                customerPhone: params.context.customerPhone ? 'provided' : null,
                pickupRequired: typeof params.context.pickupRequired === 'boolean' ? params.context.pickupRequired : null,
                addressText: params.context.addressText ? 'provided' : null,
                workshopName: params.context.workshopName || null,
                vehicleNumber: params.context.vehicleNumber ? 'provided' : null,
                vehicleModel: params.context.vehicleModel || null,
              },
              deterministicFacts: {
                ...(params.deterministicFacts || {}),
                ...(dm?.sales ? { sales: dm.sales } : {}),
              },
              fallback: params.fallback,
            }),
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('OpenAI reply composer failed:', res.status, res.statusText, errText);
      return params.fallback;
    }
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return params.fallback;
    return content.trim() || params.fallback;
  } catch {
    return params.fallback;
  }
}

function looksLikeConfirm(text: string) {
  const t = normalize(text);
  return (
    /^yes\b|^y\b|^haan\b|^ha\b|^ok\b|^okay\b|^confirm\b|^book\b|^proceed\b|^kar do\b|^kardo\b/.test(t) ||
    t.includes('book it') ||
    t.includes('go ahead') ||
    t.includes('proceed')
  );
}

function pickChoiceIndex(text: string) {
  const t = normalize(text);
  // Accept "1", "option 2", "#3"
  const m = t.match(/(?:option\s*)?#?(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n - 1;
}

function looksLikeDetailsQuery(text: string) {
  const t = normalize(text);
  return /(detail|details|include|included|inclusion|checklist|check\s*list|checkpoint|points?|kya\s*kya|kya\s*hai|meaning|matlab|explain|what\s+is|what's)/i.test(
    t
  );
}

function clipList(items: string[], max = 18) {
  if (!Array.isArray(items)) return [];
  if (items.length <= max) return items;
  return [...items.slice(0, max), `...and ${items.length - max} more`];
}

function renderOptions(options: SuggestedOption[]) {
  const lines: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const price =
      typeof opt.exactPrice?.amount === 'number' && opt.exactPrice.amount > 0
        ? ` (₹${Math.round(opt.exactPrice.amount).toLocaleString('en-IN')})`
        : opt.priceRange?.label
          ? ` (${opt.priceRange.label})`
          : '';
    lines.push(`• Option ${i + 1}: ${opt.suggestion.name}${price}`);
  }
  return lines.join('\n');
}

function renderOptionsWithOffset(options: SuggestedOption[], offset: number) {
  const lines: string[] = [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const price =
      typeof opt.exactPrice?.amount === 'number' && opt.exactPrice.amount > 0
        ? ` (₹${Math.round(opt.exactPrice.amount).toLocaleString('en-IN')})`
        : opt.priceRange?.label
          ? ` (${opt.priceRange.label})`
          : '';
    lines.push(`• Option ${offset + i + 1}: ${opt.suggestion.name}${price}`);
  }
  return lines.join('\n');
}

function safetyEmergencyMessage() {
  return [
    "Ye emergency lag rahi hai (accident/fire/injury).",
    'Please call emergency services immediately (112/108) and move to a safe place if possible.',
    'Main yahan booking attempt nahi karunga.',
  ].join('\n');
}

function safetyComplaintMessage() {
  return [
    'Samajh gaya — aapko complaint/issue hai.',
    'Main abhi isko human support team ko escalate kar raha hoon.',
    'Please apna registered mobile number + lead/booking ID share kar dijiye (agar available ho).',
  ].join('\n');
}

async function bestEffortLog(supabase: any, payload: { conversationId: string; context: ChatbotContext; userText: string; botText: string; meta: any }) {
  // Logging is optional (tables may or may not exist). We do best-effort.
  const { db } = getRagDbClient(supabase);
  try {
    await db.from('chatbot_conversations').upsert({
      id: payload.conversationId,
      customer_phone: payload.context.customerPhone || null,
      customer_name: payload.context.customerName || null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }

  try {
    await db.from('chatbot_messages').insert([
      {
        conversation_id: payload.conversationId,
        role: 'user',
        message_text: payload.userText,
        created_at: new Date().toISOString(),
        metadata: payload.meta || null,
      },
      {
        conversation_id: payload.conversationId,
        role: 'assistant',
        message_text: payload.botText,
        created_at: new Date().toISOString(),
        metadata: payload.meta || null,
      },
    ]);
  } catch {
    // ignore
  }
}

async function bestEffortCaptureKbQuestion(params: {
  supabase: any;
  conversationId: string;
  context: ChatbotContext;
  userText: string;
  assistantText: string;
  intent: any;
  reason: 'no_answer' | 'handoff' | 'uncertain';
}) {
  // Capture for human review -> later added to KB (kb_sources) -> kb-ingest updates embeddings.
  // Uses service role if available; otherwise best-effort on the request client.
  try {
    const { db } = getRagDbClient(params.supabase);
    await db.from('kb_question_events').insert({
      conversation_id: params.conversationId,
      source: 'chatbot',
      user_message: params.userText,
      assistant_message: params.assistantText,
      intent: params.intent || null,
      context: {
        ...(params.context || {}),
        // Avoid keeping large/internal fields
        _dialog: undefined,
      },
      status: 'new',
      triage_notes: `auto-captured:${params.reason}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch {
    // ignore
  }
}

function buildResponseText(params: {
  why?: string;
  options: SuggestedOption[];
  intentLabel?: string;
  needs: string[];
  selectedOptionName?: string;
}) {
  const out: string[] = [];

  if (params.why) {
    out.push(`Jo aapne bataya uske basis par, ${params.why}`);
    out.push('');
  }

  if (params.options.length > 0) {
    out.push('Recommended options (pricing as per your city & car):');
    out.push(renderOptions(params.options));
    out.push('');
    out.push('Note: Taxes/variants may affect final invoice.');
  }

  if (params.needs.length > 0) {
    // Ask only the most necessary follow-up first (avoid long checklist).
    const first = params.needs[0];
    out.push(`Ek chhota sa sawal: ${first}?`);
  }

  if (params.options.length > 0) {
    if (params.selectedOptionName) {
      out.push('');
      out.push(`Selected: ${params.selectedOptionName}`);
    }
    out.push('');
    out.push('Aap chahein to main booking create kar doon. (Reply: “Yes, book option 1”)');
  }

  return out.join('\n');
}

function extractPaymentMethodFromText(
  text: string,
  opts?: { allowOptionNumber?: boolean }
): 'UPI' | 'CARD' | 'CASH' | 'PAY_LATER' | null {
  const t = normalize(text);
  if (!t) return null;

  // Option numbers
  if (opts?.allowOptionNumber) {
    const m = t.match(/\b([1-4])\b/);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (n === 1) return 'UPI';
      if (n === 2) return 'CARD';
      if (n === 3) return 'CASH';
      if (n === 4) return 'PAY_LATER';
    }
  }

  if (/(upi|gpay|google pay|phonepe|paytm|online)/i.test(text)) return 'UPI';
  if (/(card|credit|debit|visa|master)/i.test(text)) return 'CARD';
  if (/(cash|cod|pay cash)/i.test(text)) return 'CASH';
  if (/(pay later|later|workshop me|at workshop)/i.test(text)) return 'PAY_LATER';
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as ChatbotMessageRequest | null;
  if (!body?.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const supabase = await createClient();

  const context: ChatbotContext = body.context || {};
  const conversationId = context.conversationId || newConversationId();

  // ============================
  // LLM-led dialog planning (optional)
  // - Uses OpenAI for understanding + "next best question" + sales benefits
  // - DB remains the source of truth for services/pricing/workshops
  // ============================
  const plan = await planNextStep({ userMessage: body.message, context });
  const planAsk = (plan?.next?.ask || '').trim() || null;
  // Attach to context for downstream reply composition (kept server-side only)
  (context as any)._dialog = plan
    ? {
        goal: plan.goal,
        confidence: plan.confidence,
        sales: plan.sales,
        next: plan.next,
      }
    : null;

  // Apply extracted fields if not already present
  if (plan?.extracted) {
    // Don't let the LLM overwrite car model on "option number" messages (can hallucinate).
    const isOptionOnly = pickChoiceIndex(body.message) !== null && /\boption\b/i.test(body.message);
    if (!context.customerName && plan.extracted.customerName) {
      const rawName = String(plan.extracted.customerName).trim().replace(/\s+/g, ' ').slice(0, 32);
      const n = normalize(rawName);
      const bad = new Set(['upi', 'card', 'cash', 'pay later', 'pay_later', 'pickup', 'self', 'yes', 'no', 'ok', 'okay']);
      const hasLetter = /[A-Za-z\u0900-\u097F]/.test(rawName);
      if (rawName.length >= 2 && rawName.length <= 32 && hasLetter && !bad.has(n)) {
        context.customerName = rawName;
      }
    }
    if (!context.customerPhone && plan.extracted.customerPhone) context.customerPhone = String(plan.extracted.customerPhone).replace(/\D/g, '').slice(-10);
    if (!context.vehicleNumber && plan.extracted.vehicleNumber) context.vehicleNumber = String(plan.extracted.vehicleNumber).toUpperCase().replace(/\s+/g, '');
    if (!isOptionOnly && !context.vehicleModel && plan.extracted.vehicleMakeModelText) {
      context.vehicleModel = String(plan.extracted.vehicleMakeModelText).trim();
    }
    if (typeof context.pickupRequired !== 'boolean' && typeof plan.extracted.pickupRequired === 'boolean') context.pickupRequired = plan.extracted.pickupRequired;
    if (!context.paymentMethod && plan.extracted.paymentMethod) context.paymentMethod = plan.extracted.paymentMethod;
    if (!context.addressText && plan.extracted.locationText) context.addressText = String(plan.extracted.locationText).trim().slice(0, 160);
    if (!context.problemDescription && plan.extracted.problemDescription) context.problemDescription = String(plan.extracted.problemDescription).trim().slice(0, 240);
  }

  // Detect intent + safety
  const intent = await detectIntent(body.message);

  // Best-effort: extract structured fields from free text so UI doesn't need forms.
  // (Still deterministic, no workflow bypass.)
  const hadPhone = Boolean(context.customerPhone);
  const extractedPhone = extractPhoneFromText(body.message);
  const capturedPhoneThisTurn = Boolean(extractedPhone) && !hadPhone;
  if (extractedPhone && !hadPhone) context.customerPhone = extractedPhone;

  const extractedName = extractNameFromText(body.message);
  if (extractedName && !context.customerName) context.customerName = extractedName;

  const extractedVehicle = extractVehicleNumberFromText(body.message);
  if (extractedVehicle && !context.vehicleNumber) context.vehicleNumber = extractedVehicle;

  const pickupPref = extractPickupPreference(body.message, { allowOptionNumber: context.conversationStage === 'NEED_PICKUP_PREF' });
  if (pickupPref !== null && typeof context.pickupRequired !== 'boolean') context.pickupRequired = pickupPref;

  // Capture payment method if user is selecting it (typed text or option number).
  const extractedPayment = extractPaymentMethodFromText(body.message, { allowOptionNumber: context.conversationStage === 'NEED_PAYMENT' });
  if (extractedPayment && !context.paymentMethod) context.paymentMethod = extractedPayment;

  // If intent detector extracted a locationText, keep it as addressText.
  const locText = intent.extracted?.locationText;
  if (locText && !context.addressText) context.addressText = locText;

  // If UI already provided a vehicleModel string (or we captured it earlier),
  // resolve it to modelId early so the funnel doesn't re-ask "car model" unnecessarily.
  if (!context.modelId && context.vehicleModel) {
    const inferred = await inferCarModelFromText(supabase, context.vehicleModel);
    if (inferred) {
      context.modelId = inferred.modelId;
      context.vehicleMake = inferred.make;
      context.vehicleModel = inferred.model;
      context.vehicleVariant = inferred.variant || null;
      context.vehicleClass = inferred.vehicleClass || null;
    }
  }

  // Explicit language preference should be handled immediately (even before funnel gating).
  const langPref = extractLanguagePreference(body.message);
  if (langPref) {
    context.preferredLanguage = langPref;
    const fallback =
      langPref === 'gu'
        ? 'ઠીક છે — હવે હું ગુજરાતીમાં જવાબ આપીસ.'
        : langPref === 'mr'
          ? 'ठीक आहे — आता मी मराठीत उत्तर देईन.'
          : langPref === 'hi'
            ? 'Theek hai — ab main Hindi me reply karunga.'
            : 'Sure — I will reply in English.';

    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'LANGUAGE_PREFERENCE_SET',
      deterministicFacts: { preferredLanguage: langPref },
      fallback,
    });

    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, preferredLanguage: langPref },
    };
    await bestEffortLog(supabase, {
      conversationId,
      context,
      userText: body.message,
      botText: assistantMessage,
      meta: { intent, preferredLanguage: langPref },
    });
    return NextResponse.json(resp);
  }

  // ============================
  // Quick FAQ / info answers (works even when doc-mode is OFF)
  // - warranty, pickup/drop, GST, genuine parts, workshop/self-drop questions
  // ============================
  const qLang = pickDocLang(context, body.message);
  const faq = docKnowledgeAnswer(qLang, body.message);
  const wantsWorkshopLoc = isWorkshopAddressQuery(body.message);
  const wantsSelfDrop = isSelfDropQuery(body.message);

  // This intercept is only for the non-doc workflow.
  // In doc-mode, we handle KB/guardrails inside the doc-mode block so we can continue the funnel correctly.
  if (!DOC_MODE_ENABLED && (faq || wantsWorkshopLoc || wantsSelfDrop)) {
    const info =
      faq ||
      (wantsSelfDrop
        ? docLine(
            qLang,
            'Yes, self-drop is possible. Share your City/Area and I’ll guide you to the nearest workshop option. (Pickup & drop is also free 🚗)',
            'Haan, self-drop possible hai. Aap apna City/Area bata dijiye — main nearest workshop option guide kar dunga. (Pickup & drop free hai 🚗)',
            'Haan, self-drop possible hai. City/Area bata do — main nearest workshop option guide kar dunga. (Pickup & drop free hai 🚗)'
          )
        : docLine(
            qLang,
            'We operate in multiple cities. Share your City/Area and I’ll guide you to the nearest workshop option. (Pickup & drop is also free 🚗)',
            'Hum multiple cities me hain. Aap apna City/Area bata dijiye — main nearest workshop option guide kar dunga. (Pickup & drop free hai 🚗)',
            'Hum multiple cities me hain. City/Area bata do — main nearest workshop option guide kar dunga. (Pickup & drop free hai 🚗)'
          ));

    const followUp = docLine(
      qLang,
      'What do you need today — regular service, repair/issue, or cleaning/detailing?',
      'Aapko kya chahiye — regular service, repair/issue, ya cleaning/detailing?',
      'Aapko kya chahiye — regular service, repair/issue, ya cleaning/detailing?'
    );

    const assistantMessage = [info, followUp].filter(Boolean).join('\n\n');
    const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: { conversationId } };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'faq_intercept' } });
    return NextResponse.json(resp);
  }

  // ============================
  // Payment link quick action (user can ask "pay now" anytime)
  // ============================
  const rawPayMsg = normalize(body.message);
  const wantsPayLink = /(pay\s*now|payment\s*link|pay link|upi\s*link|pay online|make payment|pay invoice)/i.test(body.message);
  const wantsAdvance = /(advance|token|booking token)/i.test(body.message);
  const wantsInvoicePay = /(invoice|full payment|remaining)/i.test(body.message);

  const extractAmountFromText = (text: string): number | null => {
    // pick the first 2-6 digit number as INR
    const m = text.replace(/[,₹]/g, ' ').match(/\b(\d{2,6})\b/);
    if (!m?.[1]) return null;
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  if (wantsPayLink) {
    const leadId = context.leadId || null;
    if (!leadId) {
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'PAYMENT_NO_LEAD',
        deterministicFacts: { next: 'collect_booking_details' },
        fallback: 'Payment link share karne se pehle main aapki booking details confirm kar leta hoon. Aap apni car model + issue + location bata doge?',
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'pay_no_lead' } });
      return NextResponse.json(resp);
    }

    const paymentType = wantsInvoicePay ? 'INVOICE' : wantsAdvance ? 'ADVANCE' : 'BOOKING_TOKEN';
    const amountOverride = paymentType === 'ADVANCE' ? extractAmountFromText(body.message) : null;
    const bookingTokenAmount = paymentType === 'BOOKING_TOKEN' ? await resolveBookingTokenAmount() : null;

    const desiredAmount = paymentType === 'BOOKING_TOKEN' ? bookingTokenAmount : paymentType === 'ADVANCE' ? amountOverride : null;

    try {
      const invoice = await ensureInvoiceForLead({
        leadId,
        desiredAmount: desiredAmount || null,
        purpose: paymentType,
      });

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const longUrl = `${appUrl}/invoice/${invoice.invoice_number}`;
      const short = await createShortUrl(longUrl, 'invoice', invoice.id);

      const assistantMessage = [
        'Here is your payment link:',
        short.shortUrl || longUrl,
        '',
        'Aap UPI / Card se pay kar sakte ho.',
      ].join('\n');

      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: {
          conversationId,
          leadId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          paymentType: paymentType as any,
          paymentShortUrl: short.shortUrl || longUrl,
        },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'pay_link', paymentType } });
      return NextResponse.json(resp);
    } catch (e: any) {
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'PAYMENT_LINK_ERROR',
        deterministicFacts: { error: e?.message || 'unknown' },
        fallback: 'Payment link generate nahi ho paaya. Our service expert will guide you on call.',
      });
      const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: { conversationId, leadId } };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'pay_link_error' } });
      return NextResponse.json(resp, { status: 500 });
    }
  }

  // ============================
  // DOC MODE: strict sales-first flow + fallback rules
  // ============================
  // IMPORTANT: doc-mode must be explicitly enabled via env; don't let stale client context force it.
  if (DOC_MODE_ENABLED && context.docMode !== false) {
    const lang = pickDocLang(context, body.message);
    const ctxPatch: Partial<ChatbotContext> = { conversationId };

    // Strict step-by-step capture (one field per user message)
    // This prevents wrong captures like using "Hyundai Creta" as last-service/location.
    const raw = (body.message || '').trim();
    const needFromText = isNeedAnalysisAnswer(raw);
    const isKnowledgeTurn = Boolean(docKnowledgeAnswer(lang, raw) || isPricingQuery(raw) || isWorkshopAddressQuery(raw));

    // 1) Need type
    if (!context.docNeedType) {
      if (needFromText) ctxPatch.docNeedType = needFromText;
    } else if (!isKnowledgeTurn && !context.docCarModelText && !context.vehicleModel) {
      // 2) Car model (Make + Model)
      if (raw.length >= 3 && !extractPhoneFromText(raw) && !isPricingQuery(raw) && !isWorkshopAddressQuery(raw)) {
        if (!/(today|tomorrow|this week|later this week)/i.test(raw) && !needFromText) {
          ctxPatch.docCarModelText = raw.slice(0, 40);
        }
      }
    } else if (!isKnowledgeTurn && !context.docLastServiceText) {
      // 3) Last service / KM run
      if (raw.length >= 2 && !extractPhoneFromText(raw) && !isPricingQuery(raw) && !isWorkshopAddressQuery(raw)) {
        // Avoid capturing another car model
        if (!/(hyundai|maruti|suzuki|tata|mahindra|honda|toyota|kia|mg|renault|nissan|skoda|volkswagen|creta|swift|i10|i20)/i.test(raw)) {
          ctxPatch.docLastServiceText = raw.slice(0, 60);
        }
      }
    } else if (!isKnowledgeTurn && !context.docLocationText && !context.addressText && !context.cityName) {
      // 4) Location
      if (raw.length >= 3 && !extractPhoneFromText(raw) && !isPricingQuery(raw) && !isWorkshopAddressQuery(raw)) {
        ctxPatch.docLocationText = raw.slice(0, 80);
      }
    } else if (!isKnowledgeTurn && !context.docPreferredServiceDateText) {
      // 5) Preferred date
      if (/(today|tomorrow|this week|later this week)/i.test(raw)) {
        ctxPatch.docPreferredServiceDateText = raw;
      }
    } else if (!isKnowledgeTurn && !context.customerPhone) {
      // 6) Phone (for callback)
      const extractedPhone = extractPhoneFromText(raw);
      if (extractedPhone) ctxPatch.customerPhone = extractedPhone;
    }

    // If we captured car model text, resolve it to modelId/vehicleClass for better downstream understanding.
    if (ctxPatch.docCarModelText && !context.modelId) {
      const inferred = await inferCarModelFromText(supabase, ctxPatch.docCarModelText);
      if (inferred) {
        ctxPatch.modelId = inferred.modelId;
        ctxPatch.vehicleMake = inferred.make;
        ctxPatch.vehicleModel = inferred.model;
        ctxPatch.vehicleVariant = inferred.variant || null;
        ctxPatch.vehicleClass = inferred.vehicleClass || null;
      }
    }

    // Sprinkling USP after each newly captured answer (except in guardrail replies)
    const mergedCtxForNext = { ...(context as any), ...(ctxPatch as any) };

    // Handle guardrails / KB answers first
    if (isPricingQuery(body.message)) {
      const kb = docLine(
        lang,
        'Our service expert will share the exact pricing for your car model during the callback 📞.',
        'Our service expert will share the exact pricing for your car model during the callback 📞.',
        'Our service expert will share the exact pricing for your car model during the callback 📞.'
      );
      const nextQ = buildDocNextQuestion(lang, mergedCtxForNext);
      let assistantMessage = [kb, nextQ].filter(Boolean).join('\n');
      assistantMessage = await translateIfNeeded(body.message, assistantMessage);
      const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: ctxPatch };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, mode: 'doc', step: 'pricing_guardrail' } });
      return NextResponse.json(resp);
    }

    if (isWorkshopAddressQuery(body.message)) {
      const kb = docLine(
        lang,
        'Pickup & drop is free 🚗. Our service expert will confirm the workshop location when they call you.',
        'Pickup & drop is free 🚗. Our service expert will confirm the workshop location when they call you.',
        'Pickup & drop is free 🚗. Our service expert will confirm the workshop location when they call you.'
      );
      const nextQ = buildDocNextQuestion(lang, mergedCtxForNext);
      let assistantMessage = [kb, nextQ].filter(Boolean).join('\n');
      assistantMessage = await translateIfNeeded(body.message, assistantMessage);
      const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: ctxPatch };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, mode: 'doc', step: 'address_guardrail' } });
      return NextResponse.json(resp);
    }

    let kb = docKnowledgeAnswer(lang, body.message);
    const nextQ = buildDocNextQuestion(lang, mergedCtxForNext);

    // If complete (including optional vehicle number), close.
    const isComplete =
      Boolean(mergedCtxForNext.docNeedType) &&
      Boolean(mergedCtxForNext.customerPhone) &&
      Boolean(mergedCtxForNext.docCarModelText || mergedCtxForNext.vehicleModel) &&
      Boolean(mergedCtxForNext.docLastServiceText) &&
      Boolean(mergedCtxForNext.docLocationText || mergedCtxForNext.addressText || mergedCtxForNext.cityName) &&
      Boolean(mergedCtxForNext.docPreferredServiceDateText);

    if (isComplete && !nextQ) {
      let assistantMessage = docClosing(lang, mergedCtxForNext);
      assistantMessage = await translateIfNeeded(body.message, assistantMessage);
      const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: ctxPatch };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, mode: 'doc', step: 'done' } });
      return NextResponse.json(resp);
    }

    // Sprinkle one USP only after capturing a new slot (best-effort)
    const didCaptureSomething =
      Boolean(ctxPatch.docNeedType && !context.docNeedType) ||
      Boolean(ctxPatch.customerPhone && !context.customerPhone) ||
      Boolean(ctxPatch.docCarModelText && !context.docCarModelText) ||
      Boolean(ctxPatch.docLastServiceText && !context.docLastServiceText) ||
      Boolean(ctxPatch.docLocationText && !context.docLocationText) ||
      Boolean(ctxPatch.docPreferredServiceDateText && !context.docPreferredServiceDateText) ||
      Boolean(ctxPatch.vehicleNumber && !context.vehicleNumber);

    // If not a simple slot-fill answer, try Vector KB (Supabase pgvector) for better accuracy.
    // We do this before out-of-KB escalation so we only escalate when retrieval is weak.
    const looksLikeQuestion = /\?/.test(body.message || '');
    const looksLikeKbTopic = /(warranty|gst|tax|amc|subscription|dent|paint|denting|painting|cng|genuine|oem|oes|proof|video|invoice|support|inspection)/i.test(body.message || '');
    if (!kb && !didCaptureSomething && (looksLikeQuestion || looksLikeKbTopic)) {
      try {
        kb = (await vectorKbAnswer(supabase, lang, body.message)) || null;
      } catch {
        // ignore retrieval errors
      }
    }

    // Out-of-KB escalation (doc rule): if user asks a question we don't recognize, handoff to expert briefly and continue funnel.
    const shouldEscalate =
      looksLikeQuestion &&
      !kb &&
      !isPricingQuery(body.message) &&
      !isWorkshopAddressQuery(body.message) &&
      !needFromText &&
      !didCaptureSomething &&
      !isOnlySmallTalk(body.message);

    const kbOrEscalation = shouldEscalate
      ? docLine(
          lang,
          'I’ll connect you with our service expert 👨‍💼 who can guide you better.',
          'I’ll connect you with our service expert 👨‍💼 who can guide you better.',
          'I’ll connect you with our service expert 👨‍💼 who can guide you better.'
        )
      : kb;

    if (didCaptureSomething) {
      const { usp, nextIndex } = nextUsp(mergedCtxForNext);
      ctxPatch.docUspIndex = nextIndex;
      let assistantMessage = [kbOrEscalation, usp, nextQ].filter(Boolean).join('\n');
      assistantMessage = await translateIfNeeded(body.message, assistantMessage);
      const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: ctxPatch };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, mode: 'doc', step: 'next_with_usp' } });
      return NextResponse.json(resp);
    }

    // Default: just ask next
    let assistantMessage = [kbOrEscalation, nextQ].filter(Boolean).join('\n');
    assistantMessage = await translateIfNeeded(body.message, assistantMessage);
    const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: ctxPatch };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, mode: 'doc', step: 'next' } });

    // Capture unknown questions for review
    if (shouldEscalate) {
      await bestEffortCaptureKbQuestion({
        supabase,
        conversationId,
        context,
        userText: body.message,
        assistantText: assistantMessage,
        intent,
        reason: 'handoff',
      });
    }

    return NextResponse.json(resp);
  }

  // NOTE: Avoid "stage-aware" name capture. It caused false positives like
  // category/service keywords (e.g. "periodic", "upi") being stored as customerName.
  // We only capture names via explicit patterns (extractNameFromText / LLM extracted) or when UI sends it.

  if (context.conversationStage === 'NEED_LOCATION' && !context.addressText) {
    const raw = (body.message || '').trim();
    if (raw.length >= 4 && !/^(pickup|self|ok|okay|yes|no)$/i.test(raw)) {
      context.addressText = raw.slice(0, 160);
    }
  }

  if (context.conversationStage === 'NEED_CAR_MODEL') {
    const choiceIdx = pickChoiceIndex(body.message);
    // Only set if user selected an option number from suggestions
    if (choiceIdx !== null && context.carModelSuggestions && context.carModelSuggestions[choiceIdx]) {
      const selected = context.carModelSuggestions[choiceIdx];
      context.modelId = selected.id;
      context.vehicleMake = selected.make;
      context.vehicleModel = `${selected.make} ${selected.model}`;
      context.vehicleVariant = selected.variant || undefined;
      context.vehicleClass = (selected as any).vehicleClass || undefined;
    }
    // If user is typing (not selecting), DON'T set vehicleModel yet - let autocomplete step handle it
  }

  // Capture service category selection (book-service style tabs)
  const categoryText = (body.message || '').trim().toUpperCase();
  const KNOWN_CATEGORIES = new Set([
    'PERIODIC SERVICE',
    'AC SERVICE',
    'BATTERY SERVICE',
    'BRAKE SERVICE',
    'CLUTCH SERVICE',
    'DENTING PAINTING',
    'TYRE & WHEEL CARE',
    'DETAILING SERVICE',
    'ENGINE SERVICE',
    'OTHER SERVICES',
  ]);
  if (KNOWN_CATEGORIES.has(categoryText)) {
    context.serviceCategory = categoryText;
    // Nudge issue text for resolver without polluting with generic "service" token
    if (!context.problemDescription) context.problemDescription = categoryText;
  }
  // Also infer category from free text (e.g. "need periodic service", "ac service", "battery issue").
  if (!context.serviceCategory && context.docMode === false) {
    const menu = renderCategoryMenu();
    const inferred = resolveCategoryFromFreeText(String(body.message || ''), menu.cats);
    if (inferred) {
      context.serviceCategory = inferred;
      if (!context.problemDescription) context.problemDescription = inferred;
      // If user is asking for a category directly, treat it like entering the catalog flow.
      (context as any).catalogStage = (context as any).catalogStage || 'SERVICE_LIST';
    }
  }

  if (intent.flags.includes('EMERGENCY')) {
    const assistantMessage = safetyEmergencyMessage();
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  if (intent.flags.includes('COMPLAINT')) {
    const assistantMessage = safetyComplaintMessage();
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STATUS intent (read-only guidance)
  if (intent.intent === 'STATUS') {
    const assistantMessage =
      'Booking status check karne ke liye please apna Lead Number (example: L-12345678) share kar dijiye.';
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // Read-only: nearest workshop query should be answered even before phone verification.
  if (isWorkshopQuery(body.message)) {
    const hasCoords = Number.isFinite(context.locationLat as number) && Number.isFinite(context.locationLng as number);
    if (!hasCoords) {
      const fallback = 'Nearest workshop batane ke liye aap apna area/city share kar dijiye (ya location allow kar dijiye).';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'READONLY_WORKSHOP_QUERY',
        deterministicFacts: { need: 'location', note: 'cannot compute nearest without coords' },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
      return NextResponse.json(resp);
    }

    const nearest = await getNearestWorkshops(supabase, context.locationLat as number, context.locationLng as number);
    // If computed nearest is unrealistically far, treat location as missing/incorrect and ask again.
    if (nearest[0] && nearest[0].km > 200) {
      const fallback =
        'Mujhe aapki location clear nahi mil rahi (workshops bahut door show ho rahe hain). Aap apna area/city+pincode share kar dijiye ya location allow kar dijiye.';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'READONLY_WORKSHOP_QUERY',
        deterministicFacts: { need: 'better_location', note: 'nearest_too_far_km', km: Number(nearest[0].km.toFixed(1)) },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
      return NextResponse.json(resp);
    }
    const list = nearest.map((w, i) => ({ index: i + 1, name: w.name, km: Number(w.km.toFixed(1)) }));
    const fallback =
      nearest.length > 0
        ? ['Nearest workshops:', ...nearest.map((w, i) => `• Workshop ${i + 1}: ${w.name} (${w.km.toFixed(1)} km)`)].join('\n')
        : 'Is location ke aas-paas verified workshops nahi mil rahe.';

    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'READONLY_WORKSHOP_QUERY',
      deterministicFacts: { nearest: list },
      fallback,
    });

    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, conversationStage: context.conversationStage || 'NEED_PHONE' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, nearest: list } });
    return NextResponse.json(resp);
  }

  // ============================================
  // NEW 6-STEP FUNNEL (matches book-service page)
  // Order: Location → Car Model → Phone → Issue → Pickup → Payment
  // ============================================

  // Non-doc mode: try KB/RAG for free-text questions (then continue funnel).
  // This improves "customer wrote free text" handling without breaking deterministic workflow.
  if (!DOC_MODE_ENABLED || context.docMode === false) {
    const q = String(body.message || '').trim();
    const looksLikeQuestion = /\?/.test(q) || /^(what|why|how|which|where|when)\b/i.test(q);
    const looksLikeKbTopic = /(warranty|gst|tax|amc|subscription|dent|paint|denting|painting|cng|genuine|oem|oes|proof|video|invoice|include|included|inclusion|checklist|points)/i.test(q);
    if ((looksLikeQuestion || looksLikeKbTopic) && !isPricingQuery(q) && !isWorkshopAddressQuery(q)) {
      const lang = pickDocLang(context, q);
      const kb = await vectorKbAnswer(supabase, lang, q).catch(() => null);
      if (kb) {
        let nextQ: string | null = null;
        // Continue the funnel with the minimum next question.
        if (!context.modelId && !context.vehicleModel) {
          nextQ = 'Aapki car model kaunsa hai? (Example: Tata Tigor / Maruti Swift / Hyundai i20)';
        } else if (!context.customerPhone) {
          nextQ = 'Callback ke liye 10-digit mobile number share kar dijiye.';
        } else if (!context.problemDescription) {
          nextQ = 'Ab aapki car me kya issue hai / kaunsi service chahiye? (Example: general service, AC cooling, brake noise)';
        }

        const assistantMessage = [kb, nextQ].filter(Boolean).join('\n\n');
        const resp: ChatbotResponse = { conversationId, intent, assistantMessage, contextPatch: { conversationId } };
        await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'kb_non_doc' } });
        return NextResponse.json(resp);
      }
    }
  }

  // Friendly greeting/small talk: respond naturally
  if (isOnlySmallTalk(body.message)) {
    const fallback =
      'Hi! Aapko kis cheez me help chahiye — RSA (roadside) ya car service? Aap 1–2 lines me problem bata dijiye.';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'SMALLTALK',
      deterministicFacts: { ask: 'problem_or_rsa' },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId, preferredLanguage: context.preferredLanguage || 'auto', conversationStage: 'INITIAL' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STEP 1: LOCATION (usually pre-detected from browser, skip if available)
  // We skip this step as location is auto-detected on frontend
  
  // STEP 2: CAR MODEL (with autocomplete suggestions)
  if (!context.modelId) {
    // If user asks for categories/options before providing car model, show category carousel/menu.
    // (Important: this prevents "options" from being misinterpreted as a car model query.)
    if (
      context.docMode === false &&
      /(all options|more options|koi aur option|koi aur service|aur option|aur service|options|service options|show services|services list|service list|menu|categories)/i.test(
        body.message
      )
    ) {
      const menu = renderCategoryMenu();
      const assistantMessage = menu.text;
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        ui: {
          kind: 'CATEGORY_CAROUSEL',
          title: 'Choose a category',
          items: menu.cats.map((c) => ({ id: c, label: categoryLabel(c) })),
        },
        contextPatch: { ...baseContextPatch(context, conversationId), catalogStage: 'CATEGORY_MENU', catalogServiceOptionIds: [], catalogOptionChoices: [] },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_menu_before_model' } });
      return NextResponse.json(resp);
    }

    // If user is replying with an option number (service selection), don't run car-model inference.
    // Otherwise "option 6" can mistakenly match models like "XL6".
    const isOptionMsg = pickChoiceIndex(body.message) !== null && /\boption\b/i.test(body.message);
    if (
      context.docMode === false &&
      (Boolean(context.serviceCategory) ||
        isOptionMsg ||
        (Array.isArray((context as any).lastOptionChoices) && (context as any).lastOptionChoices.length > 0) ||
        (Array.isArray((context as any).catalogServiceOptionIds) && (context as any).catalogServiceOptionIds.length > 0))
    ) {
      // skip step-2; selection handlers below will take over
    } else {
    // If user typed an issue first (e.g. "car band hai"), preserve it so after model capture we can suggest correctly.
    if (!context.problemDescription) {
      const rawMsg = String(body.message || '').trim();
      const low = rawMsg.toLowerCase();
      const looksLikeIssue =
        /(band|start\s*nahi|start\s*nhi|nahi\s*start|nhi\s*start|not starting|won't start|wont start|breakdown|stuck|clicking|battery|jump ?start|puncture|ac|brake|noise|vibration|repair|issue|problem)/i.test(
          low
        );
      const looksLikeCarName = /\b(tata|maruti|hyundai|mahindra|honda|toyota|kia|mg|renault|nissan|ford|skoda|volkswagen|vw|bmw|audi)\b/i.test(
        rawMsg
      );
      if (looksLikeIssue && !looksLikeCarName) {
        context.problemDescription = rawMsg.slice(0, 240);
      }
    }

    // Try to extract car model query from user message
    const carQuery = body.message.trim();
    let carSuggestions: any[] = [];
    
    // Always provide autocomplete if user is typing a car name
    if (carQuery.length >= 2 && !/^(yes|no|ok|haan|nahi|ha|service|rsa)\b/i.test(carQuery)) {
      carSuggestions = await searchCarModelsForAutocomplete(supabase, carQuery);
      console.log(`[CHATBOT] Car search for "${carQuery}":`, carSuggestions.length, 'results');
    }

    // If user typed a full car name and we found exactly one strong match, auto-select and continue to phone.
    if (carSuggestions.length === 1 && /\s/.test(carQuery)) {
      const only = carSuggestions[0];
      context.modelId = only.id;
      context.vehicleMake = only.make;
      context.vehicleModel = `${only.make} ${only.model}${only.variant ? ` ${only.variant}` : ''}`.trim();
      context.vehicleVariant = only.variant || undefined;
      context.vehicleClass = (only as any).vehicleClass || undefined;
    }

    // Also support single-token models (e.g. "creta", "tiago") via DB inference.
    // IMPORTANT: if autocomplete has multiple results, don't auto-pick; let user choose make+model.
    if (!context.modelId && carSuggestions.length <= 1 && carQuery.length >= 2 && !/^(yes|no|ok|haan|nahi|ha)\b/i.test(carQuery)) {
      const inferred = await inferCarModelFromText(supabase, carQuery);
      if (inferred) {
        context.modelId = inferred.modelId;
        context.vehicleMake = inferred.make;
        context.vehicleModel = `${inferred.make} ${inferred.model}${inferred.variant ? ` ${inferred.variant}` : ''}`.trim();
        context.vehicleVariant = inferred.variant || undefined;
        context.vehicleClass = inferred.vehicleClass || undefined;
      }
    }

    // If auto-selected, skip returning suggestions and go to phone step.
    if (context.modelId) {
      // continue
    } else {
    const fallback = planAsk || 'Aapki car model kaunsa hai? (Example: Tata Tigor / Maruti Swift / Hyundai i20)';
    
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_CAR_MODEL',
      deterministicFacts: { 
        ask: 'car_model',
        suggestions: carSuggestions.map((c, i) => ({
          index: i + 1,
          make: c.make,
          model: c.model,
          variant: c.variant || null,
        })),
        hint: 'Type your car name for autocomplete suggestions',
      },
      fallback,
    });
    
    const contextPatch: Partial<ChatbotContext> = { 
      ...baseContextPatch(context, conversationId),
      conversationId, 
      conversationStage: 'NEED_CAR_MODEL', 
      // Keep suggestions in context for internal parsing (UI is pure chat)
      carModelSuggestions: carSuggestions.length > 0 ? carSuggestions : undefined,
    };
    
    console.log('[CHATBOT] Returning car model suggestions:', contextPatch);
    
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch,
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, carSuggestions } });
    return NextResponse.json(resp);
    }
  }
  }

  // Phone number is NOT required for general chat (price/nearest workshop).
  // We will ask for phone only when we are about to create a booking.

  // If we captured phone in this message and user only sent the number, move to issue step
  if (capturedPhoneThisTurn) {
    const remainder = (body.message || '').replace(/[0-9\s()+-]/g, ' ').replace(/\s+/g, ' ').trim();
    const hasMeaningfulText = remainder.length >= 3 && /[a-zA-Z\u0900-\u097F\u0A80-\u0AFF]/.test(remainder);

    // If message included both phone + some text, treat text as issue description.
    if (!context.problemDescription && hasMeaningfulText) {
      context.problemDescription = remainder;
    }

    if (!context.problemDescription && !hasMeaningfulText) {
      // If user is in non-doc "catalog" flow OR in an active booking flow (service already selected),
      // do NOT force the "issue" question here — let the next stage continue.
      const hasSelectedService =
        (Array.isArray(context.selectedServiceTypeIds) && context.selectedServiceTypeIds.length > 0) || Boolean(context.selectedPackageId);
      if (context.docMode === false && (context.serviceCategory || (context.paymentMethod && hasSelectedService))) {
        // fall through
      } else {
      const fallback = planAsk || 'Thanks! Ab aapki car me kya issue hai? (Example: AC cooling kam, brake noise, denting/painting, general service)';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'NEED_ISSUE',
        deterministicFacts: {
          ask: 'car_issue',
          examples: ['AC cooling kam', 'Brake noise', 'Denting/Painting', 'General service', 'Battery issue', 'Tyre puncture'],
        },
        fallback,
      });
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_ISSUE' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, capturedPhone: true } });
      return NextResponse.json(resp);
      }
    }
  }

  // Requirement text is optional; if user already described issue/service, keep it
  if (!context.problemDescription) {
    const t = normalize(body.message);
    if (/(service|servicing|repair|issue|problem|ac|brake|battery|puncture|noise|vibration|rsa|roadside|stuck|start\s*nahi|start\s*nhi|nahi\s*start|nhi\s*start|band|gaadi\s*band|gadi\s*band|car\s*band)/i.test(t)) {
      context.problemDescription = body.message;
    }
  }
  // If user switches topic with a strong keyword (e.g. denting/ac/brake), update the problemDescription.
  if (/(denting|painting|dent|scratch|body|bumper|panel|ac|brake|battery|puncture|alignment|balancing|suspension|steering|clutch|gear)/i.test(body.message)) {
    context.problemDescription = body.message;
  }

  // =========================================================
  // BOOK-SERVICE LIKE CATALOG (non-doc booking mode)
  // - If user wants "all options", show category menu.
  // - After category selected, show services in that category with exact DB prices.
  // =========================================================
  const isNonDocBookingMode = context.docMode === false;
  if (isNonDocBookingMode) {
    const raw = String(body.message || '').trim();
    const norm = normalize(raw);

    // Structured selection from UI (carousels): "__select__ KIND UUID"
    const sel = raw.match(/^__select__\s+(SERVICE_TYPE|PACKAGE|RSA)\s+([0-9a-f-]{36})\s*$/i);
    if (sel) {
      const kind = sel[1].toUpperCase();
      const id = sel[2];
      if (kind === 'PACKAGE') {
        context.selectedPackageId = id;
        context.selectedServiceTypeIds = [];
      } else {
        context.selectedServiceTypeIds = [id];
        context.selectedPackageId = undefined;
      }
      (context as any).catalogStage = null;
      (context as any).catalogServiceOptionIds = [];
      (context as any).catalogOptionChoices = [];
      const checklist = kind === 'SERVICE_TYPE' ? await fetchServiceTypeChecklist(supabase, id) : null;
      const info = checklist ? formatChecklistBlock(checklist) : null;
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'NEED_PICKUP_PREF',
        deterministicFacts: {
          ask: 'pickup_preference',
          options: [
            { value: true, label: 'Pickup Required' },
            { value: false, label: 'Self Visit' },
          ],
        },
        fallback: 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.',
      });
      const finalMsg = [info, assistantMessage].filter(Boolean).join('\n\n');
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage: finalMsg,
        contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_PICKUP_PREF' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: finalMsg, meta: { intent, step: 'select_structured' } });
      return NextResponse.json(resp);
    }

    // If user selects an option number, prefer selecting from the last shown options (stable UX).
    const optIdx = pickChoiceIndex(raw);
    if (optIdx !== null && Array.isArray((context as any).lastOptionChoices) && (context as any).lastOptionChoices.length > 0) {
      const choices = (context as any).lastOptionChoices as Array<{ kind: string; id: string; name: string }>;
      const picked = choices[optIdx];
      if (picked?.id && picked?.kind) {
        // Apply selection deterministically
        if (picked.kind === 'PACKAGE') {
          context.selectedPackageId = picked.id;
          // service_type ids will be expanded later by triggerBooking using package mapping if needed
          context.selectedServiceTypeIds = [];
        } else {
          context.selectedServiceTypeIds = [picked.id];
          context.selectedPackageId = undefined;
        }
        (context as any).lastOptionChoices = [];

        // IMPORTANT: Return immediately so this "Option N" message is not mis-parsed as a car model.
        const checklist =
          picked.kind === 'SERVICE_TYPE' ? await fetchServiceTypeChecklist(supabase, picked.id) : null;
        const info = checklist ? formatChecklistBlock(checklist) : null;
        const assistantMessage = await composeReply({
          userMessage: body.message,
          context,
          stage: 'NEED_PICKUP_PREF',
          deterministicFacts: {
            ask: 'pickup_preference',
            options: [
              { value: true, label: 'Pickup Required' },
              { value: false, label: 'Self Visit' },
            ],
          },
          fallback: 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.',
        });
        const finalMsg = [info, assistantMessage].filter(Boolean).join('\n\n');
        const resp: ChatbotResponse = {
          conversationId,
          intent,
          assistantMessage: finalMsg,
          contextPatch: {
            ...baseContextPatch(context, conversationId),
            conversationStage: 'NEED_PICKUP_PREF',
            selectedServiceTypeIds: context.selectedServiceTypeIds,
            selectedPackageId: context.selectedPackageId,
          },
        };
        await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: finalMsg, meta: { intent, step: 'select_option_from_last' } });
        return NextResponse.json(resp);
      }
    }

    // If we previously listed services, treat option number as service selection (not category selection).
    const serviceChoiceIdx = pickChoiceIndex(raw);
    if (
      (context as any).catalogStage === 'SERVICE_LIST' &&
      Array.isArray((context as any).catalogOptionChoices) &&
      (context as any).catalogOptionChoices.length > 0 &&
      serviceChoiceIdx !== null &&
      !looksLikeDetailsQuery(raw)
    ) {
      const choices = (context as any).catalogOptionChoices as Array<{ kind: string; id: string; name: string }>;
      const picked = choices[serviceChoiceIdx];
      if (picked?.id && picked?.kind) {
        if (picked.kind === 'PACKAGE') {
          context.selectedPackageId = picked.id;
          context.selectedServiceTypeIds = [];
        } else {
          context.selectedServiceTypeIds = [picked.id];
          context.selectedPackageId = undefined;
        }
        (context as any).catalogServiceOptionIds = [];
        (context as any).catalogOptionChoices = [];
        (context as any).catalogStage = null;
        const checklist = picked.kind === 'SERVICE_TYPE' ? await fetchServiceTypeChecklist(supabase, picked.id) : null;
        const info = checklist ? formatChecklistBlock(checklist) : null;
        const assistantMessage = await composeReply({
          userMessage: body.message,
          context,
          stage: 'NEED_PICKUP_PREF',
          deterministicFacts: {
            ask: 'pickup_preference',
            options: [
              { value: true, label: 'Pickup Required' },
              { value: false, label: 'Self Visit' },
            ],
          },
          fallback: 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.',
        });
        const finalMsg = [info, assistantMessage].filter(Boolean).join('\n\n');
        const resp: ChatbotResponse = {
          conversationId,
          intent,
          assistantMessage: finalMsg,
          contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_PICKUP_PREF' },
        };
        await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: finalMsg, meta: { intent, step: 'catalog_choice_selected' } });
        return NextResponse.json(resp);
      }
    }

    if (
      (context as any).catalogStage === 'SERVICE_LIST' &&
      Array.isArray((context as any).catalogServiceOptionIds) &&
      (context as any).catalogServiceOptionIds.length > 0 &&
      serviceChoiceIdx !== null &&
      !looksLikeDetailsQuery(raw)
    ) {
      const ids = (context as any).catalogServiceOptionIds as string[];
      const pickedId = ids[serviceChoiceIdx];
      if (pickedId) {
        context.selectedServiceTypeIds = [pickedId];
        (context as any).catalogServiceOptionIds = [];
        (context as any).catalogStage = null;
        // Return immediately to avoid car-model inference on "Option N"
        const checklist = await fetchServiceTypeChecklist(supabase, pickedId);
        const info = checklist ? formatChecklistBlock(checklist) : null;
        const assistantMessage = await composeReply({
          userMessage: body.message,
          context,
          stage: 'NEED_PICKUP_PREF',
          deterministicFacts: {
            ask: 'pickup_preference',
            options: [
              { value: true, label: 'Pickup Required' },
              { value: false, label: 'Self Visit' },
            ],
          },
          fallback: 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.',
        });
        const finalMsg = [info, assistantMessage].filter(Boolean).join('\n\n');
        const resp: ChatbotResponse = {
          conversationId,
          intent,
          assistantMessage: finalMsg,
          contextPatch: {
            ...baseContextPatch(context, conversationId),
            conversationStage: 'NEED_PICKUP_PREF',
            selectedServiceTypeIds: context.selectedServiceTypeIds,
          },
        };
        await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: finalMsg, meta: { intent, step: 'catalog_service_selected' } });
        return NextResponse.json(resp);
      }
    }

    // If user asks for more options, show category menu (no price, no phone needed).
    const wantsCatalogMenu = /(all options|more options|koi aur option|koi aur service|aur option|aur service|options|service options|show services|services list|service list|menu|categories)/i.test(raw);
    if (wantsCatalogMenu) {
      const menu = renderCategoryMenu();
      const assistantMessage = menu.text;
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        ui: {
          kind: 'CATEGORY_CAROUSEL',
          title: 'Choose a category',
          items: menu.cats.map((c) => ({ id: c, label: categoryLabel(c) })),
        },
        contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: undefined, catalogServiceOptionIds: [], catalogStage: 'CATEGORY_MENU' },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_menu' } });
      return NextResponse.json(resp);
    }

    // If user selected a category by name OR option number, set serviceCategory.
    const menu = renderCategoryMenu();
    const idx = (context as any).catalogStage === 'CATEGORY_MENU' ? pickChoiceIndex(raw) : null;
    const byNumber = idx !== null && idx >= 0 && idx < menu.cats.length ? menu.cats[idx] : null;
    const byText = menu.cats.find((c) => normalizeCategoryText(c) === normalizeCategoryText(raw)) || null;
    const byFuzzy = resolveCategoryFromFreeText(raw, menu.cats);
    const chosenCategory = byNumber || byText || byFuzzy;
    if (chosenCategory) {
      context.serviceCategory = chosenCategory;
      (context as any).catalogStage = 'AWAITING_PHONE';
    } else if ((context as any).catalogStage === 'CATEGORY_MENU') {
      const assistantMessage = [menu.text, '', 'Kaunsi category chahiye? Option number ya category name bhejiye.'].join('\n');
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { ...baseContextPatch(context, conversationId), catalogStage: 'CATEGORY_MENU', catalogServiceOptionIds: [] },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_category_reask' } });
      return NextResponse.json(resp);
    }

    // If category is set and no service selection yet, show all services in that category (+ exact prices).
    if (context.serviceCategory && (!context.selectedServiceTypeIds || context.selectedServiceTypeIds.length === 0)) {
      const phoneNote = !context.customerPhone
        ? 'Note: Exact prices dikhane se pehle 10-digit mobile number chahiye (for confirmation/callback).'
        : null;

      // FAQ intercept inside catalog: answer plan/checklist questions without re-spamming the whole list.
      const q = String(body.message || '').trim();
      const qNorm = normalize(q);
      const looksLikePointsQuestion =
        /(kya hai|meaning|matlab|explain|what is|what's|points?|checkpoint|check\s*list|checklist)/i.test(q);
      if (looksLikePointsQuestion) {
        const choices = Array.isArray((context as any).catalogOptionChoices)
          ? ((context as any).catalogOptionChoices as Array<{ kind: string; id: string; name: string }>)
          : [];

        const pickByQuery = () => {
          const t = qNorm;
          const hasGeneral = /\bgeneral\b|\b30\b/.test(t);
          const hasBasic = /\bbasic\b|\b15\b/.test(t);
          const hasPremium = /\bpremium\b|\b50\b/.test(t);
          const hasPlatinum = /\bplatinum\b|\b60\b/.test(t);

          const want =
            (hasGeneral && ['general', '30']) ||
            (hasBasic && ['basic', '15']) ||
            (hasPremium && ['premium', '50']) ||
            (hasPlatinum && ['platinum', '60']) ||
            null;

          if (!want) return null;
          const hit = choices.find((c) => {
            const n = normalize(String(c?.name || ''));
            return want.some((w) => n.includes(w));
          });
          return hit || null;
        };

        const picked = pickByQuery();

        const expl =
          '“Points / checkpoints” ka matlab hota hai ki service me kitne inspection + maintenance steps cover hote hain (example: oil/filter checks, fluids top-up, brakes/tyres inspection, wash/vacuum etc.).\n\nJitne zyada points, utna zyada comprehensive check-up.';

        if (picked && picked.kind === 'SERVICE_TYPE') {
          const checklist = await fetchServiceTypeChecklist(supabase, picked.id);
          const details = checklist && checklist.items.length > 0 ? formatChecklistBlock(checklist) : null;
          const assistantMessage = [
            `${picked.name} me “${checklist?.points || (picked.name.match(/\b(\d{2})\s*Points\b/i)?.[1] || '')}” points ka matlab wahi total checkpoints hai jo hum perform karte hain.`,
            details || expl,
            'Aap chaho to carousel me us plan pe tap karke “Choose this” kar dijiye.',
          ]
            .filter(Boolean)
            .join('\n\n');

          const resp: ChatbotResponse = {
            conversationId,
            intent,
            assistantMessage,
            contextPatch: {
              ...baseContextPatch(context, conversationId),
              serviceCategory: context.serviceCategory,
              catalogStage: 'SERVICE_LIST',
              catalogOptionChoices: choices,
            } as any,
          };
          await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_plan_explain', picked: picked.id } });
          return NextResponse.json(resp);
        }

        // Generic explanation if user didn't reference a specific plan.
        const assistantMessage = [
          expl,
          'Aap kis plan ke points pooch rahe ho? (Basic 15 / General 30 / Premium 50 / Platinum 60) — ya carousel me jis plan ka naam hai woh type kar do.',
        ].join('\n\n');

        const resp: ChatbotResponse = {
          conversationId,
          intent,
          assistantMessage,
          contextPatch: {
            ...baseContextPatch(context, conversationId),
            serviceCategory: context.serviceCategory,
            catalogStage: 'SERVICE_LIST',
            catalogOptionChoices: choices,
          } as any,
        };
        await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_points_generic' } });
        return NextResponse.json(resp);
      }

      // Generic "details" intercept: for any service/package in the current catalog list.
      if (looksLikeDetailsQuery(q)) {
        const choices = Array.isArray((context as any).catalogOptionChoices)
          ? ((context as any).catalogOptionChoices as Array<{ kind: string; id: string; name: string }>)
          : [];
        const idx = pickChoiceIndex(q);

        const stop = new Set(['option', 'details', 'detail', 'include', 'included', 'inclusion', 'checklist', 'checkpoint', 'points', 'kya', 'hai', 'me', 'mein', 'ka', 'ki', 'ke', 'matlab', 'meaning', 'explain', 'what', 'is', "what's"]);
        const tokens = qNorm
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .map((x) => x.trim())
          .filter((x) => x && x.length >= 3 && !stop.has(x));

        const byIdx = idx !== null && idx >= 0 && idx < choices.length ? choices[idx] : null;
        const byName =
          choices.find((c) => {
            const n = normalize(String(c?.name || ''));
            return tokens.some((t) => n.includes(t));
          }) || null;
        const picked = byIdx || byName;

        if (!picked) {
          // Fallback: try DB search by query tokens (when user asks about a service not in current carousel list).
          const queryText = tokens.slice(0, 3).join(' ');
          if (queryText) {
            const stMatches = await searchServiceTypesByName(supabase, queryText);
            const pkgMatches = await searchPackagesByName(supabase, queryText);

            // If exactly one strong match, show details directly.
            if (stMatches.length === 1) {
              const st = stMatches[0];
              const checklist = await fetchServiceTypeChecklist(supabase, st.id);
              const details = checklist && checklist.items.length > 0 ? formatChecklistBlock({ ...checklist, items: clipList(checklist.items, 18) }) : null;
              const assistantMessage = [
                `Details: ${st.name}`,
                details || (st.description ? st.description : 'Is service ke exact checkpoints abhi available nahi hain.'),
                'Aap chaho to “options” bolkar category choose karke booking continue kar sakte ho.',
              ]
                .filter(Boolean)
                .join('\n\n');
              const resp: ChatbotResponse = {
                conversationId,
                intent,
                assistantMessage,
                contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
              };
              await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_search_service_type', picked: st.id } });
              return NextResponse.json(resp);
            }
            if (pkgMatches.length === 1) {
              const pkg = pkgMatches[0];
              const itemNames = await fetchPackageItemNames(supabase, [pkg.id]);
              const items = itemNames.get(pkg.id) || [];
              const assistantMessage = [
                `Details: ${pkg.name}`,
                items.length > 0 ? ['Includes:', ...clipList(items, 18).map((x) => `- ${x}`)].join('\n') : (pkg.description || 'Is package ke included items abhi available nahi hain.'),
                'Aap chaho to “options” bolkar category choose karke booking continue kar sakte ho.',
              ]
                .filter(Boolean)
                .join('\n\n');
              const resp: ChatbotResponse = {
                conversationId,
                intent,
                assistantMessage,
                contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
              };
              await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_search_package', picked: pkg.id } });
              return NextResponse.json(resp);
            }

            // Otherwise show suggestions for clarification.
            const lines: string[] = [];
            lines.push('Aap kis service ka details chahte ho? Ye matches mile:');
            stMatches.slice(0, 5).forEach((s, i) => lines.push(`• Service ${i + 1}: ${s.name}`));
            pkgMatches.slice(0, 5).forEach((p, i) => lines.push(`• Package ${i + 1}: ${p.name}`));
            lines.push('Reply with exact name ya option number (agar list open hai).');
            const assistantMessage = lines.join('\n');
            const resp: ChatbotResponse = {
              conversationId,
              intent,
              assistantMessage,
              contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
            };
            await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_search_multi' } });
            return NextResponse.json(resp);
          }

          const assistantMessage = [
            'Aap kis service/plan ka detail pooch rahe ho?',
            'Reply with option number (e.g. “Option 2 details”) ya service ka naam likh dijiye.',
          ].join('\n');
          const resp: ChatbotResponse = {
            conversationId,
            intent,
            assistantMessage,
            contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
          };
          await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_ask_which' } });
          return NextResponse.json(resp);
        }

        if (picked.kind === 'SERVICE_TYPE') {
          const checklist = await fetchServiceTypeChecklist(supabase, picked.id);
          const details = checklist && checklist.items.length > 0 ? formatChecklistBlock({ ...checklist, items: clipList(checklist.items, 18) }) : null;
          const assistantMessage = [
            `Details: ${picked.name}`,
            details || 'Is service ke exact checkpoints abhi available nahi hain. Aap chaho to booking create karke service expert se confirm kar sakte ho.',
            'Aap chaho to carousel me us option pe tap karke “Choose this” kar dijiye.',
          ]
            .filter(Boolean)
            .join('\n\n');
          const resp: ChatbotResponse = {
            conversationId,
            intent,
            assistantMessage,
            contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
          };
          await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_service_type', picked: picked.id } });
          return NextResponse.json(resp);
        }

        if (picked.kind === 'PACKAGE') {
          const itemNames = await fetchPackageItemNames(supabase, [picked.id]);
          const items = itemNames.get(picked.id) || [];
          const assistantMessage = [
            `Details: ${picked.name}`,
            items.length > 0 ? ['Includes:', ...clipList(items, 18).map((x) => `- ${x}`)].join('\n') : 'Is package ke included items abhi available nahi hain.',
            'Aap chaho to carousel me us option pe tap karke “Choose this” kar dijiye.',
          ]
            .filter(Boolean)
            .join('\n\n');
          const resp: ChatbotResponse = {
            conversationId,
            intent,
            assistantMessage,
            contextPatch: { ...baseContextPatch(context, conversationId), serviceCategory: context.serviceCategory, catalogStage: 'SERVICE_LIST', catalogOptionChoices: choices } as any,
          };
          await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_details_package', picked: picked.id } });
          return NextResponse.json(resp);
        }
      }

      const needsModel = !context.modelId && !context.vehicleModel;
      const needsLocation = !context.cityId && !context.addressText;

      // Best-effort infer city/zone from addressText
      if (!context.cityId && context.addressText) {
        const inferredCity = await inferCityZoneFromAddress(supabase, context.addressText);
        if (inferredCity) {
          context.cityId = inferredCity.cityId;
          context.cityName = inferredCity.cityName;
          context.zoneId = inferredCity.zoneId;
        }
      }

      const services = await fetchCategoryServiceTypes(supabase, context.serviceCategory);
      const allPkgs = await fetchAllPackages(supabase);
      const allPkgItemNames = await fetchPackageItemNames(supabase, allPkgs.map((p) => p.id));
      const cat = String(context.serviceCategory || '');
      const pkgs = allPkgs.filter((p) => {
        const itemNames = allPkgItemNames.get(p.id) || [];
        const cats = itemNames.map((n) => getServiceCategory(n));
        // Prefer matching by included items; fall back to package name.
        return cats.includes(cat) || getServiceCategory(p.name) === cat;
      });
      const pkgSuggestions = pkgs.map((p) => ({ kind: 'PACKAGE' as const, id: p.id, name: p.name, why: '' }));
      const serviceSuggestions = services.map((s) => ({ kind: 'SERVICE_TYPE' as const, id: s.id, name: s.name, why: '' }));

      const pricingCtx = { ...context };
      const allSuggestions = [...pkgSuggestions, ...serviceSuggestions];
      const exactPrices = context.customerPhone ? await resolveExactPrices(supabase, { ctx: pricingCtx, suggestions: allSuggestions }) : {};
      const checklistMap = new Map<string, { title?: string; points?: number; items: string[] }>();
      // Best-effort fetch checklist templates (for UI "view checkpoints")
      try {
        const ids = serviceSuggestions.map((s) => s.id);
        const chunkSize = 60;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data } = await supabase
            .from('service_type_checklist_templates')
            .select('service_type_id, title, points, checklist_items')
            .in('service_type_id', chunk);
          (data as any[] | null)?.forEach((r: any) => {
            const sid = r?.service_type_id;
            const rawItems = Array.isArray(r?.checklist_items) ? r.checklist_items : [];
            const items: string[] = rawItems
              .map((it: any) => (typeof it === 'string' ? it : String(it?.name || it?.label || it?.title || '').trim()))
              .filter(Boolean);
            if (sid) checklistMap.set(String(sid), { title: r?.title || undefined, points: typeof r?.points === 'number' ? r.points : undefined, items });
          });
        }
      } catch {
        // ignore
      }

      const pkgItemNames = allPkgItemNames;
      const pkgOpts: SuggestedOption[] = pkgSuggestions.map((s) => ({
        suggestion: s,
        exactPrice: context.customerPhone ? exactPrices[`${s.kind}:${s.id}`] : undefined,
        checklistItems: pkgItemNames.get(s.id) || undefined,
        checklistNote: pkgs.find((p) => p.id === s.id)?.description || undefined,
        category: context.serviceCategory,
      }));

      const serviceOpts: SuggestedOption[] = serviceSuggestions.map((s) => ({
        suggestion: s,
        exactPrice: context.customerPhone ? exactPrices[`${s.kind}:${s.id}`] : undefined,
        checklistItems: checklistMap.get(s.id)?.items || undefined,
        checklistNote: checklistMap.get(s.id)?.title || undefined,
        category: context.serviceCategory,
      }));

      const looksLikePlan = (name: string) => /(points?\)|\b(platinum|premium|basic|standard)\b)/i.test(name);
      const fallbackPlans = pkgOpts.length === 0 ? serviceOpts.filter((o) => looksLikePlan(o.suggestion.name)) : [];
      const fallbackServices = pkgOpts.length === 0 ? serviceOpts.filter((o) => !looksLikePlan(o.suggestion.name)) : [];

      const uiPackages = pkgOpts.length > 0 ? pkgOpts : fallbackPlans;
      const uiServices = pkgOpts.length > 0 ? serviceOpts : fallbackServices;

      const combinedChoices = [...uiPackages, ...uiServices].map((o) => ({
        kind: o.suggestion.kind,
        id: o.suggestion.id,
        name: o.suggestion.name,
      }));

      const lines: string[] = [];
      lines.push(`Category: ${context.serviceCategory}`);
      lines.push('');
      if (phoneNote) lines.push(phoneNote);
      if (needsModel) lines.push('Note: Exact service price ke liye car model bhi chahiye (Example: Tata Tiago / Hyundai i20).');
      if (needsLocation) lines.push('Note: Pricing city/location ke hisaab se change hoti hai — aap apna area/city bhi share kar dijiye.');
      if (phoneNote) lines.push('');
      if (needsModel || needsLocation) lines.push('');
      if (uiPackages.length > 0) {
        lines.push(pkgOpts.length > 0 ? 'Packages (reply with option number):' : 'Plans (reply with option number):');
        lines.push(renderOptionsWithOffset(uiPackages, 0));
        lines.push('');
      }
      if (uiServices.length > 0) {
        lines.push('Services (reply with option number):');
        lines.push(renderOptionsWithOffset(uiServices, uiPackages.length));
        lines.push('');
      }
      lines.push('After selection, I will ask pickup vs self-visit.');
      const assistantMessage = lines.join('\n');
      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        suggestions: [...uiPackages, ...uiServices],
        ui: {
          kind: 'DUAL_CAROUSEL',
          title: 'Choose an option',
          category: context.serviceCategory,
          packages: uiPackages,
          services: uiServices,
        },
        contextPatch: {
          ...baseContextPatch(context, conversationId),
          conversationStage: needsModel ? 'NEED_CAR_MODEL' : !context.customerPhone ? 'NEED_PHONE' : 'WAITING_SERVICE_SELECTION',
          serviceCategory: context.serviceCategory,
          catalogServiceOptionIds: serviceSuggestions.map((s) => s.id),
          catalogOptionChoices: combinedChoices,
          catalogStage: 'SERVICE_LIST',
          // keep model/city/phone for next step
          modelId: context.modelId,
          vehicleModel: context.vehicleModel,
          vehicleMake: context.vehicleMake,
          vehicleClass: context.vehicleClass,
          cityId: context.cityId,
          cityName: context.cityName,
          zoneId: context.zoneId,
          customerPhone: context.customerPhone,
          carModelSuggestions: undefined,
        },
      };
      await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'catalog_services', category: context.serviceCategory } });
      return NextResponse.json(resp);
    }
  }

  // STEP 5: PICKUP PREFERENCE (after service plan is selected)
  if (context.selectedServiceTypeIds?.length && typeof context.pickupRequired !== 'boolean') {
    const fallback = planAsk || 'Pickup chahiye ya aap workshop pe khud aayenge?\n\n1. Pickup Required\n2. Self Visit\n\nOption select karein.';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PICKUP_PREF',
      deterministicFacts: {
        ask: 'pickup_preference',
        options: [
          { value: true, label: 'Pickup Required' },
          { value: false, label: 'Self Visit' },
        ],
      },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        ...baseContextPatch(context, conversationId),
        conversationStage: 'NEED_PICKUP_PREF',
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'pickup_pref' } });
    return NextResponse.json(resp);
  }

  // STEP 6: PAYMENT METHOD (after pickup preference)
  if (context.selectedServiceTypeIds?.length && typeof context.pickupRequired === 'boolean' && !context.paymentMethod) {
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PAYMENT',
      deterministicFacts: {
        ask: 'payment_method',
        options: [
          { value: 'UPI', label: 'UPI/Online Payment' },
          { value: 'CARD', label: 'Credit/Debit Card' },
          { value: 'CASH', label: 'Cash on Service' },
          { value: 'PAY_LATER', label: 'Pay Later at Workshop' },
        ],
      },
      fallback: planAsk || 'Payment method kaunsa prefer karenge?\n\n1. UPI/Online\n2. Credit/Debit Card\n3. Cash on Service\n4. Pay Later at Workshop\n\nOption number select karein.',
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        ...baseContextPatch(context, conversationId),
        conversationStage: 'NEED_PAYMENT',
        selectedServiceTypeIds: context.selectedServiceTypeIds,
        selectedPackageId: context.selectedPackageId,
        pickupRequired: context.pickupRequired,
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'payment' } });
    return NextResponse.json(resp);
  }

  // Resolve services deterministically (no LLM)
  // Important: include the latest user text so requests like “aur kuch service” / “aur koi plan” work.
  const resolverMessage = [context.problemDescription, body.message].filter(Boolean).join(' | ');
  // If intent detector returns UNKNOWN, infer a safer intent for service selection.
  const resolverIntent = (() => {
    const base = intent.intent;
    if (base && base !== 'UNKNOWN') return base;
    const t = normalize(resolverMessage);
    if (/(rsa|roadside|towing|tow|breakdown|stuck|stranded)/i.test(t)) return 'RSA';
    if (/(price|cost|charges|rate|pricing|quote|estimate|kitna|kitne)/i.test(t)) return 'PRICE_ENQUIRY';
    if (/(service|servicing|repair|issue|problem|ac|brake|battery|puncture|noise|vibration|band|start\s*nahi|start\s*nhi|nahi\s*start|nhi\s*start|jump\s*start|jumpstart)/i.test(t)) {
      return 'SERVICE_BOOKING';
    }
    return 'UNKNOWN';
  })();

  const serviceResult = await resolveServices(supabase, { message: resolverMessage, intent: resolverIntent as any, context });
  const suggestions = serviceResult.suggestions;

  // Resolve price ranges (read-only)
  // Improve pricing context using real DB: car model class + city zone + nearest workshop pricing (if coords available).
  const inferredCar = !context.modelId && context.vehicleModel ? await inferCarModelFromText(supabase, context.vehicleModel) : null;
  if (inferredCar) {
    context.modelId = context.modelId || inferredCar.modelId;
    context.vehicleMake = context.vehicleMake || inferredCar.make;
    context.vehicleModel = context.vehicleModel || inferredCar.model;
    context.vehicleVariant = context.vehicleVariant || inferredCar.variant || null;
    context.vehicleClass = context.vehicleClass || inferredCar.vehicleClass || null;
  }

  const inferredCity = !context.cityId && context.addressText ? await inferCityZoneFromAddress(supabase, context.addressText) : null;
  if (inferredCity) {
    context.cityId = context.cityId || inferredCity.cityId;
    context.cityName = context.cityName || inferredCity.cityName;
    context.zoneId = context.zoneId || inferredCity.zoneId;
  }

  // Pick a pricing workshop: chosen workshop OR nearest workshop (for localized ranges).
  let pricingWorkshopId: string | null = context.workshopId || null;
  let pricingWorkshopName: string | null = context.workshopName || null;
  const hasCoords = Number.isFinite(context.locationLat as number) && Number.isFinite(context.locationLng as number);
  if (!pricingWorkshopId && hasCoords) {
    const nearest = await getNearestWorkshops(supabase, context.locationLat as number, context.locationLng as number);
    if (nearest[0] && nearest[0].km <= 200) {
      pricingWorkshopId = nearest[0].id;
      pricingWorkshopName = nearest[0].name;
    }
  }

  const pricingCtx = { ...context, workshopId: pricingWorkshopId || undefined };
  const ranges = await resolvePriceRanges(supabase, { ctx: pricingCtx, suggestions }); // kept for logs/debug
  const exactPrices = await resolveExactPrices(supabase, { ctx: pricingCtx, suggestions });
  // As requested: don't show pricing before phone is captured.
  const allowShowPrices = Boolean(context.customerPhone);

  // Best-effort checklist templates for SERVICE_TYPE suggestions (for carousel "checkpoints")
  const checklistByServiceTypeId = new Map<string, { title?: string; points?: number; items: string[] }>();
  try {
    const ids = suggestions.filter((s) => s.kind === 'SERVICE_TYPE').map((s) => s.id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from('service_type_checklist_templates')
        .select('service_type_id, title, points, checklist_items')
        .in('service_type_id', ids.slice(0, 50));
      (data as any[] | null)?.forEach((r: any) => {
        const sid = r?.service_type_id;
        const rawItems = Array.isArray(r?.checklist_items) ? r.checklist_items : [];
        const items: string[] = rawItems
          .map((it: any) => (typeof it === 'string' ? it : String(it?.name || it?.label || it?.title || '').trim()))
          .filter(Boolean);
        if (sid) checklistByServiceTypeId.set(String(sid), { title: r?.title || undefined, points: typeof r?.points === 'number' ? r.points : undefined, items });
      });
    }
  } catch {
    // ignore
  }

  const options: SuggestedOption[] = suggestions.map((s) => {
    const opt: SuggestedOption = {
      suggestion: s,
      priceRange: allowShowPrices ? ranges[`${s.kind}:${s.id}`] : undefined,
      exactPrice: allowShowPrices ? exactPrices[`${s.kind}:${s.id}`] : undefined,
    };

    // Add checklist details for "See Details" button
    if (s.kind === 'PACKAGE') {
      opt.checklistItems = serviceResult.packageToItemNames[s.id] || [];
      opt.category = 'Package';
    } else if (s.kind === 'SERVICE_TYPE') {
      const details = serviceResult.serviceTypeDetails[s.id];
      if (details?.description) {
        opt.checklistNote = details.description;
      }
      const tpl = checklistByServiceTypeId.get(s.id);
      if (tpl?.items?.length) {
        opt.checklistItems = tpl.items;
        opt.checklistNote = opt.checklistNote || tpl.title || undefined;
      }
      // Try to get category from service type name
      opt.category = getServiceCategory(s.name);
    }

    return opt;
  });

  // Determine chosen option
  const choiceIdx = pickChoiceIndex(body.message);
  let chosen: ServiceSuggestion | null = null;
  if (choiceIdx !== null && options[choiceIdx]) {
    chosen = options[choiceIdx].suggestion;
  } else if (context.docMode === false && context.serviceCategory && choiceIdx !== null && options[choiceIdx]) {
    chosen = options[choiceIdx].suggestion;
  } else if (context.selectedServiceTypeIds?.length && intent.intent !== 'RSA') {
    // If UI already pinned selected services, respect it.
    chosen = { kind: 'SERVICE_TYPE', id: context.selectedServiceTypeIds[0], name: 'Selected Service', why: '' };
  } else {
    chosen = options[0]?.suggestion || null;
  }

  const wantsBooking = looksLikeConfirm(body.message);
  const needs: string[] = [];

  // PHONE-GATE: show exact prices only after we have a 10-digit number (as requested).
  const hasAnyExactPrice = options.some((o) => typeof o.exactPrice?.amount === 'number' && o.exactPrice.amount > 0);
  // Phone gate should apply to PRICING (not service-info questions like "what's included").
  const looksLikePricingQuery = /(price|cost|charges|rate|kitna|kitne|pricing|quote|estimate)/i.test(body.message);
  // Ask phone before we display exact pricing (as requested).
  if (!context.customerPhone && (intent.intent === 'PRICE_ENQUIRY' || isPricingQuery(body.message) || looksLikePricingQuery) && hasAnyExactPrice) {
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PHONE',
      deterministicFacts: {
        ask: 'phone_number',
        note: 'Phone required before sharing exact prices',
      },
      fallback: 'Exact pricing dikhane se pehle aapka 10-digit mobile number chahiye (for callback + confirmation). Please number share kar dijiye.',
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_PHONE' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'phone_before_pricing' } });
    return NextResponse.json(resp);
  }

  if (!chosen) {
    const assistantMessage =
      'Main aapke issue ko map nahi kar paaya. Aap 1-2 lines me symptoms (noise/smell/leak/warning light) aur location share kar dijiye.';
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { conversationId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // STEP 6: PAYMENT METHOD (before final booking)
  if (wantsBooking && !context.paymentMethod) {
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PAYMENT',
      deterministicFacts: {
        ask: 'payment_method',
        options: [
          { value: 'UPI', label: 'UPI/Online Payment' },
          { value: 'CARD', label: 'Credit/Debit Card' },
          { value: 'CASH', label: 'Cash on Service' },
          { value: 'PAY_LATER', label: 'Pay Later at Workshop' },
        ],
        note: 'Please select your preferred payment method',
      },
      fallback: planAsk || 'Payment method kaunsa prefer karenge?\n\n1. UPI/Online\n2. Credit/Debit Card\n3. Cash on Service\n4. Pay Later at Workshop\n\nOption number select karein.',
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_PAYMENT', workshopId: context.workshopId },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent } });
    return NextResponse.json(resp);
  }

  // If user picked payment method (after we asked), proceed with booking even if they didn't type "yes".
  const hasSelectedServiceForBooking =
    (Array.isArray(context.selectedServiceTypeIds) && context.selectedServiceTypeIds.length > 0) || Boolean(context.selectedPackageId);
  const proceedBooking =
    wantsBooking ||
    (hasSelectedServiceForBooking &&
      Boolean(context.paymentMethod) &&
      ['NEED_PAYMENT', 'NEED_PHONE', 'NEED_VEHICLE_NUMBER'].includes(String(context.conversationStage || ''))) ||
    (context.conversationStage === 'NEED_VEHICLE_NUMBER' && Boolean(context.paymentMethod) && Boolean(context.vehicleNumber));

  // Ask phone ONLY when we are about to create a booking
  if (proceedBooking && !context.customerPhone) {
    const fallback = planAsk || 'Booking ke liye aapka 10-digit mobile number chahiye. Please mobile number share kar dijiye.';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_PHONE',
      deterministicFacts: { ask: 'phone_number' },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: 'NEED_PHONE' },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'phone_before_booking' } });
    return NextResponse.json(resp);
  }

  // Vehicle number is required by DB in many environments; collect before inserting lead.
  if (proceedBooking && !context.vehicleNumber) {
    const fallback = planAsk || 'Booking complete karne ke liye vehicle number chahiye. Example: MH12AB1234';
    const assistantMessage = await composeReply({
      userMessage: body.message,
      context,
      stage: 'NEED_VEHICLE_NUMBER',
      deterministicFacts: { ask: 'vehicle_number', example: 'MH12AB1234' },
      fallback,
    });
    const resp: ChatbotResponse = {
      conversationId,
      intent,
      assistantMessage,
      contextPatch: {
        ...baseContextPatch(context, conversationId),
        conversationStage: 'NEED_VEHICLE_NUMBER',
      },
    };
    await bestEffortLog(supabase, { conversationId, context, userText: body.message, botText: assistantMessage, meta: { intent, step: 'vehicle_number' } });
    return NextResponse.json(resp);
  }

  if (proceedBooking) {
    try {
      const booking = await triggerBooking(supabase, {
        context: {
          ...context,
          conversationId,
          // Don't overwrite problemDescription with phone/vehicle number turns.
          problemDescription: context.problemDescription || undefined,
          // If user picked a package, keep it for logging
          selectedPackageId: chosen.kind === 'PACKAGE' ? chosen.id : context.selectedPackageId,
          // If chosen service type, store it
          selectedServiceTypeIds:
            chosen.kind === 'SERVICE_TYPE' || chosen.kind === 'RSA'
              ? [chosen.id]
              : serviceResult.packageToServiceTypeIds[chosen.id] || context.selectedServiceTypeIds,
        },
        intent,
        chosenSuggestion: chosen,
        packageServiceTypeIds: chosen.kind === 'PACKAGE' ? serviceResult.packageToServiceTypeIds[chosen.id] : undefined,
      });

      const tokenAmt = await resolveBookingTokenAmount().catch(() => 99);
      const assistantMessage = [
        'Done — aapki booking create ho gayi.',
        `Aapka Lead Number: ${booking.leadNumber}`,
        '',
        `Aap chahe to abhi booking token ₹${tokenAmt.toLocaleString('en-IN')} pay karke slot hold kar sakte ho (Pay Booking Token).`,
        `Ya phir “Pay Full Amount” se full payment bhi kar sakte ho.`,
      ].join('\n');

      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        booking,
        contextPatch: {
          ...baseContextPatch(context, conversationId),
          conversationId,
          conversationStage: 'READY_TO_BOOK',
          leadId: booking.leadId,
          paymentType: 'BOOKING_TOKEN',
          showPayNow: true,
          bookingTokenAmount: tokenAmt,
        },
      };

      await bestEffortLog(supabase, {
        conversationId,
        context,
        userText: body.message,
        botText: assistantMessage,
        meta: { intent, chosen, booking, priceRanges: ranges },
      });

      return NextResponse.json(resp);
    } catch (e: any) {
      const fallback =
        e instanceof BookingValidationError
          ? e.message
          : 'Booking create nahi ho paayi. Please details confirm karke try karein.';
      const assistantMessage = await composeReply({
        userMessage: body.message,
        context,
        stage: 'BOOKING_ERROR',
        deterministicFacts: { error: e?.message || 'unknown' },
        fallback,
      });

      // Try to keep the funnel on the correct step (so bot doesn't restart).
      const msg = String(fallback || '').toLowerCase();
      const nextStage =
        msg.includes('mobile') || msg.includes('phone')
          ? 'NEED_PHONE'
          : msg.includes('vehicle')
            ? 'NEED_VEHICLE_NUMBER'
            : msg.includes('city') || msg.includes('location')
              ? 'NEED_LOCATION'
              : 'NEED_ISSUE';

      const resp: ChatbotResponse = {
        conversationId,
        intent,
        assistantMessage,
        contextPatch: { ...baseContextPatch(context, conversationId), conversationStage: nextStage as any },
      };

      await bestEffortLog(supabase, {
        conversationId,
        context,
        userText: body.message,
        botText: assistantMessage,
        meta: { intent, chosen, error: e?.message },
      });

      return NextResponse.json(resp, { status: 400 });
    }
  }

  // Build normal advisory response
  const selectedOptionName = choiceIdx !== null && options[choiceIdx] ? options[choiceIdx].suggestion.name : undefined;
  const fallback = buildResponseText({
    why: chosen.why || undefined,
    options,
    needs,
    selectedOptionName,
  });
  const hasExact = options.some((o) => typeof o.exactPrice?.amount === 'number' && o.exactPrice.amount > 0);
  // If exact prices are available, keep output deterministic (no LLM drift).
  const assistantMessage = hasExact
    ? fallback
    : await composeReply({
        userMessage: body.message,
        context,
        stage: 'READY_TO_SUGGEST',
        deterministicFacts: {
          why: chosen.why || null,
          options: options.map((o, idx) => ({
            index: idx + 1,
            name: o.suggestion.name,
            kind: o.suggestion.kind,
            exactPrice: typeof o.exactPrice?.amount === 'number' ? o.exactPrice.amount : null,
            priceRange: o.priceRange?.label || null,
            includes:
              o.suggestion.kind === 'PACKAGE'
                ? serviceResult.packageToItemNames?.[o.suggestion.id] || []
                : [],
            checklistNote:
              o.suggestion.kind === 'SERVICE_TYPE'
                ? serviceResult.serviceTypeDetails?.[o.suggestion.id]?.description || null
                : null,
          })),
          selectedOptionName: selectedOptionName || null,
          next: 'ask_for_option_or_confirm',
          notes: {
            pricingWorkshop: pricingWorkshopName || null,
            zoneId: pricingCtx.zoneId || null,
            vehicleClass: pricingCtx.vehicleClass || null,
          },
        },
        fallback,
      });

  const contextPatch: Partial<ChatbotContext> = {
    conversationId,
    conversationStage: 'NEED_ISSUE',
    // store last problem description for booking
    problemDescription:
      context.problemDescription ||
      (capturedPhoneThisTurn || context.conversationStage === 'NEED_VEHICLE_NUMBER' ? undefined : body.message),
    customerPhone: context.customerPhone,
    vehicleNumber: context.vehicleNumber,
    addressText: context.addressText,
    // persist vehicle + location context so we don't re-ask
    modelId: context.modelId,
    vehicleMake: context.vehicleMake,
    vehicleModel: context.vehicleModel,
    vehicleVariant: context.vehicleVariant,
    vehicleClass: context.vehicleClass,
    cityId: context.cityId,
    cityName: context.cityName,
    zoneId: context.zoneId,
    // remember last options for stable "Option N" selection
    lastOptionChoices: options.map((o) => ({
      kind: o.suggestion.kind,
      id: o.suggestion.id,
      name: o.suggestion.name,
    })),
  };

  // If user picked an option number (but not confirming yet), store selection.
  if (choiceIdx !== null && options[choiceIdx]) {
    const s = options[choiceIdx].suggestion;
    if (s.kind === 'PACKAGE') {
      contextPatch.selectedPackageId = s.id;
      contextPatch.selectedServiceTypeIds = serviceResult.packageToServiceTypeIds[s.id] || [];
    } else {
      contextPatch.selectedServiceTypeIds = [s.id];
      contextPatch.selectedPackageId = undefined;
    }
    // Next step after plan selection
    contextPatch.conversationStage = 'NEED_PICKUP_PREF';
  }

  const resp: ChatbotResponse = {
    conversationId,
    intent,
    assistantMessage,
    suggestions: options,
    contextPatch,
  };

  await bestEffortLog(supabase, {
    conversationId,
    context,
    userText: body.message,
    botText: assistantMessage,
    meta: { intent, suggestions, priceRanges: ranges },
  });

  // If we're not confident / unknown, capture the question for human review -> add to KB later.
  if (intent.intent === 'UNKNOWN' && intent.confidence <= 0.65 && !isOnlySmallTalk(body.message)) {
    await bestEffortCaptureKbQuestion({
      supabase,
      conversationId,
      context,
      userText: body.message,
      assistantText: assistantMessage,
      intent,
      reason: 'uncertain',
    });
  }

  return NextResponse.json(resp);
}
