import type { ChatbotContext, ChatbotIntent, ServiceSuggestion } from './types';

type Rule = {
  id: string;
  intents: ChatbotIntent[];
  keywords: string[];
  serviceTypeNameHints: string[];
  packageNameHints?: string[];
  why: string;
  kind: ServiceSuggestion['kind'];
};

/**
 * Deterministic mapping rules (no LLM here).
 * We map message → service_types / service_packages by name hints.
 */
const RULES: Rule[] = [
  {
    id: 'rsa-breakdown',
    intents: ['RSA'],
    keywords: ['rsa', 'roadside', 'breakdown', 'stuck', 'stranded', 'towing', 'tow', 'jump start', 'jumpstart'],
    serviceTypeNameHints: ['rsa', 'roadside', 'towing', 'tow', 'jump start', 'jumpstart'],
    why: 'Aapki car road par stuck / start nahi ho rahi lag rahi hai, is case me on-road help (towing/jumpstart) best hota hai.',
    kind: 'RSA',
  },
  {
    id: 'periodic-service',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['periodic', 'service due', 'oil', 'engine oil', 'filter', 'basic service'],
    serviceTypeNameHints: ['periodic', 'general', 'basic', 'standard'],
    packageNameHints: ['basic', 'standard', 'gold', 'silver', 'premium'],
    why: 'Regular service me oils/filters inspection + preventive checks hote hain, jo common reliability issues prevent karta hai.',
    kind: 'PACKAGE',
  },
  {
    id: 'battery',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY', 'RSA'],
    keywords: ['battery', 'self', 'jump', 'not starting', "won't start", 'clicking'],
    serviceTypeNameHints: ['battery', 'jump'],
    why: 'Not-starting/clicking sound aksar weak battery ya charging issue ki wajah se hota hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'ac',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['ac', 'aircon', 'cooling', 'not cooling', 'gas', 'compressor'],
    serviceTypeNameHints: ['ac', 'air conditioning', 'cooling'],
    why: 'AC cooling issue me refrigerant leak / gas top-up / filter cleaning jaise checks required hote hain.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'brakes',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['brake', 'brakes', 'squeal', 'grinding', 'brake pedal', 'abs', 'braking'],
    serviceTypeNameHints: ['brake', 'abs'],
    why: 'Brake noise/feel issue safety related hota hai—pads/discs/fluids inspection zaroori hota hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'tyre',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY', 'RSA'],
    keywords: ['tyre', 'tire', 'puncture', 'flat', 'wheel', 'alignment', 'balancing'],
    serviceTypeNameHints: ['tyre', 'tire', 'puncture', 'wheel', 'alignment', 'balancing'],
    why: 'Puncture/tyre issue me puncture repair ya alignment/balancing check ki need hoti hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'engine-noise',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['engine', 'noise', 'vibration', 'overheat', 'smoke', 'check engine', 'mil'],
    serviceTypeNameHints: ['engine', 'diagnostic', 'scan'],
    why: 'Engine noise/vibration ya warning light me diagnostic scan + inspection se root cause identify hota hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'clutch-gear',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['clutch', 'gear', 'gearbox', 'hard gear', 'slipping', 'clutch plate'],
    serviceTypeNameHints: ['clutch', 'gear', 'gearbox', 'transmission'],
    why: 'Gear hard/slipping issue aksar clutch wear ya gearbox linkage problem ki wajah se hota hai — inspection needed.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'suspension-steering',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['suspension', 'steering', 'pulling', 'thud', 'knock', 'shock', 'strut', 'bush'],
    serviceTypeNameHints: ['suspension', 'steering', 'shock', 'alignment'],
    why: 'Pulling/knocking sound me suspension/steering joints + alignment check important hota hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'wheel-alignment',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['alignment', 'balancing', 'vibration on speed', 'tyre wear', 'steering shake'],
    serviceTypeNameHints: ['alignment', 'balancing', 'wheel'],
    why: 'Speed pe vibration/uneven tyre wear me wheel alignment + balancing se issue fix hota hai.',
    kind: 'SERVICE_TYPE',
  },
  {
    id: 'denting-painting',
    intents: ['SERVICE_BOOKING', 'PRICE_ENQUIRY'],
    keywords: ['dent', 'scratch', 'painting', 'paint', 'bumper', 'panel'],
    serviceTypeNameHints: ['dent', 'paint', 'denting', 'painting', 'body'],
    why: 'Dent/scratch ke liye body inspection ke baad best repair option decide hota hai (spot vs panel).',
    kind: 'SERVICE_TYPE',
  },
];

