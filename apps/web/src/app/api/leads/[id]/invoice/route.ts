/**
 * Invoice Generation API
 * Task: WA-702
 * Generates invoice for completed leads
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateTaxes, getPlaceOfSupply, numberToWords, roundOff } from '@/lib/utils/invoiceUtils';
import { getEffectivePricingItemAmount, getEffectiveQty } from '@/lib/utils/pricing';
import { resolveWorkshopServicePrice } from '@/lib/utils/workshopServicePricing';

export const dynamic = 'force-dynamic';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    if (!isUuid(leadId)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
    }

    // Fetch lead details with all related data including pricing fields
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select(`
        *,
        workshop:workshops!workshop_id(name, address, phone, email, gst_number)
      `)
      .eq('id', leadId)
      .single();
    
    // Debug: Log lead pricing fields
    console.log('Lead pricing fields:', {
      estimated_cost: lead?.estimated_cost,
      estimated_amount: lead?.estimated_amount,
      final_amount: lead?.final_amount,
      total_price: lead?.total_price,
      actual_amount: lead?.actual_amount,
      discount_amount: lead?.discount_amount,
      tax_amount: lead?.tax_amount,
    });

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check authorization - fetch role with join
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get role code
    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has invoice generation permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR', 'WORKSHOP_ADVISER'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    // Verify user belongs to the same workshop (for workshop staff)
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR', 'WORKSHOP_ADVISER'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Check if lead status allows invoice generation
    if (!['READY_FOR_DELIVERY', 'DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED'].includes(lead.status)) {
      return NextResponse.json(
        { error: 'Invoice can only be generated for completed leads' },
        { status: 400 }
      );
    }

    // Check if any invoice already exists for this lead.
    // NEW FLOW: a lead can have multiple invoices (ORDER_SUMMARY, CUSTOMER_INVOICE, TAX_INVOICE).
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (existingInvoices && existingInvoices.length > 0) {
      const preferred =
        existingInvoices.find((i: any) => i.invoice_type === 'TAX_INVOICE') ||
        existingInvoices.find((i: any) => i.invoice_type === 'CUSTOMER_INVOICE') ||
        existingInvoices.find((i: any) => i.invoice_type === 'ORDER_SUMMARY') ||
        existingInvoices[0];

      return NextResponse.json(
        {
          success: true,
          invoice: preferred,
          invoices: existingInvoices,
          note: 'Existing invoice(s) found for this lead',
        },
        { status: 200 }
      );
    }

    // Fetch pricing items from lead_pricing_items table (primary source)
    const { data: pricingItems } = await supabase
      .from('lead_pricing_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE');

    // Fetch job card and parts
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select('*, job_card_parts(*)')
      .eq('lead_id', leadId)
      .maybeSingle();

    // Fetch approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    // Calculate amounts - prioritize backend set rates:
    // 1. final_amount (if already calculated in backend)
    // 2. total_price (total with taxes)
    // 3. actual_amount (final before taxes)
    // 4. estimated_cost or estimated_amount (backend estimates)
    // 5. lead_pricing_items (if exists, sum them up)
    let baseAmount = 0;
    
    // Priority 1: Use final_amount if backend has already calculated it
    if (lead.final_amount && parseFloat(lead.final_amount) > 0) {
      baseAmount = parseFloat(lead.final_amount);
    }
    // Priority 2: Use total_price (includes taxes)
    else if (lead.total_price && parseFloat(lead.total_price) > 0) {
      baseAmount = parseFloat(lead.total_price);
    }
    // Priority 3: Use actual_amount (final before taxes)
    else if (lead.actual_amount && parseFloat(lead.actual_amount) > 0) {
      baseAmount = parseFloat(lead.actual_amount);
    }
    // Priority 4: Use estimated_cost (backend estimate)
    else if (lead.estimated_cost && parseFloat(lead.estimated_cost) > 0) {
      baseAmount = parseFloat(lead.estimated_cost);
    }
    // Priority 5: Use estimated_amount (backend estimate)
    else if (lead.estimated_amount && parseFloat(lead.estimated_amount) > 0) {
      baseAmount = parseFloat(lead.estimated_amount);
    }
    // Priority 6: Sum up pricing items if available
    else if (pricingItems && pricingItems.length > 0) {
      baseAmount = pricingItems.reduce((sum, item) => sum + getEffectivePricingItemAmount(item), 0);
    }
    
    const partsTotal = jobCard?.job_card_parts?.reduce(
      (sum: number, part: any) => sum + parseFloat(part.total_price || '0'),
      0
    ) || 0;
    
    const extraChargesTotal = extraCharges?.reduce(
      (sum, charge) => sum + parseFloat(charge.amount || '0'),
      0
    ) || 0;

    // Check if baseAmount already includes taxes (final_amount or total_price)
    const amountIncludesTax = lead.final_amount || lead.total_price;
    
    let subtotal, cgst, sgst, totalAmount;
    
    if (amountIncludesTax && baseAmount > 0) {
      // If backend already calculated final amount with taxes, use it directly
      // Extract tax from the total (assuming 18% total tax: 9% CGST + 9% SGST)
      const taxRate = 0.18; // 18% total
      subtotal = parseFloat((baseAmount / (1 + taxRate)).toFixed(2));
      cgst = parseFloat((subtotal * 0.09).toFixed(2));
      sgst = parseFloat((subtotal * 0.09).toFixed(2));
      totalAmount = baseAmount; // Use the backend calculated amount
    } else {
      // Calculate taxes from base amount
      subtotal = baseAmount + partsTotal + extraChargesTotal;
      cgst = parseFloat((subtotal * 0.09).toFixed(2)); // 9% CGST
      sgst = parseFloat((subtotal * 0.09).toFixed(2)); // 9% SGST
      totalAmount = parseFloat((subtotal + cgst + sgst).toFixed(2));
    }

    // If all amounts are 0, this might be an issue - log warning but allow to proceed
    if (baseAmount === 0 && partsTotal === 0 && extraChargesTotal === 0) {
      console.warn('⚠️ Warning: All invoice amounts are 0. Lead might not have pricing configured.');
      // You might want to return an error here or use a default amount
      // For now, we'll allow it but log the warning
    }

    // Debug logging
    console.log('Invoice calculation:', {
      pricingItemsCount: pricingItems?.length || 0,
      baseAmount,
      partsTotal,
      extraChargesTotal,
      subtotal,
      cgst,
      sgst,
      totalAmount,
      amountIncludesTax,
      leadFinalAmount: lead.final_amount,
      leadTotalPrice: lead.total_price,
      leadActualAmount: lead.actual_amount,
      leadEstimatedCost: lead.estimated_cost,
      leadEstimatedAmount: lead.estimated_amount,
    });

    // Generate invoice number - handle case where lead_number might be null
    // Make it more unique with timestamp and random component
    const leadNumber = lead.lead_number || lead.id.substring(0, 8).toUpperCase().replace(/-/g, '');
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const invoiceNumber = `INV-${leadNumber}-${timestamp.toString().slice(-8)}-${randomSuffix}`;
    
    // Ensure invoice number doesn't exceed 50 characters (database constraint)
    const finalInvoiceNumber = invoiceNumber.length > 50 
      ? `INV-${timestamp}-${randomSuffix}` 
      : invoiceNumber;

    // Validate required fields
    if (!lead.workshop_id) {
      return NextResponse.json({ 
        error: 'Lead workshop_id is missing',
        lead_id: leadId
      }, { status: 400 });
    }

    // Create invoice with proper numeric types
    // All columns now available after migration
    const invoiceData: any = {
      lead_id: leadId,
      workshop_id: lead.workshop_id,
      invoice_number: finalInvoiceNumber,
      base_amount: baseAmount,
      parts_cost: partsTotal,
      extra_charges: extraChargesTotal,
      labour_cost: 0,
      discount: 0,
      sub_total: subtotal,
      // Tax columns
      cgst_percentage: 9,
      cgst_amount: cgst,
      sgst_percentage: 9,
      sgst_amount: sgst,
      igst_percentage: 0,
      igst_amount: 0,
      total_tax: cgst + sgst,
      tax_amount: cgst + sgst,
      final_amount: totalAmount,
      total_amount: totalAmount,
      payment_status: 'PENDING',
      status: 'GENERATED',
      invoice_type: 'TAX_INVOICE',
      visible_to_customer: false,
      show_gst_breakup: true,
      generated_by: userProfile.id,
    };

    console.log('Creating invoice with data:', JSON.stringify(invoiceData, null, 2));

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      console.error('Invoice error details:', JSON.stringify(invoiceError, null, 2));
      console.error('Invoice data attempted:', JSON.stringify(invoiceData, null, 2));
      return NextResponse.json({ 
        error: 'Failed to create invoice',
        details: invoiceError.message,
        code: invoiceError.code,
        hint: invoiceError.hint
      }, { status: 500 });
    }

    // Update lead with invoice details and status
    const now = new Date().toISOString();
    await supabase
      .from('service_leads')
      .update({ 
        final_amount: totalAmount,
        invoice_id: invoice.id,
        invoice_generated_by: userProfile.id,
        invoice_generated_at: now,
        status: 'INVOICE_GENERATED', // ✨ Update status to INVOICE_GENERATED
        updated_at: now
      })
      .eq('id', leadId);

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        changed_by: userProfile.id,
        changed_at: now,
        reason: 'Invoice generated',
        notes: `Invoice number: ${finalInvoiceNumber}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'INVOICE_GENERATED',
        description: `Invoice generated: ${finalInvoiceNumber}`,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: finalInvoiceNumber,
          total_amount: totalAmount,
        }
      });

    // Create event
    await supabase.from('lead_events').insert({
      lead_id: leadId,
      event_type: 'INVOICE_GENERATED',
      event_description: `Invoice ${finalInvoiceNumber} generated - ₹${totalAmount.toFixed(2)}`,
      event_data: {
        invoice_id: invoice.id,
        invoice_number: finalInvoiceNumber,
        total_amount: totalAmount,
      },
      created_by: user.id,
    });

    // Map database fields to component expected fields
    const mappedInvoice = {
      ...invoice,
      parts_amount: (invoice as any).parts_cost || 0,
      extra_charges_amount: invoice.extra_charges || 0,
      subtotal: (invoice as any).sub_total || ((invoice.base_amount || 0) + (invoice.extra_charges || 0) - (invoice.discount || 0)),
      cgst: (invoice as any).cgst_amount || 0,
      sgst: (invoice as any).sgst_amount || 0,
      total_amount: (invoice as any).final_amount || invoice.total_amount || 0,
      invoice_date: invoice.created_at || new Date().toISOString(),
      due_date: (invoice as any).due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return NextResponse.json({
      message: 'Invoice generated successfully',
      invoice: mappedInvoice,
    });
  } catch (error: any) {
    console.error('Error generating invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET invoice details
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });
    if (!isUuid(leadId)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 });
    }

    const parseIdList = (raw: any): string[] => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
      if (typeof raw === 'string') {
        const txt = raw.trim();
        if (!txt) return [];
        try {
          const parsed = JSON.parse(txt);
          if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } catch {
          // ignore
        }
        return txt.split(',').map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    const isApprovedExtra = (row: any) => {
      const s = String(row?.status || '').trim().toUpperCase();
      const customerApproved = row?.customer_approved === true;
      return (
        customerApproved ||
        s === 'APPROVED' ||
        s === 'CUSTOMER_APPROVED' ||
        s === 'APPROVED_BY_CUSTOMER' ||
        s === 'ACCEPTED'
      );
    };

    const normalizeName = (s: string) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Will be populated lazily when/if we need to hydrate invoices
    let masterByName: Map<string, { oem: number; oes: number; labour: number }> | null = null;

    const ensureMasterMap = async (workshopId: string) => {
      if (masterByName) return masterByName;
      masterByName = new Map<string, { oem: number; oes: number; labour: number }>();
      try {
        const { data: masterJobs } = await supabase
          .from('additional_jobs_master')
          .select('name, oem_price, oes_price, labour_price, workshop_id, is_active, deleted_at')
          .or(`workshop_id.eq.${workshopId},workshop_id.is.null`)
          .eq('is_active', true);

        for (const it of masterJobs || []) {
          if ((it as any)?.deleted_at) continue;
          const key = normalizeName(String((it as any).name || ''));
          if (!key) continue;
          const oem = Number((it as any).oem_price);
          const oes = Number((it as any).oes_price);
          const labour = Number((it as any).labour_price);
          const row = { oem: Number.isFinite(oem) ? oem : 0, oes: Number.isFinite(oes) ? oes : 0, labour: Number.isFinite(labour) ? labour : 0 };
          // Prefer workshop-specific entry over global
          if ((it as any).workshop_id === workshopId) {
            masterByName.set(key, row);
          } else if (!masterByName.has(key)) {
            masterByName.set(key, row);
          }
        }
      } catch {
        // ignore if missing table/cols
      }
      return masterByName;
    };

    const computeExtraAmount = (row: any, workshopId?: string) => {
      const legacy = Number(row?.amount ?? 0) || 0;
      if (legacy > 0) return legacy;
      const partType = String(row?.part_price_type || 'OEM').toUpperCase();
      const part =
        partType === 'OES'
          ? Number(row?.oes_price ?? 0) || 0
          : Number(row?.oem_price ?? 0) || 0;
      const labour = Number(row?.labour_price ?? 0) || 0;
      const computed = part + labour;
      if (computed > 0) return computed;
      // If no saved prices, fallback to additional_jobs_master by description
      if (workshopId) {
        const key = normalizeName(String(row?.description || row?.reason || ''));
        const master = masterByName?.get(key);
        if (master) {
          const masterPart = partType === 'OES' ? master.oes : master.oem;
          return (Number(masterPart) || 0) + (Number(master.labour) || 0);
        }
      }
      return 0;
    };

    // Check authorization - fetch role with join
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id, roles(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get role code
    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has invoice viewing permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR', 'WORKSHOP_ADVISER'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    // NEW FLOW: a lead can have multiple invoices (OS/CI/TI). Fetch a small window and pick the best.
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      console.error('Error fetching invoice list:', error);
      throw error;
    }

    const list = Array.isArray(invoices) ? invoices : [];
    const pickLatestOfType = (t: string) => list.find((i: any) => String(i?.invoice_type || '').toUpperCase() === t);

    // Priority: TI > CI > OS. Fallback to first by created_at desc.
    const invoice =
      pickLatestOfType('TAX_INVOICE') ||
      pickLatestOfType('CUSTOMER_INVOICE') ||
      pickLatestOfType('ORDER_SUMMARY') ||
      list[0] ||
      null;

    // If invoice exists, verify workshop access for workshop staff
    // Fetch lead meta for scoping + service_type_ids (schema-safe)
    const { data: leadMeta } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    const parseServiceNameHints = (raw: any): string[] =>
      String(raw || '')
        .split(/[,+/|&]| and /i)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && !isUuid(s));

    const oilTypeToken = (name: string): 'fully' | 'semi' | 'mineral' | null => {
      const n = normalizeName(name);
      if (!n) return null;
      if (/\bfully\b/.test(n) || n.includes('full synthetic')) return 'fully';
      if (/\bsemi\b/.test(n)) return 'semi';
      if (/\bmineral\b/.test(n)) return 'mineral';
      return null;
    };

    const serviceNamesCompatible = (a: string, b: string) => {
      const oilA = oilTypeToken(a);
      const oilB = oilTypeToken(b);
      if (oilA && oilB && oilA !== oilB) return false;
      return true;
    };

    const resolveLeadServiceTypeIds = async (leadRow: any): Promise<string[]> => {
      const uuidIds = parseIdList(leadRow?.service_type_ids).filter(isUuid);
      const fullName = String(leadRow?.service_type || '').trim();
      const nameHints = parseServiceNameHints(fullName);
      const found = new Set<string>(uuidIds);
      const leadOil = oilTypeToken(fullName);

      if (fullName) {
        try {
          const { data: exactRows } = await supabase
            .from('service_types')
            .select('id, name')
            .ilike('name', fullName)
            .limit(10);
          for (const st of exactRows || []) {
            const id = String((st as any)?.id || '').trim();
            const stName = String((st as any)?.name || '');
            if (!id) continue;
            if (!serviceNamesCompatible(fullName, stName)) continue;
            if (normalizeName(stName) === normalizeName(fullName)) found.add(id);
          }
        } catch {
          // ignore
        }
      }

      if (nameHints.length === 0) return [...found];
      try {
        const orFilter = nameHints
          .slice(0, 8)
          .map((n) => `name.ilike.%${String(n).replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ').trim()}%`)
          .filter(Boolean)
          .join(',');
        if (!orFilter) return [...found];
        const { data } = await supabase.from('service_types').select('id, name').or(orFilter).limit(25);
        const scored: Array<{ id: string; name: string; score: number }> = [];
        for (const st of data || []) {
          const id = String((st as any)?.id || '').trim();
          const stName = String((st as any)?.name || '');
          const stNorm = normalizeName(stName);
          if (!id || !stNorm) continue;
          const stOil = oilTypeToken(stName);
          // Lead says Semi → never pick Fully (and vice versa).
          if (leadOil && stOil && leadOil !== stOil) continue;

          let best = 0;
          for (const h of nameHints) {
            const nh = normalizeName(h);
            const hintOil = oilTypeToken(h);
            if (hintOil && stOil && hintOil !== stOil) continue;
            if (stNorm === nh) best = Math.max(best, 100);
            else if (stNorm.startsWith(nh) || nh.startsWith(stNorm)) best = Math.max(best, 80);
            else if (stNorm.includes(nh) || nh.includes(stNorm)) best = Math.max(best, 50);
          }
          if (best > 0) scored.push({ id, name: stName, score: best });
        }
        scored.sort((a, b) => b.score - a.score);

        const nonOil = scored.filter((row) => !oilTypeToken(row.name));
        const oilRows = scored.filter((row) => Boolean(oilTypeToken(row.name)));

        if (leadOil) {
          for (const row of scored) {
            const rowOil = oilTypeToken(row.name);
            if (rowOil && rowOil !== leadOil) continue;
            if (row.score >= 50) found.add(row.id);
          }
        } else if (uuidIds.length > 0) {
          // UUIDs already set — don't expand into every oil sibling.
        } else if (oilRows.length > 0) {
          // "General Service" style leads usually map to Semi/Fully packages — pick ONE (prefer Semi).
          const prefer =
            oilRows.find((row) => oilTypeToken(row.name) === 'semi') ||
            oilRows.find((row) => oilTypeToken(row.name) === 'fully') ||
            oilRows[0];
          if (prefer) {
            for (const id of [...found]) {
              if (!uuidIds.includes(id)) found.delete(id);
            }
            found.add(prefer.id);
          }
        } else if (nonOil.length > 0 && nonOil[0].score >= 80) {
          found.add(nonOil[0].id);
        } else {
          for (const row of scored) {
            if (row.score >= 80) found.add(row.id);
          }
        }
      } catch {
        // ignore
      }
      return [...found];
    };

    const buildExtraIncludedItems = (row: any) => {
      const fromBreakdown = Array.isArray(row?.parts_breakdown) ? row.parts_breakdown : [];
      if (fromBreakdown.length > 0) {
        return fromBreakdown
          .map((p: any) => {
            const name = String(p?.name || p?.description || '').trim();
            if (!name) return null;
            const qty = Math.max(0.01, Number(p?.qty ?? p?.quantity ?? 1) || 1);
            const unit_price = Math.max(0, Number(p?.unit_price ?? p?.rate ?? 0) || 0);
            const amountRaw = Number(p?.amount);
            const amount = Number.isFinite(amountRaw) && amountRaw >= 0 ? amountRaw : qty * unit_price;
            return { name, quantity: qty, unit_price, amount };
          })
          .filter(Boolean);
      }
      const items: Array<{ name: string; quantity: number; unit_price: number; amount: number }> = [];
      const partType = String(row?.part_price_type || 'OEM').toUpperCase() === 'OES' ? 'OES' : 'OEM';
      let part =
        partType === 'OES' ? Number(row?.oes_price ?? 0) || 0 : Number(row?.oem_price ?? 0) || 0;
      let labour = Number(row?.labour_price ?? 0) || 0;
      // If only lump-sum amount was saved, try master job prices for a detailed split.
      if (part <= 0 && labour <= 0) {
        const key = normalizeName(String(row?.description || row?.reason || ''));
        const master = masterByName?.get(key);
        if (master) {
          part = partType === 'OES' ? Number(master.oes) || 0 : Number(master.oem) || 0;
          labour = Number(master.labour) || 0;
        }
      }
      const reason = String(row?.reason || row?.work_needed || '').trim();
      if (part > 0) {
        items.push({
          name: partType === 'OES' ? 'Parts (OES)' : 'Parts (OEM)',
          quantity: 1,
          unit_price: part,
          amount: part,
        });
      }
      if (labour > 0) {
        items.push({
          name: 'Labour',
          quantity: 1,
          unit_price: labour,
          amount: labour,
        });
      }
      if (reason) {
        items.push({
          name: `Note: ${reason}`,
          quantity: 1,
          unit_price: 0,
          amount: 0,
        });
      }
      if (items.filter((x) => x.amount > 0).length === 0) {
        const amt = Number(row?.amount ?? 0) || 0;
        items.push({
          name: String(row?.description || 'Additional work').trim() || 'Additional work',
          quantity: 1,
          unit_price: amt,
          amount: amt,
        });
      }
      return items;
    };

    const resolvedServiceTypeIds = await resolveLeadServiceTypeIds(leadMeta);

    if (invoice && ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_ADVISOR', 'WORKSHOP_ADVISER'].includes(roleCode)) {
      if (leadMeta && userProfile.workshop_id !== (leadMeta as any).workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Included products/parts for each service type (service_types as packages)
    const included_service_items: Array<{
      service_type_id: string;
      service_name: string;
      service_price?: number;
      items: Array<{
        product_id: string;
        name: string;
        type: string;
        part_number?: string | null;
        unit?: string | null;
        quantity: number;
        unit_price?: number;
        amount?: number;
        price_source?: string;
      }>;
    }> = [];

    try {
      const workshopId = String((leadMeta as any)?.workshop_id || '').trim();

      // Resolve vehicleClass + zoneId for workshop_product_pricing
      let vehicleClass: string | null = null;
      let zoneId: string | null = null;
      try {
        const modelId = String((leadMeta as any)?.model_id || '').trim();
        if (modelId) {
          const { data: cm } = await supabase.from('car_models').select('class').eq('id', modelId).maybeSingle();
          vehicleClass = (cm as any)?.class || null;
        } else if ((leadMeta as any)?.vehicle_model) {
          const { data: cm } = await supabase
            .from('car_models')
            .select('class')
            .ilike('model_name', String((leadMeta as any).vehicle_model).trim())
            .maybeSingle();
          vehicleClass = (cm as any)?.class || null;
        }
      } catch {
        // ignore if table/schema differs
      }
      try {
        if (workshopId) {
          const { data: w } = await supabase.from('workshops').select('zone_id').eq('id', workshopId).maybeSingle();
          zoneId = (w as any)?.zone_id || null;
        }
      } catch {
        // ignore
      }

      const productPriceCache = new Map<string, { unit_price: number; source: string }>();
      const resolveProductUnitPrice = async (productId: string, fallbackPrice: number) => {
        if (!productId) return { unit_price: fallbackPrice || 0, source: 'fallback' };
        const cached = productPriceCache.get(productId);
        if (cached) return cached;

        let price = Number(fallbackPrice || 0) || 0;
        let source: string = price > 0 ? 'master_products' : 'fallback';

        // Workshop overrides: Class+Zone > Class > Zone > Default
        if (workshopId) {
          try {
            if (vehicleClass && zoneId) {
              const { data } = await supabase
                .from('workshop_product_pricing')
                .select('selling_price')
                .eq('workshop_id', workshopId)
                .eq('product_id', productId)
                .eq('class', vehicleClass)
                .eq('zone_id', zoneId)
                .maybeSingle();
              const p = Number((data as any)?.selling_price || 0) || 0;
              if (p > 0) {
                price = p;
                source = 'workshop_product_pricing:class+zone';
              }
            }

            if (source.startsWith('master_products') || source === 'fallback') {
              if (vehicleClass) {
                const { data } = await supabase
                  .from('workshop_product_pricing')
                  .select('selling_price')
                  .eq('workshop_id', workshopId)
                  .eq('product_id', productId)
                  .eq('class', vehicleClass)
                  .is('zone_id', null)
                  .maybeSingle();
                const p = Number((data as any)?.selling_price || 0) || 0;
                if (p > 0) {
                  price = p;
                  source = 'workshop_product_pricing:class';
                }
              }
            }

            if (source.startsWith('master_products') || source === 'fallback') {
              if (zoneId) {
                const { data } = await supabase
                  .from('workshop_product_pricing')
                  .select('selling_price')
                  .eq('workshop_id', workshopId)
                  .eq('product_id', productId)
                  .is('class', null)
                  .eq('zone_id', zoneId)
                  .maybeSingle();
                const p = Number((data as any)?.selling_price || 0) || 0;
                if (p > 0) {
                  price = p;
                  source = 'workshop_product_pricing:zone';
                }
              }
            }

            if (source.startsWith('master_products') || source === 'fallback') {
              const { data } = await supabase
                .from('workshop_product_pricing')
                .select('selling_price')
                .eq('workshop_id', workshopId)
                .eq('product_id', productId)
                .is('class', null)
                .is('zone_id', null)
                .maybeSingle();
              const p = Number((data as any)?.selling_price || 0) || 0;
              if (p > 0) {
                price = p;
                source = 'workshop_product_pricing:default';
              }
            }
          } catch {
            // ignore
          }
        }

        const out = { unit_price: Number(price || 0) || 0, source };
        productPriceCache.set(productId, out);
        return out;
      };

      const serviceTypeIds = resolvedServiceTypeIds;

      if (serviceTypeIds.length > 0) {
        let svcTypes: any[] = [];
        try {
          const { data } = await supabase
            .from('service_types')
            .select('id, name, base_price')
            .in('id', serviceTypeIds);
          svcTypes = data || [];
        } catch {
          const { data } = await supabase
            .from('service_types')
            .select('id, name')
            .in('id', serviceTypeIds);
          svcTypes = data || [];
        }
        const nameById = new Map<string, string>();
        const basePriceById = new Map<string, number>();
        for (const st of svcTypes || []) {
          const id = String((st as any).id || '');
          if (id) nameById.set(id, String((st as any).name || ''));
          const bp = parseFloat(String((st as any).base_price || '0')) || 0;
          if (id && bp > 0) basePriceById.set(id, bp);
        }

        const { data: svcItems } = await supabase
          .from('service_type_items')
          .select(
            'service_type_id, quantity, is_active, product:master_products(id, name, type, part_number, unit, default_price)'
          )
          .in('service_type_id', serviceTypeIds)
          .eq('is_active', true);

        const byService: Record<string, any[]> = {};
        for (const row of svcItems || []) {
          const sid = String((row as any).service_type_id || '');
          if (!sid) continue;
          if (!byService[sid]) byService[sid] = [];
          byService[sid].push(row);
        }

        for (const sid of serviceTypeIds) {
          const raw = byService[sid] || [];
          let servicePrice = 0;
          try {
            const leadCityId = String((leadMeta as any)?.city_id || '').trim() || null;
            const leadCityName = String((leadMeta as any)?.city || '').trim() || null;
            let workshopZoneId: string | null = null;
            try {
              if (workshopId) {
                const { data: w } = await supabase
                  .from('workshops')
                  .select('zone_id')
                  .eq('id', workshopId)
                  .maybeSingle();
                workshopZoneId = (w as any)?.zone_id || null;
              }
            } catch {
              workshopZoneId = null;
            }
            servicePrice = await resolveWorkshopServicePrice({
              supabase,
              workshopId,
              serviceTypeId: sid,
              cityId: leadCityId,
              cityName: leadCityName,
              workshopZoneId,
              vehicleClass,
            });
          } catch {
            servicePrice = 0;
          }
          if (!servicePrice) {
            servicePrice = basePriceById.get(sid) || 0;
          }
          included_service_items.push({
            service_type_id: sid,
            service_name: nameById.get(sid) || '',
            service_price: servicePrice,
            items: raw
              .map((r: any) => {
                const product_id = String(r?.product?.id || '');
                const quantity = Number(r?.quantity || 1) || 1;
                const fallbackPrice = Number(r?.product?.default_price ?? 0) || 0;
                return {
                  product_id,
                  name: String(r?.product?.name || ''),
                  type: String(r?.product?.type || ''),
                  part_number: r?.product?.part_number ?? null,
                  unit: r?.product?.unit ?? null,
                  quantity,
                  // resolved later (best-effort; async)
                  unit_price: fallbackPrice,
                  amount: fallbackPrice * quantity,
                  price_source: fallbackPrice > 0 ? 'master_products' : 'fallback',
                };
              })
              .filter((x: any) => x.product_id && x.name),
          });
        }
      }

      // Resolve workshop product prices (best-effort) and compute amounts
      for (const svc of included_service_items) {
        const items = Array.isArray(svc.items) ? svc.items : [];
        for (const it of items) {
          const productId = String(it?.product_id || '').trim();
          const qty = Number(it?.quantity || 1) || 1;
          const fallbackPrice = Number(it?.unit_price || 0) || 0;
          const resolved = await resolveProductUnitPrice(productId, fallbackPrice);
          it.unit_price = resolved.unit_price;
          it.price_source = resolved.source;
          it.amount = (Number(resolved.unit_price || 0) || 0) * qty;
        }
        const bomSum = items.reduce((s: number, it: any) => s + (Number(it?.amount || 0) || 0), 0);
        if (bomSum > 0.5) {
          (svc as any).package_price = Number(svc.service_price || 0) || 0;
          svc.service_price = bomSum;
        }
      }
    } catch {
      // best-effort; don't block invoice
    }

    // Approved extra work — used for detailed bill breakdown (parts + labour).
    let approvedExtrasForBill: any[] = [];
    try {
      const { data: extraRowsAll } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .eq('lead_id', leadId);
      approvedExtrasForBill = (extraRowsAll || []).filter(isApprovedExtra);
    } catch {
      approvedExtrasForBill = [];
    }

    // If OS/CI/TI exists but looks stale (extra work rates/amounts are 0), rebuild line_items and totals on-the-fly.
    // This happens when OS is generated at QC time, but extra-job prices are updated later (CI/TI reflect latest).
    const osInvoices = list.filter((inv: any) => String(inv?.invoice_type || '').toUpperCase() === 'ORDER_SUMMARY');
    const ciInvoices = list.filter((inv: any) => String(inv?.invoice_type || '').toUpperCase() === 'CUSTOMER_INVOICE');
    const tiInvoices = list.filter((inv: any) => String(inv?.invoice_type || '').toUpperCase() === 'TAX_INVOICE');
    const osHydratedById = new Map<string, any>();
    const ciHydratedById = new Map<string, any>();
    const tiHydratedById = new Map<string, any>();

    // Extra work presence (used to decide if OS needs hydration to show "Additional work" lines)
    let approvedExtraCount = 0;
    try {
      const { data: extraRows } = await supabase
        .from('lead_extra_charges')
        .select('id, status, customer_approved, amount')
        .eq('lead_id', leadId);
      const isApprovedExtra = (row: any) => {
        const s = String(row?.status || '').trim().toUpperCase();
        const customerApproved = row?.customer_approved === true;
        return (
          customerApproved ||
          s === 'APPROVED' ||
          s === 'CUSTOMER_APPROVED' ||
          s === 'APPROVED_BY_CUSTOMER' ||
          s === 'ACCEPTED'
        );
      };
      approvedExtraCount = (extraRows || []).filter(isApprovedExtra).length;
    } catch {
      approvedExtraCount = 0;
    }

    // Add-on presence (used to decide if OS needs hydration to show Add-on lines)
    let expectedAddonCount = 0;
    try {
      expectedAddonCount = parseIdList((leadMeta as any)?.subservice_ids).length;
    } catch {
      expectedAddonCount = 0;
    }

    const osLooksStale = (inv: any) => {
      const li = Array.isArray(inv?.line_items) ? inv.line_items : [];
      if (li.length === 0) return true;
      const hasOsEdits = li.some((row: any) => row?.os_edited);
      if (hasOsEdits) return false;
      const serviceLi = li.filter((x: any) => {
        const c = String(x?.category || '').toUpperCase();
        return c === 'SERVICE' || c === 'ADDON';
      });
      const onlyService = li.filter((x: any) => String(x?.category || '').toUpperCase() === 'SERVICE');
      const missingServiceLines = onlyService.length === 0;
      const hasZeroService = serviceLi.some(
        (x: any) => Number(x?.amount || 0) <= 0 && Number(x?.rate || 0) <= 0
      );
      const extraLi = li.filter((x: any) => String(x?.category || '').toUpperCase() === 'EXTRA');
      const hasZeroExtra = extraLi.some((x: any) => Number(x?.amount || 0) <= 0 && Number(x?.rate || 0) <= 0);
      const missingExtraLines = approvedExtraCount > 0 && extraLi.length === 0;
      const addonLi = li.filter((x: any) => {
        const c = String(x?.category || '').toUpperCase();
        return c === 'ADDON' || c === 'ADD_ON' || c === 'ADD-ON';
      });
      const missingAddonLines = expectedAddonCount > 0 && addonLi.length === 0;
      const totalsZero = Number(inv?.final_amount || inv?.total_amount || 0) <= 0;
      return (
        missingServiceLines ||
        hasZeroService ||
        missingAddonLines ||
        missingExtraLines ||
        hasZeroExtra ||
        totalsZero
      );
    };

    const ciLooksStale = (inv: any) => osLooksStale(inv);
    const tiLooksStale = (inv: any) => osLooksStale(inv);

    if (osInvoices.some(osLooksStale) || ciInvoices.some(ciLooksStale) || tiInvoices.some(tiLooksStale)) {
      // Fetch lead + latest billable sources (best-effort)
      // Reuse leadMeta (schema-safe) if available.
      const leadFull: any = leadMeta || null;

      if (leadFull?.workshop_id) {
        // Load master mapping for fallback extra job pricing
        await ensureMasterMap(String(leadFull.workshop_id));

        // Workshop schema can also vary; try state_code, fall back gracefully.
        let workshop: any = null;
        try {
          const { data } = await supabase
            .from('workshops')
            .select('id, state, state_code')
            .eq('id', leadFull.workshop_id)
            .maybeSingle();
          workshop = data;
        } catch {
          // ignore
        }
        if (!workshop) {
          const { data } = await supabase
            .from('workshops')
            .select('id, state')
            .eq('id', leadFull.workshop_id)
            .maybeSingle();
          workshop = data;
        }

        const customerState = (leadFull as any).customer_state || (leadFull as any).state || '';
        const customerStateCode = (leadFull as any).customer_state_code || (leadFull as any).state_code || '';
        const workshopState = workshop?.state || '';
        const workshopStateCode = (workshop as any)?.state_code || '';
        const place = getPlaceOfSupply(customerState, customerStateCode, workshopState, workshopStateCode);

        const [{ data: pricingItems }, { data: extraChargesRaw }, { data: jobCard }] = await Promise.all([
          supabase
            .from('lead_pricing_items')
            .select('id, item_name, item_description, base_price, final_price, qty, is_addon, status')
            .eq('lead_id', leadId)
            .eq('status', 'ACTIVE'),
          supabase
            .from('lead_extra_charges')
            .select('*')
            .eq('lead_id', leadId),
          supabase
            .from('job_cards')
            .select('id, jobcard_number, job_card_parts(part_name, part_number, quantity, unit_price, total_price)')
            .eq('lead_id', leadId)
            .maybeSingle(),
        ]);

        // Base service lines:
        // Prefer workshop pricing (same logic used by public estimate), with vehicle class when available.
        const serviceLinesFromPricingItems = (pricingItems || []).map((it: any) => {
          const qty = getEffectiveQty(it, 1);
          const amount = getEffectivePricingItemAmount(it);
          return {
            description: it.name || it.item_name || 'Service',
            qty,
            rate: qty ? amount / qty : amount,
            amount,
            category: it.item_type || (it.is_addon ? 'ADDON' : 'SERVICE'),
          };
        });

        // Fallback: if lead_pricing_items empty, use workshop pricing tables by service_type_ids/subservice_ids
        let fallbackServiceLines: any[] = [];
        let workshopServiceLines: any[] = [];
        try {
          const serviceTypeIds = resolvedServiceTypeIds.length > 0
            ? resolvedServiceTypeIds
            : parseIdList((leadFull as any).service_type_ids).filter(isUuid);
          const addonIds = parseIdList((leadFull as any).subservice_ids);

          if (serviceTypeIds.length > 0) {
            // Resolve context for city/zone/class-aware service pricing (match supervisor "Service" tab behavior)
            const leadCityId = String((leadFull as any)?.city_id || '').trim() || null;
            const leadCityName = String((leadFull as any)?.city || '').trim() || null;

            let vehicleClass: string | null = null;
            try {
              const modelId = String((leadFull as any)?.model_id || '').trim();
              if (modelId) {
                const { data: cm } = await supabase.from('car_models').select('class').eq('id', modelId).maybeSingle();
                vehicleClass = (cm as any)?.class || null;
              } else if ((leadFull as any)?.vehicle_model) {
                const { data: cm } = await supabase
                  .from('car_models')
                  .select('class')
                  .ilike('model_name', String((leadFull as any).vehicle_model).trim())
                  .maybeSingle();
                vehicleClass = (cm as any)?.class || null;
              }
            } catch {
              // ignore (schema tolerance)
            }

            let workshopZoneId: string | null = null;
            try {
              const { data: w } = await supabase
                .from('workshops')
                .select('zone_id')
                .eq('id', String((leadFull as any).workshop_id))
                .maybeSingle();
              workshopZoneId = String((w as any)?.zone_id || '').trim() || null;
            } catch {
              // ignore
            }

            // Load service type names (base_price optional)
            let serviceTypes: any[] = [];
            const { data: serviceTypesData, error: stErr } = await supabase
              .from('service_types')
              .select('id, name, base_price')
              .in('id', serviceTypeIds);
            if (!stErr && serviceTypesData) {
              serviceTypes = serviceTypesData as any[];
            } else {
              const { data: stAlt } = await supabase
                .from('service_types')
                .select('id, name')
                .in('id', serviceTypeIds);
              serviceTypes = (stAlt || []) as any[];
            }

            // Build workshop-based prices (match public customer page behavior)
            for (const st of serviceTypes) {
              const id = String(st?.id || '').trim();
              if (!id) continue;
              let price = 0;
              try {
                price = await resolveWorkshopServicePrice({
                  supabase,
                  workshopId: String((leadFull as any).workshop_id),
                  serviceTypeId: id,
                  cityId: leadCityId,
                  cityName: leadCityName,
                  workshopZoneId,
                  vehicleClass,
                });
              } catch {
                price = 0;
              }
              const base = parseFloat(String((st as any).base_price || '0')) || 0;
              const amount = price > 0 ? price : base;
              workshopServiceLines.push({
                description: st?.name || 'Service',
                qty: 1,
                rate: amount,
                amount,
                category: 'SERVICE',
                service_type_id: id,
              });
            }
          }

          if (workshopServiceLines.length === 0) {
            const nameHints = String((leadFull as any)?.service_type || '')
              .split(/[,+/|&]| and /i)
              .map((s) => s.trim())
              .filter(Boolean);
            for (const hint of nameHints) {
              const { data: byName } = await supabase
                .from('service_types')
                .select('id, name, base_price')
                .ilike('name', `%${hint.replace(/[%_]/g, ' ')}%`)
                .limit(5);
              for (const st of byName || []) {
                const id = String(st?.id || '').trim();
                if (!id) continue;
                let price = 0;
                try {
                  price = await resolveWorkshopServicePrice({
                    supabase,
                    workshopId: String((leadFull as any).workshop_id),
                    serviceTypeId: id,
                    cityId: String((leadFull as any)?.city_id || '').trim() || null,
                    cityName: String((leadFull as any)?.city || '').trim() || null,
                    workshopZoneId: null,
                    vehicleClass: null,
                  });
                } catch {
                  price = 0;
                }
                const base = parseFloat(String((st as any).base_price || '0')) || 0;
                workshopServiceLines.push({
                  description: st?.name || nameHints[0] || 'Service',
                  qty: 1,
                  rate: price > 0 ? price : base,
                  amount: price > 0 ? price : base,
                  category: 'SERVICE',
                  service_type_id: id,
                });
              }
            }
          }

            if (addonIds.length > 0) {
              const { data: addons } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', addonIds);

              const { data: wap } = await supabase
                .from('workshop_service_addons_pricing')
                .select('service_addon_id, custom_price')
                .eq('workshop_id', leadFull.workshop_id)
                .in('service_addon_id', addonIds)
                .eq('is_active', true);

              const priceByAddon: Record<string, number> = {};
              for (const row of wap || []) {
                const id = String((row as any).service_addon_id || '');
                const p = parseFloat(String((row as any).custom_price || '0')) || 0;
                if (id) priceByAddon[id] = p;
              }

              for (const a of addons || []) {
                const id = String((a as any).id || '');
                const base = parseFloat(String((a as any).price || '0')) || 0;
                const custom = priceByAddon[id] || 0;
                const amount = custom > 0 ? custom : base;
                fallbackServiceLines.push({
                  description: (a as any).name || 'Addon',
                  qty: 1,
                  rate: amount,
                  amount,
                  category: 'ADDON',
                });
              }
            }
        } catch {
          // ignore fallback errors
        }

        // Prefer workshop-based service lines when available (matches public estimate).
        const effectiveServiceLines =
          (workshopServiceLines?.length || 0) > 0
            ? [...workshopServiceLines, ...fallbackServiceLines.filter((x: any) => String(x?.category || '').toUpperCase() !== 'SERVICE')]
            : (serviceLinesFromPricingItems?.length || 0) > 0
              ? serviceLinesFromPricingItems
              : fallbackServiceLines;
        const partLines = (jobCard?.job_card_parts || []).map((p: any) => ({
          description: `${p.part_name || 'Part'}${p.part_number ? ` (${p.part_number})` : ''}`,
          qty: p.quantity || 1,
          rate: Number(p.unit_price || 0) || 0,
          amount: Number(p.total_price || 0) || 0,
          category: 'PART',
        }));

        const extraCharges = (Array.isArray(extraChargesRaw) ? extraChargesRaw : []).filter(isApprovedExtra);
        const extraLines = (extraCharges || []).map((c: any) => {
          const amt = computeExtraAmount(c, String(leadFull.workshop_id));
          return {
            description: c.description || c.reason || 'Additional work',
            qty: 1,
            rate: amt,
            amount: amt,
            category: 'EXTRA',
            extra_charge_id: c.id,
            included_items: buildExtraIncludedItems(c),
          };
        });

        const baseAmount = effectiveServiceLines.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
        const partsCost = partLines.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
        const extraChargesAmount = extraLines.reduce((sum: number, l: any) => sum + (Number(l.amount) || 0), 0);
        const subTotal = Math.max(0, baseAmount + partsCost + extraChargesAmount);
        const leadDiscount = parseFloat(String((leadFull as any).discount_amount || '0')) || 0;

        const extractIncludedOverrideMaps = (inv: any) => {
          const byTypeId = new Map<string, { included: any[]; amount?: number; rate?: number }>();
          const byNameKey = new Map<string, { included: any[]; amount?: number; rate?: number }>();
          const li = Array.isArray(inv?.line_items) ? inv.line_items : [];
          for (const row of li) {
            const cat = String(row?.category || '').toUpperCase();
            if (cat !== 'SERVICE') continue;
            const includedOverrides = Array.isArray(row?.included_items) ? row.included_items : [];
            if (!includedOverrides.length) continue;
            const serviceTypeId = String(row?.service_type_id || '').trim();
            const keyName = normalizeName(String(row?.description || ''));
            const amount = row?.amount != null ? Number(row.amount) : undefined;
            const rate = row?.rate != null ? Number(row.rate) : undefined;
            const payload = { included: includedOverrides, amount, rate };
            if (serviceTypeId) byTypeId.set(serviceTypeId, payload);
            if (keyName) byNameKey.set(keyName, payload);
          }
          return { byTypeId, byNameKey };
        };

        const applyIncludedOverridesToHydratedLines = (inv: any, lines: any[]) => {
          const { byTypeId, byNameKey } = extractIncludedOverrideMaps(inv);
          if (byTypeId.size === 0 && byNameKey.size === 0) return lines;
          return (lines || []).map((row: any) => {
            const cat = String(row?.category || '').toUpperCase();
            if (cat !== 'SERVICE') return row;
            const sid = String(row?.service_type_id || '').trim();
            const keyName = normalizeName(String(row?.description || ''));
            const o = (sid && byTypeId.get(sid)) || (keyName && byNameKey.get(keyName)) || null;
            if (!o) return row;
            // Preserve any manual service amount/rate from the invoice (used by "Edit rates" delta logic),
            // while still hydrating missing addon/extra lines.
            const next: any = { ...row, included_items: o.included };
            if (Number.isFinite(o.amount as any) && Number(o.amount) > 0) next.amount = Number(o.amount);
            if (Number.isFinite(o.rate as any) && Number(o.rate) > 0) next.rate = Number(o.rate);
            return next;
          });
        };

        const calcTotalsFromLineItems = (lineItems: any[]) => {
          const li = Array.isArray(lineItems) ? lineItems : [];
          const norm = (c: any) => String(c || '').trim().toUpperCase();
          const sumCat = (cats: string[]) =>
            li
              .filter((x: any) => cats.includes(norm(x?.category)))
              .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
          const base_amount = sumCat(['SERVICE', 'ADDON', 'ADD_ON', 'ADD-ON', 'LABOUR', 'LABOR']);
          const parts_cost = sumCat(['PART', 'PARTS']);
          const extra_charges = sumCat(['EXTRA']);
          const sub_total = Math.max(0, base_amount + parts_cost + extra_charges);
          return { base_amount, parts_cost, extra_charges, sub_total };
        };

        const hydrateOS = (inv: any) => {
          const discountAmount = parseFloat(String((inv as any).discount_amount ?? leadDiscount ?? 0)) || 0;
          const finalLineItems = [
            ...applyIncludedOverridesToHydratedLines(inv, effectiveServiceLines),
            ...partLines,
            ...extraLines,
          ];
          const totals = calcTotalsFromLineItems(finalLineItems);
          const finalAmount = Math.max(0, totals.sub_total - discountAmount);
          osHydratedById.set(inv.id, {
            ...inv,
            base_amount: totals.base_amount,
            parts_cost: totals.parts_cost,
            extra_charges: totals.extra_charges,
            extra_charges_amount: totals.extra_charges,
            sub_total: totals.sub_total,
            discount_amount: discountAmount,
            final_amount: finalAmount,
            total_amount: finalAmount,
            show_gst_breakup: false,
            line_items: finalLineItems,
          });
        };

        const hydrateCIorTI = (inv: any, type: 'CUSTOMER_INVOICE' | 'TAX_INVOICE') => {
          const discountAmount = parseFloat(String((inv as any).discount_amount ?? leadDiscount ?? 0)) || 0;
          const finalLineItems = [
            ...applyIncludedOverridesToHydratedLines(inv, effectiveServiceLines),
            ...partLines,
            ...extraLines,
          ];
          const totals = calcTotalsFromLineItems(finalLineItems);
          const netTaxable = Math.max(0, totals.sub_total - discountAmount);
          const taxes = calculateTaxes(netTaxable, place.useIGST);
          const preRoundTotal = netTaxable + taxes.totalTax;
          const roundedTotal = roundOff(preRoundTotal);
          const roundOffAmount = parseFloat((roundedTotal - preRoundTotal).toFixed(2));
          const finalAmount = roundedTotal;
          const amountInWords = numberToWords(finalAmount);
          const payload = {
            ...inv,
            base_amount: totals.base_amount,
            parts_cost: totals.parts_cost,
            extra_charges: totals.extra_charges,
            extra_charges_amount: totals.extra_charges,
            sub_total: totals.sub_total,
            discount_amount: discountAmount,
            cgst_percentage: place.useIGST ? 0 : 9,
            cgst_amount: taxes.cgstAmount,
            sgst_percentage: place.useIGST ? 0 : 9,
            sgst_amount: taxes.sgstAmount,
            igst_percentage: place.useIGST ? 18 : 0,
            igst_amount: taxes.igstAmount,
            total_tax: taxes.totalTax,
            round_off_amount: roundOffAmount,
            final_amount: finalAmount,
            total_amount: finalAmount,
            amount_in_words: amountInWords,
            place_of_supply: place.placeOfSupply,
            place_of_supply_state_code: place.stateCode,
            show_gst_breakup: type === 'TAX_INVOICE',
            line_items: finalLineItems,
          };
          if (type === 'CUSTOMER_INVOICE') ciHydratedById.set(inv.id, payload);
          else tiHydratedById.set(inv.id, payload);
        };

        for (const os of osInvoices) {
          if (osLooksStale(os)) hydrateOS(os);
        }
        for (const ci of ciInvoices) {
          if (ciLooksStale(ci)) hydrateCIorTI(ci, 'CUSTOMER_INVOICE');
        }
        for (const ti of tiInvoices) {
          if (tiLooksStale(ti)) hydrateCIorTI(ti, 'TAX_INVOICE');
        }
      }
    }

    const mapInvoice = (inv: any) => {
      if (!inv) return null;
      const hydrated = osHydratedById.get(inv.id) || ciHydratedById.get(inv.id) || tiHydratedById.get(inv.id);
      const src = hydrated || inv;
      let lineItemsForTotals = Array.isArray((src as any).line_items) ? (src as any).line_items : [];
      const isOS = String((src as any)?.invoice_type || '').toUpperCase() === 'ORDER_SUMMARY';
      const priceByTypeId = new Map<string, number>();
      const priceByName = new Map<string, number>();
      for (const svc of included_service_items || []) {
        const sid = String((svc as any)?.service_type_id || '').trim();
        const sname = normalizeName(String((svc as any)?.service_name || ''));
        const sp = Number((svc as any)?.service_price || 0) || 0;
        if (sid && sp > 0) priceByTypeId.set(sid, sp);
        if (sname && sp > 0) priceByName.set(sname, sp);
      }
      // Attach package BOM + transparent pricing: SERVICE amount = sum(included workshop parts).
      const includedSum = (items: any[]) =>
        (items || []).reduce((s: number, p: any) => {
          const qty = Number(p?.quantity || p?.qty || 1) || 1;
          const amt = Number(p?.amount);
          if (Number.isFinite(amt) && amt >= 0) return s + amt;
          return s + (Number(p?.unit_price || p?.rate || 0) || 0) * qty;
        }, 0);

      lineItemsForTotals = lineItemsForTotals.map((row: any) => {
        const cat = String(row?.category || '').toUpperCase();
        if (cat !== 'SERVICE') return row;
        if (row?.os_edited) return row;

        const sid = String(row?.service_type_id || '').trim();
        const keyName = normalizeName(String(row?.description || ''));
        let included = Array.isArray(row?.included_items) ? row.included_items : [];
        if (!included.length) {
          const match = (included_service_items || []).find((svc: any) => {
            const svcId = String(svc?.service_type_id || '').trim();
            const svcName = normalizeName(String(svc?.service_name || ''));
            if (sid && svcId && sid === svcId) return true;
            return Boolean(keyName && svcName && keyName === svcName);
          });
          included = Array.isArray(match?.items) ? match.items : [];
        }

        const sum = includedSum(included);
        const qty = Number(row?.qty || 1) || 1;
        if (sum > 0.5) {
          return {
            ...row,
            included_items: included,
            amount: sum,
            rate: sum / qty,
            pricing_mode: 'TRANSPARENT_INCLUDED_SUM',
          };
        }

        // Fallback: package workshop service price when BOM empty/zero.
        const amount = Number(row?.amount || 0) || 0;
        if (amount > 0) return { ...row, included_items: included.length ? included : row.included_items };
        const price = (sid && priceByTypeId.get(sid)) || priceByName.get(keyName) || 0;
        if (!price) return { ...row, included_items: included.length ? included : row.included_items };
        return {
          ...row,
          included_items: included.length ? included : row.included_items,
          amount: price,
          rate: price / qty,
        };
      });

      // Keep injected/missing services consistent with transparent BOM pricing.
      const existingServiceKeys = new Set(
        lineItemsForTotals
          .filter((row: any) => String(row?.category || '').toUpperCase() === 'SERVICE')
          .flatMap((row: any) => {
            const sid = String(row?.service_type_id || '').trim();
            const sname = normalizeName(String(row?.description || ''));
            return [sid, sname].filter(Boolean);
          }),
      );
      const missingIncluded = (included_service_items || []).filter((svc: any) => {
        const sid = String(svc?.service_type_id || '').trim();
        const sname = normalizeName(String(svc?.service_name || ''));
        if (!sid && !sname) return false;
        if (sid && existingServiceKeys.has(sid)) return false;
        if (sname && existingServiceKeys.has(sname)) return false;
        return true;
      });
      if (missingIncluded.length > 0) {
        const injected = missingIncluded
          .map((svc: any) => {
            const name = String(svc?.service_name || '').trim();
            const items = Array.isArray(svc?.items) ? svc.items : [];
            const bomSum = includedSum(items);
            const packagePrice = Number(svc?.service_price || 0) || 0;
            const amount = bomSum > 0.5 ? bomSum : packagePrice;
            if (!name && amount <= 0) return null;
            return {
              description: name || 'Service',
              qty: 1,
              rate: amount,
              amount,
              category: 'SERVICE',
              service_type_id: String(svc?.service_type_id || ''),
              included_items: items,
              pricing_mode: bomSum > 0.5 ? 'TRANSPARENT_INCLUDED_SUM' : 'PACKAGE_PRICE',
            };
          })
          .filter(Boolean);
        lineItemsForTotals = [...injected, ...lineItemsForTotals];
      }

      // Keep service packages; only drop clear oil conflicts (Fully vs Semi).
      const leadServiceName = String((leadMeta as any)?.service_type || '').trim();
      const leadOil = oilTypeToken(leadServiceName);
      const preferredOil =
        leadOil ||
        (() => {
          // Prefer Semi when lead only says "General Service".
          const hasSemiIncluded = (included_service_items || []).some(
            (svc: any) => oilTypeToken(String(svc?.service_name || '')) === 'semi',
          );
          return hasSemiIncluded ? ('semi' as const) : null;
        })();

      lineItemsForTotals = lineItemsForTotals.filter((row: any) => {
        const cat = String(row?.category || '').toUpperCase();
        if (cat !== 'SERVICE') return true;
        const desc = String(row?.description || '');
        if (preferredOil) {
          const rowOil = oilTypeToken(desc);
          if (rowOil && rowOil !== preferredOil) return false;
        } else if (leadOil && !serviceNamesCompatible(leadServiceName, desc)) {
          return false;
        }
        return true;
      });

      // If Fully + Semi both remain, keep Semi (or the priced one).
      {
        const serviceRows = lineItemsForTotals.filter(
          (row: any) => String(row?.category || '').toUpperCase() === 'SERVICE',
        );
        const hasSemi = serviceRows.some((row: any) => oilTypeToken(String(row?.description || '')) === 'semi');
        const hasFully = serviceRows.some((row: any) => oilTypeToken(String(row?.description || '')) === 'fully');
        if (hasSemi && hasFully) {
          lineItemsForTotals = lineItemsForTotals.filter((row: any) => {
            const cat = String(row?.category || '').toUpperCase();
            if (cat !== 'SERVICE') return true;
            return oilTypeToken(String(row?.description || '')) !== 'fully';
          });
        }
      }

      // Attach detailed parts/labour breakdown on Additional Work lines.
      const extrasByName = new Map<string, any>();
      for (const ex of approvedExtrasForBill) {
        const key = normalizeName(String(ex?.description || ex?.reason || ''));
        if (key) extrasByName.set(key, ex);
      }
      lineItemsForTotals = lineItemsForTotals.map((row: any) => {
        const cat = String(row?.category || '').toUpperCase();
        if (cat !== 'EXTRA') return row;
        const key = normalizeName(String(row?.description || ''));
        const ex = extrasByName.get(key);
        const withId = ex?.id ? { ...row, extra_charge_id: row?.extra_charge_id || ex.id } : row;
        if (Array.isArray(withId?.included_items) && withId.included_items.length > 0) {
          // Prefer saved parts_breakdown when present.
          if (ex && Array.isArray(ex.parts_breakdown) && ex.parts_breakdown.length > 0) {
            return { ...withId, included_items: buildExtraIncludedItems(ex) };
          }
          return withId;
        }
        if (!ex) return withId;
        return { ...withId, included_items: buildExtraIncludedItems(ex) };
      });

      const norm = (c: any) => String(c || '').trim().toUpperCase();
      const sumCat = (cats: string[]) =>
        lineItemsForTotals
          .filter((x: any) => cats.includes(norm(x?.category)))
          .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
      const base_amount = sumCat(['SERVICE', 'ADDON', 'ADD_ON', 'ADD-ON', 'LABOUR', 'LABOR']);
      const parts_cost = sumCat(['PART', 'PARTS']);
      const extra_charges = sumCat(['EXTRA']);
      const sub_total = Math.max(0, base_amount + parts_cost + extra_charges);
      const discount_amount = (src as any).discount_amount || (src as any).discount || 0;
      const final_amount = Math.max(0, sub_total - (Number(discount_amount || 0) || 0));

      return {
        ...src,
        parts_amount: (src as any).parts_cost || 0,
        extra_charges_amount: (src as any).extra_charges || 0,
        subtotal: isOS ? sub_total : (src as any).sub_total || sub_total,
        sub_total: isOS ? sub_total : (src as any).sub_total || sub_total,
        cgst: (src as any).cgst_amount || 0,
        cgst_amount: (src as any).cgst_amount || 0,
        sgst: (src as any).sgst_amount || 0,
        sgst_amount: (src as any).sgst_amount || 0,
        igst: (src as any).igst_amount || 0,
        igst_amount: (src as any).igst_amount || 0,
        total_tax: (src as any).total_tax || 0,
        round_off_amount: (src as any).round_off_amount || 0,
        discount_amount: (src as any).discount_amount || (src as any).discount || 0,
        total_amount: isOS ? final_amount : (src as any).final_amount || (src as any).total_amount || final_amount,
        final_amount: isOS ? final_amount : (src as any).total_amount || (src as any).final_amount || final_amount,
        amount_in_words: (src as any).amount_in_words,
        invoice_date: (src as any).invoice_date || (src as any).created_at || new Date().toISOString(),
        due_date: (src as any).due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payment_status: (src as any).payment_status || 'PENDING',
        payment_mode: (src as any).payment_mode,
        payment_txn_id: (src as any).payment_txn_id,
        payment_remarks: (src as any).payment_remarks,
        line_items: lineItemsForTotals,
      };
    };

    if (!invoice) {
      return NextResponse.json({ invoice: null, invoices: [] });
    }

    // Fetch creator name if generated_by exists
    if (invoice.generated_by) {
      const { data: creator } = await supabase
        .from('users_login')
        .select('full_name')
        .eq('id', invoice.generated_by)
        .single();
      
      if (creator) {
        invoice.creator = { full_name: creator.full_name };
      }
    }

    const workshopIdForMaster = String((leadMeta as any)?.workshop_id || '').trim();
    if (workshopIdForMaster) {
      await ensureMasterMap(workshopIdForMaster);
    }

    const mappedInvoice = mapInvoice(invoice);
    const mappedInvoices = list.map(mapInvoice).filter(Boolean);

    // Persist transparent SERVICE amounts onto ORDER_SUMMARY so finalize/PDF match the bill UI.
    try {
      for (const mapped of mappedInvoices) {
        if (!mapped) continue;
        if (String((mapped as any)?.invoice_type || '').toUpperCase() !== 'ORDER_SUMMARY') continue;
        const nextLi = Array.isArray((mapped as any).line_items) ? (mapped as any).line_items : [];
        const hasEdited = nextLi.some((row: any) => row?.os_edited);
        if (hasEdited) continue;
        const touched = nextLi.some(
          (row: any) =>
            String(row?.category || '').toUpperCase() === 'SERVICE' &&
            String(row?.pricing_mode || '') === 'TRANSPARENT_INCLUDED_SUM',
        );
        if (!touched) continue;
        const prev = list.find((x: any) => String(x?.id) === String((mapped as any).id));
        const prevLi = Array.isArray((prev as any)?.line_items) ? (prev as any).line_items : [];
        const prevAmt = prevLi
          .filter((x: any) => String(x?.category || '').toUpperCase() === 'SERVICE')
          .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
        const nextAmt = nextLi
          .filter((x: any) => String(x?.category || '').toUpperCase() === 'SERVICE')
          .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
        if (Math.abs(prevAmt - nextAmt) <= 0.5) continue;
        const normCat = (c: any) => String(c || '').trim().toUpperCase();
        const sumCats = (cats: string[]) =>
          nextLi
            .filter((x: any) => cats.includes(normCat(x?.category)))
            .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);
        const base_amount = sumCats(['SERVICE', 'ADDON', 'ADD_ON', 'ADD-ON', 'LABOUR', 'LABOR']);
        const parts_cost = sumCats(['PART', 'PARTS']);
        const extra_charges = sumCats(['EXTRA']);
        await supabase
          .from('invoices')
          .update({
            line_items: nextLi,
            base_amount,
            parts_cost,
            extra_charges,
            sub_total: (mapped as any).sub_total,
            final_amount: (mapped as any).final_amount,
            updated_at: new Date().toISOString(),
          })
          .eq('id', (mapped as any).id);
      }
    } catch {
      // best-effort persist; display already corrected
    }

    // Preserve any creator field we attached above on the selected invoice
    if ((invoice as any).creator && mappedInvoice) {
      (mappedInvoice as any).creator = (invoice as any).creator;
    }

    // Apply any per-invoice overrides for included items (stored on service line_items)
    try {
      const normalizeName = (s: string) =>
        String(s || '')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const svcOverrideByTypeId = new Map<string, Map<string, { unit_price: number; quantity?: number; amount?: number }>>();
      const svcOverrideByName = new Map<string, Map<string, { unit_price: number; quantity?: number; amount?: number }>>();
      const li = Array.isArray((mappedInvoice as any)?.line_items) ? (mappedInvoice as any).line_items : [];
      for (const row of li) {
        const cat = String(row?.category || '').toUpperCase();
        if (cat !== 'SERVICE') continue;
        const serviceTypeId = String(row?.service_type_id || '').trim();
        const keyName = normalizeName(String(row?.description || ''));
        const includedOverrides = Array.isArray(row?.included_items) ? row.included_items : [];
        if (!includedOverrides.length) continue;
        const m = new Map<string, { unit_price: number; quantity?: number; amount?: number }>();
        for (const o of includedOverrides) {
          const pid = String(o?.product_id || '').trim();
          const p = Number(o?.unit_price || 0) || 0;
          const q = Number(o?.quantity);
          const a = Number(o?.amount);
          if (pid && p >= 0) {
            m.set(pid, {
              unit_price: p,
              quantity: Number.isFinite(q) ? q : undefined,
              amount: Number.isFinite(a) ? a : undefined,
            });
          }
        }
        if (m.size === 0) continue;
        if (serviceTypeId) svcOverrideByTypeId.set(serviceTypeId, m);
        if (keyName) svcOverrideByName.set(keyName, m);
      }

      for (const svc of included_service_items) {
        const sid = String((svc as any)?.service_type_id || '').trim();
        const snameKey = normalizeName(String((svc as any)?.service_name || ''));
        const overrideMap =
          (sid && svcOverrideByTypeId.get(sid)) || (snameKey && svcOverrideByName.get(snameKey)) || null;
        if (!overrideMap) continue;
        for (const it of (svc as any).items || []) {
          const pid = String(it?.product_id || '').trim();
          if (!pid) continue;
          if (!overrideMap.has(pid)) continue;
          const override = overrideMap.get(pid) as { unit_price: number; quantity?: number; amount?: number };
          it.unit_price = override.unit_price;
          it.price_source = 'invoice_override';
          if (override.quantity != null && Number.isFinite(override.quantity)) {
            it.quantity = override.quantity;
          }
          const qty = Number(it?.quantity || 1) || 1;
          if (override.amount != null && Number.isFinite(override.amount)) {
            it.amount = override.amount;
          } else {
            it.amount = (Number(it.unit_price || 0) || 0) * qty;
          }
        }
        const bomSum = ((svc as any).items || []).reduce(
          (s: number, it: any) => s + (Number(it?.amount || 0) || 0),
          0,
        );
        if (bomSum > 0.5) {
          if ((svc as any).package_price == null) {
            (svc as any).package_price = Number(svc.service_price || 0) || 0;
          }
          svc.service_price = bomSum;
        }
      }
    } catch {
      // ignore override application
    }

    return NextResponse.json(
      { invoice: mappedInvoice, invoices: mappedInvoices, included_service_items },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

