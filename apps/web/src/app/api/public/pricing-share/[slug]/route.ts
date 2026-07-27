import { NextRequest, NextResponse } from 'next/server';
import {
  getOilTypeForPlan,
  getPlanTierLabel,
  getPlanPoints,
  getPlanBadge,
  groupPeriodicPlans,
} from '@/lib/whatsappBotFlow/periodicPlansUi';
import {
  getPricingShareLinkBySlug,
  loadPricingForShareLink,
  SHARE_CATEGORY_LABELS,
} from '@/lib/telecaller/pricingShareLinks';
import { parseServiceIdList } from '@/lib/telecaller/crmQuote';

export const dynamic = 'force-dynamic';

/**
 * Public: load time-limited pricing share page data.
 * GET /api/public/pricing-share/:slug
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const found = await getPricingShareLinkBySlug(slug);
    if (!found.ok) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    if (found.expired) {
      return NextResponse.json(
        {
          expired: true,
          error: 'This pricing link has expired. Please contact MyFNG for updated prices.',
          carModel: found.row.car_model,
          pincode: found.row.pincode,
          expiresAt: found.row.expires_at,
        },
        { status: 410 },
      );
    }

    const { blocks, error } = await loadPricingForShareLink(found.row);
    if (error || !blocks.length) {
      return NextResponse.json(
        {
          error: 'Prices unavailable for this car / pincode right now.',
          carModel: found.row.car_model,
          pincode: found.row.pincode,
        },
        { status: 404 },
      );
    }

    const payloadBlocks = blocks.map((block) => {
      if (block.isPeriodic) {
        const grouped = groupPeriodicPlans(block.plans);
        const mapPlan = (p: (typeof block.plans)[0]) => ({
          id: p.service_type_id,
          name: p.service_name,
          tier: getPlanTierLabel(p.service_name),
          points: p.points,
          pointsLabel: getPlanPoints(p),
          badge: getPlanBadge(p.service_name),
          price: Math.round(Number(p.min_price || 0)),
          oil: getOilTypeForPlan(p),
          checklist: Array.isArray(p.checklist_items)
            ? p.checklist_items.map((item: any) =>
                typeof item === 'string' ? item : String(item?.name || item?.title || ''),
              ).filter(Boolean)
            : [],
        });
        return {
          category: block.category,
          isPeriodic: true,
          semi: grouped.semi.map(mapPlan),
          full: grouped.full.map(mapPlan),
          other: grouped.unknown.map(mapPlan),
        };
      }

      return {
        category: block.category,
        isPeriodic: false,
        plans: block.plans.map((p) => ({
          id: p.service_type_id,
          name: p.service_name,
          tier: getPlanTierLabel(p.service_name),
          points: p.points,
          pointsLabel: getPlanPoints(p),
          price: Math.round(Number(p.min_price || 0)),
          checklist: Array.isArray(p.checklist_items)
            ? p.checklist_items
                .map((item: any) =>
                  typeof item === 'string' ? item : String(item?.name || item?.title || ''),
                )
                .filter(Boolean)
            : [],
        })),
      };
    });

    const categoryTabs = payloadBlocks.map((b) => ({
      id: b.category,
      label: SHARE_CATEGORY_LABELS[b.category] || b.category.replace(/^Car\s+/i, '').replace(/\s+Service$/i, ''),
      count: b.isPeriodic
        ? (b.semi?.length || 0) + (b.full?.length || 0)
        : b.plans?.length || 0,
    }));

    return NextResponse.json({
      expired: false,
      slug: found.row.slug,
      customerName: found.row.customer_name,
      customerPhone: found.row.customer_phone || null,
      carModel: found.row.car_model,
      pincode: found.row.pincode,
      city: found.row.city,
      categories: found.row.categories,
      categoryTabs,
      preselectedIds: parseServiceIdList(found.row.service_type_ids),
      expiresAt: found.row.expires_at,
      blocks: payloadBlocks,
      bookUrl: '/book-service',
      viewOnly: true,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}
