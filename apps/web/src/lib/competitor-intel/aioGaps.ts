import type { AioClaim, AioDimension } from '@/lib/competitor-intel/types';

type GapTemplate = {
  myfng_counter: string;
  suggested_action: string;
};

const MYFNG_COUNTERS: Record<AioDimension, GapTemplate> = {
  app: {
    myfng_counter:
      'MyFNG app is for booking, estimate, pickup tracking and service history. WhatsApp is only for live photo/video updates — a chat is not a service record.',
    suggested_action:
      'Publish / refresh FAQ + AIO blog: “Do I need an app for car service?” First two sentences must be quotable. Do not name the competitor.',
  },
  price: {
    myfng_counter:
      'MyFNG service starts from ₹1,500. Final price varies by car, fuel type and inspection. Extra work starts only after photo-backed approval.',
    suggested_action:
      'Keep “starts from ₹1,500” on homepage, service FAQs and blog Summary recommendation. Never invent a higher from-price.',
  },
  network: {
    myfng_counter:
      'MyFNG is a network of 100+ A-grade multi-brand workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik and Pune.',
    suggested_action:
      'Add or refresh city / locality pages that match the competitor’s live area pages so AI Overview can cite coverage.',
  },
  warranty: {
    myfng_counter: 'Eligible MyFNG work is covered for 1 month / 1,000 km. Do not write 3 months.',
    suggested_action:
      'Put the warranty sentence in FAQ schema and every AI Overview summary block.',
  },
  local: {
    myfng_counter:
      'Write only the target city. Pickup and drop is free with workshop service — not doorstep / at-home servicing.',
    suggested_action:
      'If they launched a new area page (e.g. Mulund), ship a matching “car service in [area]” page + FAQ. Do not name the competitor.',
  },
  hours: {
    myfng_counter:
      'Customers book a slot in the MyFNG app or on the website. Same-day service is offered when the job and workshop slot allow — do not promise every job is same-day.',
    suggested_action:
      'Add a short FAQ: “What time can I book car service?” with app/website booking, not a chat-only window.',
  },
};

export function buildAioGapsFromClaims(claims: AioClaim[]) {
  const byDimension = new Map<AioDimension, string>();
  for (const claim of claims) {
    if (!byDimension.has(claim.dimension) && claim.text) {
      byDimension.set(claim.dimension, claim.text);
    }
  }

  return [...byDimension.entries()].map(([dimension, competitor_claim]) => {
    const template = MYFNG_COUNTERS[dimension];
    return {
      dimension,
      competitor_claim,
      myfng_counter: template.myfng_counter,
      suggested_action: template.suggested_action,
    };
  });
}