function normalize(text: string) {
  return text.toLowerCase();
}

function scoreRule(rule: Rule, message: string, intent: ChatbotIntent) {
  if (!rule.intents.includes(intent)) return 0;
  const msg = normalize(message);
  let score = 0;
  for (const kw of rule.keywords) {
    if (msg.includes(kw)) score += 2;
  }
  return score;
}

function pickBestRules(message: string, intent: ChatbotIntent) {
  return RULES
    .map((r) => ({ r, score: scoreRule(r, message, intent) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.r);
}

async function fetchActiveServiceTypes(supabase: any) {
  const { data } = await supabase
    .from('service_types')
    .select('id, name, description')
    .eq('is_active', true)
    .order('name');
  return (data || []) as Array<{ id: string; name: string; description?: string | null }>;
}

// Mirrors the categorization approach used in /book-service (client-side).
export function getServiceCategory(serviceName: string): string {
  const name = (serviceName || '').toLowerCase();

  const hasAC = name.includes('ac') || name.includes('air condition') || name.includes('cooling');
  const hasBrake = name.includes('brake') || name.includes('brakes') || name.includes('disc') || name.includes('pad');
  const hasEngine = name.includes('engine') || name.includes('oil') || name.includes('filter') || name.includes('tune');
  const hasClutch = name.includes('clutch') || name.includes('gear') || name.includes('gearbox') || name.includes('transmission');
  const hasTyreWheel =
    name.includes('tyre') ||
    name.includes('tire') ||
    name.includes('wheel') ||
    name.includes('alignment') ||
    name.includes('balancing') ||
    name.includes('puncture');
  const hasPaint =
    name.includes('denting') ||
    name.includes('painting') ||
    name.includes('paint') ||
    name.includes('scratch') ||
    name.includes('dent') ||
    name.includes('bumper') ||
    name.includes('panel') ||
    name.includes('body') ||
    name.includes('coating') ||
    name.includes('antirust') ||
    name.includes('underbody');
  const hasBattery = name.includes('battery') || name.includes('jumpstart') || name.includes('jump start');
  const hasCleaning =
    name.includes('wash') ||
    name.includes('clean') ||
    name.includes('polish') ||
    name.includes('wax') ||
    name.includes('detailing') ||
    name.includes('interior');

  if (name.includes('periodic') || name.includes('general service') || name.includes('service (') || name.includes('points')) {
    return 'PERIODIC SERVICE';
  }

  // Match /book-service category label
  if (hasBattery) return 'BATTERY SERVICE';
  if (hasAC && !hasBrake && !hasClutch) return 'AC SERVICE';
  if (hasBrake && !hasAC) return 'BRAKE SERVICE';
  if (hasClutch && !hasAC && !hasBrake) return 'CLUTCH SERVICE';
  if (hasTyreWheel && !hasBrake && !hasClutch && !hasAC) return 'TYRE & WHEEL CARE';
  if (hasPaint && !hasCleaning) return 'DENTING PAINTING';
  if (hasCleaning) return 'DETAILING SERVICE';
  if (hasEngine && !hasAC && !hasBrake && !hasClutch) return 'ENGINE SERVICE';

  return 'OTHER SERVICES';
}

function inferForcedCategory(message: string, context?: ChatbotContext): string | null {
  const ctxCat = (context as any)?.serviceCategory;
  if (ctxCat && typeof ctxCat === 'string') return ctxCat;

  if (/(periodic|general service|maintenance|basic service|service due)/i.test(message)) return 'PERIODIC SERVICE';
  if (/(ac|air ?con|air ?condition|cooling|gas top|compressor)/i.test(message)) return 'AC SERVICE';
  if (/(battery|jump ?start|jumpstart|not starting|won't start|clicking)/i.test(message)) return 'BATTERY SERVICE';
  if (/(brake|abs|pad|disc|braking|squeal)/i.test(message)) return 'BRAKE SERVICE';
  if (/(clutch|gear|gearbox|transmission|hard gear|slipping)/i.test(message)) return 'CLUTCH SERVICE';
  if (/(dent|denting|paint|painting|scratch|bumper|panel|body|coating|antirust|underbody)/i.test(message)) return 'DENTING PAINTING';
  if (/(tyre|tire|wheel|alignment|balancing|puncture|flat)/i.test(message)) return 'TYRE & WHEEL CARE';
  if (/(wash|clean|cleaning|polish|wax|detailing|interior|exterior)/i.test(message)) return 'DETAILING SERVICE';
  if (/(engine|oil|filter|overheat|check engine|mil|vibration)/i.test(message)) return 'ENGINE SERVICE';
  return null;
}

async function fetchChecklistTemplates(supabase: any, serviceTypeIds: string[]) {
  if (serviceTypeIds.length === 0) return new Map<string, { title?: string; points?: number; items: any[] }>();
  try {
    const { data, error } = await supabase
      .from('service_type_checklist_templates')
      .select('service_type_id, title, points, checklist_items')
      .in('service_type_id', serviceTypeIds);
    if (error || !data) return new Map();
    const map = new Map<string, { title?: string; points?: number; items: any[] }>();
    (data as any[]).forEach((r) => {
      const sid = r?.service_type_id;
      const items = Array.isArray(r?.checklist_items) ? r.checklist_items : [];
      if (sid) {
        map.set(sid, {
          title: r?.title || undefined,
          points: typeof r?.points === 'number' ? r.points : undefined,
          items,
        });
      }
    });
    return map;
  } catch {
    return new Map();
  }
}

async function fetchServicePackages(supabase: any) {
  // Some environments use service_packages, others treat service_types as packages.
  // We attempt service_packages best-effort.
  const { data, error } = await supabase.from('service_packages').select('id, name, description, total_price, tax_rate');
  if (error) return [] as any[];
  return (data || []) as Array<{ id: string; name: string; description?: string | null; total_price?: any; tax_rate?: any }>;
}

async function fetchPackageItems(supabase: any, packageIds: string[]) {
  if (packageIds.length === 0) return new Map<string, string[]>();
  const { data, error } = await supabase
    .from('service_package_items')
    .select('package_id, service_type_id')
    .in('package_id', packageIds);
  if (error) return new Map<string, string[]>();

  const map = new Map<string, string[]>();
  for (const row of data || []) {
    const pkgId = (row as any).package_id as string;
    const stId = (row as any).service_type_id as string;
    if (!pkgId || !stId) continue;
    map.set(pkgId, [...(map.get(pkgId) || []), stId]);
  }
  return map;
}

function findMatchingByHints<T extends { id: string; name: string }>(items: T[], hints: string[]) {
  const lower = items.map((item) => ({ item, n: item.name.toLowerCase() }));
  const matches = lower.filter((x) => hints.some((h) => x.n.includes(h.toLowerCase())));
  // deterministic ordering
  return matches.sort((a, b) => a.n.localeCompare(b.n)).map((x) => x.item);
}

export interface ResolveServicesResult {
  suggestions: ServiceSuggestion[];
  // If a package is suggested and items are available, we include mapped service_type_ids
  packageToServiceTypeIds: Record<string, string[]>;
  // Package id -> item (service type) names (best-effort checklist)
  packageToItemNames: Record<string, string[]>;
  // Service type id -> details (best-effort)
  serviceTypeDetails: Record<string, { description?: string | null }>;
}

export async function resolveServices(supabase: any, input: { message: string; intent: ChatbotIntent; context?: ChatbotContext })
: Promise<ResolveServicesResult> {
  const { message, intent } = input;
  const forcedCategory = inferForcedCategory(message, input.context);

  const rules = pickBestRules(message, intent);
  const rawServiceTypes = await fetchActiveServiceTypes(supabase);
  const serviceTypes = rawServiceTypes.map((st: any) => ({
    ...st,
    category: getServiceCategory(st.name),
  }));
  const packages = await fetchServicePackages(supabase);

  const wantsMorePlans =
    /(aur\s+koi\s+plan|aur\s+koi\s+service|koi\s+aur\s+service|aur\s+kuch\s+service|kuch\s+aur\s+service|more\s+plan|other\s+plan|another\s+plan|more\s+options|other\s+options|plans\b|packages\b|plan\b)/i.test(
      message
    );

  const normalizedMsg = normalize(message).replace(/\bdelting\b/g, 'denting'); // common typo fix
  const STOP_TOKENS = new Set(['service', 'servicing', 'general', 'repair', 'issue', 'problem', 'please', 'help']);

  const suggestions: ServiceSuggestion[] = [];

  // Rule-driven suggestions (include more than 1)
  for (const rule of rules) {
    if (rule.kind === 'PACKAGE') {
      // Prefer packages if available
      const pkgMatches = findMatchingByHints(packages, rule.packageNameHints || rule.serviceTypeNameHints).slice(0, 3);
      for (const pkg of pkgMatches) {
        suggestions.push({ kind: 'PACKAGE', id: pkg.id, name: pkg.name, why: rule.why });
      }
      if (pkgMatches.length > 0) continue;
    }

    const stPool = forcedCategory
      ? serviceTypes.filter((st: any) => String((st as any).category || '').toUpperCase() === String(forcedCategory).toUpperCase())
      : serviceTypes;
    const stMatches = findMatchingByHints(stPool, rule.serviceTypeNameHints).slice(0, 3);
    for (const st of stMatches) {
      suggestions.push({ kind: rule.kind === 'RSA' ? 'RSA' : 'SERVICE_TYPE', id: st.id, name: st.name, why: rule.why });
    }
  }

  // If user asked for plans, or message is generic service, show more packages from DB
  const isGenericService =
    intent === 'SERVICE_BOOKING' && /(service|servicing|car service|periodic|general service|maintenance)/i.test(message);

  if (wantsMorePlans || isGenericService) {
    // Rank packages deterministically: prefer common plan names, then alphabetical
    const preferred = ['basic', 'standard', 'premium', 'gold', 'silver', 'platinum', 'comprehensive'];
    const rankedAll = [...packages].sort((a: any, b: any) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      const ap = preferred.findIndex((p) => an.includes(p));
      const bp = preferred.findIndex((p) => bn.includes(p));
      const as = ap === -1 ? 999 : ap;
      const bs = bp === -1 ? 999 : bp;
      if (as !== bs) return as - bs;
      return an.localeCompare(bn);
    });

    const ranked =
      forcedCategory
        ? rankedAll.filter((p: any) => {
            const cat = getServiceCategory(p.name || '');
            if (String(forcedCategory).toUpperCase() === 'PERIODIC SERVICE') {
              // Don't show cleaning packages when user wants general/periodic service
              return cat === 'PERIODIC SERVICE' || preferred.some((w) => (p.name || '').toLowerCase().includes(w));
            }
            return String(cat).toUpperCase() === String(forcedCategory).toUpperCase();
          })
        : rankedAll;

    for (const pkg of ranked.slice(0, wantsMorePlans ? 8 : 5)) {
      suggestions.push({
        kind: 'PACKAGE',
        id: pkg.id,
        name: pkg.name,
        why: 'Ye plan vehicle maintenance ke liye common choices hain — exact fit inspection + car model par depend karta hai.',
      });
    }
  }

  // If user wants a specific category (especially PERIODIC SERVICE), prefer service_types within that category.
  if ((wantsMorePlans || isGenericService) && forcedCategory) {
    const inCat = serviceTypes
      .filter((st: any) => String((st as any).category || '').toUpperCase() === String(forcedCategory).toUpperCase())
      .slice(0, wantsMorePlans ? 8 : 6);
    for (const st of inCat) {
      suggestions.push({
        kind: 'SERVICE_TYPE',
        id: st.id,
        name: st.name,
        why: `Category: ${forcedCategory}`,
      });
    }
  }

  // Direct name/category matching (works even when user types \"denting\" or specific service)
  const tokens = normalizedMsg
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4 && !STOP_TOKENS.has(t))
    .slice(0, 6);

  if (tokens.length > 0) {
    const pool = forcedCategory
      ? serviceTypes.filter((st: any) => String((st as any).category || '').toUpperCase() === String(forcedCategory).toUpperCase())
      : serviceTypes;

    const matches = pool
      .filter((st) => {
        const n = (st.name || '').toLowerCase();
        const c = ((st as any).category || '').toLowerCase();
        return tokens.some((t) => n.includes(t) || c.includes(t));
      })
      .slice(0, 6);

    for (const st of matches) {
      suggestions.push({
        kind: 'SERVICE_TYPE',
        id: st.id,
        name: st.name,
        why: 'Aapke keyword ke basis par yahi service sabse relevant lag rahi hai.',
      });
    }
  }

  // Generic fallback for \"service\": show a few popular categories from DB service_types
  // If category is forced, stay within that category (book-service style).
  if ((wantsMorePlans || isGenericService) && suggestions.filter((s) => s.kind === 'SERVICE_TYPE').length === 0) {
    if (forcedCategory) {
      const inCat = serviceTypes
        .filter((st: any) => String((st as any).category || '').toUpperCase() === String(forcedCategory).toUpperCase())
        .slice(0, wantsMorePlans ? 8 : 6);
      for (const st of inCat) {
        suggestions.push({
          kind: 'SERVICE_TYPE',
          id: st.id,
          name: st.name,
          why: `Category: ${forcedCategory}`,
        });
      }
    } else {
    const byCategory = new Map<string, any[]>();
    for (const st of serviceTypes) {
      const cat = ((st as any).category as string) || 'OTHER';
      byCategory.set(cat, [...(byCategory.get(cat) || []), st]);
    }
    const categoryPriority = [
      'PERIODIC SERVICE',
      'AC SERVICE',
      'BATTERY SERVICE',
      'BRAKE SERVICE',
      'CLUTCH SERVICE',
      'DENTING PAINTING',
      'TYRE & WHEEL CARE',
      'DETAILING SERVICE',
    ];
    const cats = Array.from(byCategory.keys()).sort((a, b) => {
      const ap = categoryPriority.findIndex((x) => a.toUpperCase().includes(x));
      const bp = categoryPriority.findIndex((x) => b.toUpperCase().includes(x));
      const as = ap === -1 ? 999 : ap;
      const bs = bp === -1 ? 999 : bp;
      if (as !== bs) return as - bs;
      return a.localeCompare(b);
    });

    for (const cat of cats.slice(0, 4)) {
      const list = byCategory.get(cat) || [];
      const pick = list[0];
      if (!pick) continue;
      suggestions.push({
        kind: 'SERVICE_TYPE',
        id: pick.id,
        name: pick.name,
        why: `Popular category: ${cat}`,
      });
    }
    }
  }

  // If service_packages table is empty/unavailable, still show multiple periodic service options from service_types.
  if ((wantsMorePlans || isGenericService) && packages.length === 0) {
    const periodic = serviceTypes
      .filter((st: any) => ((st.category as string) || '').toUpperCase().includes('PERIODIC'))
      .slice(0, wantsMorePlans ? 6 : 3);
    for (const st of periodic) {
      suggestions.push({
        kind: 'SERVICE_TYPE',
        id: st.id,
        name: st.name,
        why: 'Ye periodic service options hain — points/checklist package ke hisaab se vary karta hai.',
      });
    }
  }

  // If still empty, offer a safe generic choice
  if (suggestions.length === 0) {
    const fallback = findMatchingByHints(serviceTypes, ['inspection', 'diagnostic', 'general', 'check']);
    for (const st of fallback.slice(0, 2)) {
      suggestions.push({
        kind: 'SERVICE_TYPE',
        id: st.id,
        name: st.name,
        why: 'Pehle inspection/diagnostic se exact issue identify karna safest hota hai.',
      });
    }
  }

  // Deduplicate by kind+id (deterministic)
  const seen = new Set<string>();
  const dedupedAll = suggestions.filter((s) => {
    const k = `${s.kind}:${s.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Keep a sensible number of options unless user explicitly asks for more
  const deduped = dedupedAll.slice(0, wantsMorePlans ? 8 : isGenericService ? 6 : 4);

  // Best-effort mapping for packages → service types (for booking without inventing new flows)
  const packageIds = deduped.filter((s) => s.kind === 'PACKAGE').map((s) => s.id);
  const itemsMap = await fetchPackageItems(supabase, packageIds);
  const packageToServiceTypeIds: Record<string, string[]> = {};
  for (const pkgId of packageIds) {
    packageToServiceTypeIds[pkgId] = itemsMap.get(pkgId) || [];
  }

  // Build service type details map
  const serviceTypeDetails: Record<string, { description?: string | null }> = {};
  for (const st of serviceTypes) {
    serviceTypeDetails[st.id] = { description: st.description ?? null };
  }

  // Best-effort: checklist templates for suggested service types
  const suggestedServiceTypeIds = deduped.filter((s) => s.kind === 'SERVICE_TYPE').map((s) => s.id);
  const templates = await fetchChecklistTemplates(supabase, suggestedServiceTypeIds);
  for (const sid of suggestedServiceTypeIds) {
    const tpl = templates.get(sid);
    if (tpl && tpl.items?.length) {
      // Attach a short hint into description if empty
      if (!serviceTypeDetails[sid]?.description) {
        const firstItems = tpl.items
          .slice(0, 4)
          .map((it: any) => (typeof it === 'string' ? it : it?.title || it?.name))
          .filter(Boolean);
        if (firstItems.length > 0) {
          serviceTypeDetails[sid] = {
            description: `Checklist: ${firstItems.join(', ')}`,
          };
        }
      }
    }
  }

  // Build checklist names for packages
  const idToName = new Map(serviceTypes.map((st) => [st.id, st.name]));
  const packageToItemNames: Record<string, string[]> = {};
  for (const pkgId of packageIds) {
    const stIds = packageToServiceTypeIds[pkgId] || [];
    const names = stIds.map((id) => idToName.get(id)).filter(Boolean) as string[];
    packageToItemNames[pkgId] = names.slice(0, 12);
  }

  return { suggestions: deduped, packageToServiceTypeIds, packageToItemNames, serviceTypeDetails };
}
