/** Package rules MISA must follow — periodic vs other categories (WhatsApp + web chat). */

export const MISA_PERIODIC_TIERS = [
  { tier: 'Basic', points: 15 },
  { tier: 'General', points: 30 },
  { tier: 'Premium', points: 50 },
  { tier: 'Platinum', points: 60 },
] as const;

export const MISA_PERIODIC_PACKAGE_RULES = `
# PACKAGE DATA — SUPER ADMIN SERVICE PACKAGES ONLY (single source of truth)
- All package names, point counts, descriptions, and checklists come from **Super Admin → Inventory → Service Packages** (database: \`service_types\` + \`service_type_checklist_templates\`).
- **NEVER** invent points, checklist lines, or package names from memory, prompts, or old training text.
- **NEVER** use hardcoded fallback lists for customer answers.

# WHERE MISA GETS PACKAGE DATA
1. \`get_service_pricing\` (Car Periodic or any category) — each plan row has \`service_name\`, \`points\`, \`checklist_count\`, \`checklist_items\`, \`service_type_id\` from inventory.
2. \`get_service_details\` — checklist for one plan by exact \`service_name\` from inventory (same templates as admin "Checklist" on each card).
- If checklist is empty in tools: say the team will share the full list at booking — do **not** guess items.

# CAR PERIODIC SERVICE — STRUCTURE (names from pricing tool only)
- Under **Car Periodic Service** there are four tiers: Basic, General, Premium, Platinum — each in **Semi Synthetic** and **Fully Synthetic** (8 plans when all are priced).
- Point count for each plan = \`points\` / \`checklist_count\` on that plan row — not from memory.
- After \`get_service_pricing\` for Car Periodic: show Semi Synthetic plans (tier order from API), then Fully Synthetic same order.
- Quote **exact** \`service_name\` from pricing. Do not invent "Standard", "Comprehensive", etc.

# ENGINE OIL — SEMI vs FULLY SYNTHETIC
- If customer asks price without oil type: ask "Semi Synthetic or Fully Synthetic engine oil?"
- Oil type is in the plan name from inventory.

# WHEEL ALIGNMENT — NOT IN ANY PERIODIC PACKAGE
- Wheel alignment / balancing = separate **Car Tyre & Wheel Care** package — book separately.
- List only checklist items returned by tools — do not add wheel alignment to periodic unless it appears on that plan's inventory checklist (normally it should not).

# OTHER CATEGORIES
Car AC, Battery, Brake, Clutch, Engine, Denting & Painting, Detailing, Tyre & Wheel Care, Electrical & Battery, Suspension & Steering — separate service packages in inventory; use \`get_service_pricing\` + \`get_service_details\` for that category only.

# "KYA INCLUDED HAI"
- Call \`get_service_details\` with the **exact** plan name from \`get_service_pricing\` (e.g. "General Service (Semi Synthetic)").
- Summarize only returned \`checklist\` items and \`points\`.
`.trim();

/** Customer-facing periodic checklist — wheel alignment is a separate product, not periodic. */
export function filterPeriodicChecklistForCustomer(items: unknown[]): unknown[] {
  return (items || []).filter((item) => {
    const name = String((item as { name?: string })?.name || item || '').toLowerCase();
    return !/wheel\s*align|wheel\s*alignment|\balignment\b/.test(name);
  });
}

export function periodicPackageRulesForTool(periodic: boolean): string | undefined {
  return periodic ? MISA_PERIODIC_PACKAGE_RULES : undefined;
}

export function messageLooksPeriodicPackageQuery(text: string): boolean {
  const t = String(text || '').toLowerCase();
  return (
    /periodic|general service|basic service|premium service|platinum|15\s*point|30\s*point|50\s*point|60\s*point/.test(
      t,
    ) ||
    (/wheel\s*align|alignment|balancing|included|package|semi|fully|synthetic|engine oil/.test(t) &&
      /service|periodic|general|basic|premium/.test(t))
  );
}