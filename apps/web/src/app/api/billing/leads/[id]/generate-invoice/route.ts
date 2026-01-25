import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import {
  generateInvoiceNumber,
  getHSNCode,
  getPlaceOfSupply,
  numberToWords,
  roundOff,
} from '@/lib/utils/invoiceUtils';
import { getEffectivePricingItemAmount, getEffectiveQty } from '@/lib/utils/pricing';
import { resolveWorkshopServicePrice } from '@/lib/utils/workshopServicePricing';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { createNotification, notifyTelecallerTeamlead, notifyWorkshopRoles } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Optional service-role client for write operations when RLS blocks (best-effort).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile with role join (users_login is mapped by email/phone; not always same as auth user.id)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, role_id, workshop_id, roles!inner(role_code, role_name)';

    const { data: userProfileByEmail, error: profileErrorByEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null, error: null };

    const { data: userProfileByPhone, error: profileErrorByPhone } = !userProfileByEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null, error: null };

    // Legacy fallback if some environments map users_login.id == auth user.id
    const { data: userProfileById, error: profileErrorById } = !userProfileByEmail && !userProfileByPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null, error: null };

    const userProfile = userProfileByEmail || userProfileByPhone || userProfileById;

    if (!userProfile) {
      return NextResponse.json(
        {
          error: 'User profile not found',
          hint: 'No matching users_login row for this session user (email/phone/id)',
          user_email: email || null,
          user_phone: phone || null,
          profile_lookup_errors: [profileErrorByEmail?.message, profileErrorByPhone?.message, profileErrorById?.message].filter(Boolean),
        },
        { status: 404 }
      );
    }

    // Get role code
    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify user has billing permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];

    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    const canOverrideCoupon = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode);

    const leadId = params.id;
    
    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    // Optional billing finalization payload (UI can send checklist + overrides)
    let billingPayload: any = {};
    try {
      billingPayload = await request.json();
    } catch {
      billingPayload = {};
    }

    const billingChecklist: Record<string, boolean> | undefined = billingPayload?.billing_checklist;
    if (billingChecklist) {
      const incomplete = Object.entries(billingChecklist)
        .filter(([, v]) => v !== true)
        .map(([k]) => k);
      if (incomplete.length > 0) {
        return NextResponse.json(
          {
            error: 'Billing finalization checklist is incomplete',
            missing_checks: incomplete,
            hint: 'Complete all billing verification checks before generating invoice',
          },
          { status: 400 }
        );
      }
    }

    console.log('[Generate Invoice API] Fetching lead:', leadId);

    // Get lead details first (without join to avoid RLS issues)
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadError) {
      console.error('[Generate Invoice API] Lead fetch error:', {
        error: leadError,
        code: leadError.code,
        message: leadError.message,
        details: leadError.details,
        hint: leadError.hint,
        leadId
      });
      return NextResponse.json({ 
        error: 'Failed to fetch lead', 
        details: leadError.message,
        code: leadError.code,
        leadId 
      }, { status: 500 });
    }

    if (!lead) {
      console.error('[Generate Invoice API] Lead not found:', leadId);
      return NextResponse.json({ 
        error: 'Lead not found', 
        leadId 
      }, { status: 404 });
    }

    // Prevent edits after archival/closure
    if (lead.read_only) {
      return NextResponse.json({
        error: 'Lead is archived/read-only',
        hint: 'This lead is closed and cannot generate/regenerate invoices'
      }, { status: 400 });
    }

    // Fetch workshop details separately if workshop_id exists
    let workshop: any = null;
    if (lead.workshop_id) {
      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('id, name, address, city, state, state_code, zone_id, phone, email, gst_number, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch')
        .eq('id', lead.workshop_id)
        .maybeSingle();
      
      if (workshopError) {
        console.error('[Generate Invoice API] Workshop fetch error:', workshopError);
        // Don't fail the request if workshop fetch fails, just log it
      } else {
        workshop = workshopData;
      }
    }

    // Verify lead is ready for billing - allow READY_FOR_DELIVERY for advisor
    const validStatuses = ['WORK_COMPLETED', 'QC_APPROVED', 'READY_FOR_BILLING', 'AUDIT_APPROVED', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    if (!validStatuses.includes(lead.status)) {
      return NextResponse.json({ 
        error: 'Lead not ready for billing',
        current_status: lead.status,
        hint: 'Lead must be QC approved, audit approved, or ready for delivery'
      }, { status: 400 });
    }

    // Verify user belongs to the same workshop (for workshop staff)
    if (['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'].includes(roleCode)) {
      if (!userProfile.workshop_id || userProfile.workshop_id !== lead.workshop_id) {
        return NextResponse.json({ error: 'Forbidden: Lead not in your workshop' }, { status: 403 });
      }
    }

    // Check if invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('lead_id', leadId)
      .maybeSingle();

    // Check if regeneration is requested (via query param or header)
    const requestUrl = new URL(request.url);
    const regenerate = requestUrl.searchParams.get('regenerate') === 'true' || 
                       request.headers.get('x-regenerate') === 'true';

    if (existingInvoice && !regenerate) {
      return NextResponse.json({ 
        error: 'Invoice already exists for this lead. Use regenerate=true to regenerate.',
        invoice: existingInvoice
      }, { status: 400 });
    }

    // If regenerating, delete the old invoice first
    if (existingInvoice && regenerate) {
      console.log('[Generate Invoice API] Regenerating invoice, deleting old invoice:', existingInvoice.id);
      
      // Delete related records first (if any)
      await supabase
        .from('payment_transactions')
        .delete()
        .eq('invoice_id', existingInvoice.id);
      
      await supabase
        .from('invoice_reviews')
        .delete()
        .eq('invoice_id', existingInvoice.id);
      
      await supabase
        .from('invoice_sharing_logs')
        .delete()
        .eq('invoice_id', existingInvoice.id);
      
      // Delete the invoice
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', existingInvoice.id);
      
      if (deleteError) {
        console.error('[Generate Invoice API] Error deleting old invoice:', deleteError);
        return NextResponse.json({ 
          error: 'Failed to delete existing invoice',
          details: deleteError.message
        }, { status: 500 });
      }
      
      // Also clear invoice_id from service_leads
      await supabase
        .from('service_leads')
        .update({ invoice_id: null })
        .eq('id', leadId);
    }

    // Fetch pricing items from lead_pricing_items table
    const { data: pricingItems } = await supabase
      .from('lead_pricing_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE');

    // If no pricing items, resolve prices from workshop_service_pricing (city/zone/class-aware)
    let workshopPricingTotal = 0;
    if ((!pricingItems || pricingItems.length === 0) && lead.workshop_id && lead.service_type_ids) {
      try {
        // Parse service_type_ids (can be JSON string or array)
        let serviceTypeIds: string[] = [];
        if (typeof lead.service_type_ids === 'string') {
          try {
            serviceTypeIds = JSON.parse(lead.service_type_ids);
          } catch {
            // If not JSON, try as comma-separated string
            serviceTypeIds = lead.service_type_ids.split(',').map((id: string) => id.trim());
          }
        } else if (Array.isArray(lead.service_type_ids)) {
          serviceTypeIds = lead.service_type_ids;
        }

        if (serviceTypeIds.length > 0) {
          console.log('[Generate Invoice API] Resolving workshop pricing for service types:', serviceTypeIds);

          // Resolve context: city/zone/class
          const leadCityId = String((lead as any)?.city_id || '').trim() || null;
          const leadCityName = String((lead as any)?.city || '').trim() || null;

          let vehicleClass: string | null = null;
          try {
            const modelId = String((lead as any)?.model_id || '').trim();
            if (modelId) {
              const { data: cm } = await supabase.from('car_models').select('class').eq('id', modelId).maybeSingle();
              vehicleClass = (cm as any)?.class || null;
            } else if ((lead as any)?.vehicle_model) {
              const { data: cm } = await supabase
                .from('car_models')
                .select('class')
                .eq('model_name', (lead as any).vehicle_model)
                .maybeSingle();
              vehicleClass = (cm as any)?.class || null;
            }
          } catch {
            // ignore (schema tolerance)
          }

          const workshopZoneId = String((workshop as any)?.zone_id || '').trim() || null;

          // Fetch service_types for base_price fallback (schema-tolerant)
          let serviceTypes: any[] = [];
          const { data: st1, error: stErr } = await supabase
            .from('service_types')
            .select('id, base_price, name')
            .in('id', serviceTypeIds);
          if (!stErr && st1) serviceTypes = st1 as any[];
          else {
            const { data: st2 } = await supabase.from('service_types').select('id, name').in('id', serviceTypeIds);
            serviceTypes = (st2 || []) as any[];
          }
          const baseById = new Map<string, number>();
          for (const st of serviceTypes || []) {
            const id = String((st as any)?.id || '').trim();
            const base = parseFloat(String((st as any)?.base_price || '0')) || 0;
            if (id) baseById.set(id, base);
          }

          let total = 0;
          for (const id of serviceTypeIds) {
            const sid = String(id || '').trim();
            if (!sid) continue;
            let price = 0;
            try {
              price = await resolveWorkshopServicePrice({
                supabase,
                workshopId: String(lead.workshop_id),
                serviceTypeId: sid,
                cityId: leadCityId,
                cityName: leadCityName,
                workshopZoneId,
                vehicleClass,
              });
            } catch {
              price = 0;
            }
            const base = baseById.get(sid) || 0;
            total += (price > 0 ? price : base);
          }

          workshopPricingTotal = total;
          console.log('[Generate Invoice API] Resolved workshop pricing total:', {
            total: workshopPricingTotal,
            leadCityId,
            leadCityName,
            workshopZoneId,
            vehicleClass,
          });
        }

        // Also fetch pricing for subservices/addons if they exist
        if (lead.subservice_ids) {
          let subserviceIds: string[] = [];
          if (typeof lead.subservice_ids === 'string') {
            try {
              subserviceIds = JSON.parse(lead.subservice_ids);
            } catch {
              subserviceIds = lead.subservice_ids.split(',').map((id: string) => id.trim());
            }
          } else if (Array.isArray(lead.subservice_ids)) {
            subserviceIds = lead.subservice_ids;
          }

          if (subserviceIds.length > 0) {
            console.log('[Generate Invoice API] Fetching workshop addon pricing for:', subserviceIds);
            
            const { data: addonPricing, error: addonError } = await supabase
              .from('workshop_service_addons_pricing')
              .select(`
                *,
                addon:service_addons(id, name, price)
              `)
              .eq('workshop_id', lead.workshop_id)
              .in('service_addon_id', subserviceIds)
              .eq('is_active', true);

            if (addonError) {
              console.error('[Generate Invoice API] Error fetching addon pricing:', addonError);
            } else if (addonPricing && addonPricing.length > 0) {
              const addonTotal = addonPricing.reduce((sum, item) => 
                sum + parseFloat(item.custom_price || '0'), 0);
              workshopPricingTotal += addonTotal;
              console.log('[Generate Invoice API] Found addon pricing:', {
                count: addonPricing.length,
                total: addonTotal,
                items: addonPricing.map(p => ({
                  addon_id: p.service_addon_id,
                  custom_price: p.custom_price,
                  default_price: p.addon?.price,
                  addon_name: p.addon?.name
                }))
              });
            } else {
              // Fallback to default addon prices if workshop pricing doesn't exist
              const { data: defaultAddons } = await supabase
                .from('service_addons')
                .select('id, name, price')
                .in('id', subserviceIds)
                .eq('is_active', true);

              if (defaultAddons && defaultAddons.length > 0) {
                const defaultAddonTotal = defaultAddons.reduce((sum, addon) => 
                  sum + parseFloat(addon.price || '0'), 0);
                workshopPricingTotal += defaultAddonTotal;
                console.log('[Generate Invoice API] Using default addon prices:', {
                  count: defaultAddons.length,
                  total: defaultAddonTotal
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('[Generate Invoice API] Error processing service_type_ids:', error);
      }
    }

    // Get all approved extra charges
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'APPROVED');

    // Get job card parts
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select(`
        *,
        job_card_parts(*)
      `)
      .eq('lead_id', leadId)
      .single();

    // Calculate base amount from pricing items
    const pricingItemsTotal = pricingItems?.reduce((sum, item) => sum + getEffectivePricingItemAmount(item), 0) || 0;
    const estimatedAmount = parseFloat(lead.estimated_amount || '0');
    const estimatedCost = parseFloat(lead.estimated_cost || '0');
    const actualAmount = parseFloat(lead.actual_amount || '0');
    const finalAmountFromLead = parseFloat(lead.final_amount || '0');
    const totalPriceFromLead = parseFloat(lead.total_price || '0');
    
    // Use pricing items first, then workshop pricing, then check all possible amount fields
    // Priority: pricingItems > workshopPricing > estimated_amount > estimated_cost > actual_amount > final_amount > total_price
    const baseAmount = pricingItemsTotal > 0 
      ? pricingItemsTotal 
      : workshopPricingTotal > 0
        ? workshopPricingTotal
        : estimatedAmount > 0 
          ? estimatedAmount 
          : estimatedCost > 0
            ? estimatedCost
            : actualAmount > 0
              ? actualAmount
              : finalAmountFromLead > 0 
                ? finalAmountFromLead 
                : totalPriceFromLead > 0 
                  ? totalPriceFromLead 
                  : 0;
    
    console.log('[Generate Invoice API] Amount calculation:', {
      pricingItemsCount: pricingItems?.length || 0,
      pricingItemsTotal,
      workshopPricingTotal,
      estimatedAmount,
      estimatedCost,
      actualAmount,
      finalAmountFromLead,
      totalPriceFromLead,
      baseAmount,
      leadId,
      workshopId: lead.workshop_id,
      serviceTypeIds: lead.service_type_ids
    });
    
    // Warn if no pricing data found
    if (baseAmount === 0) {
      console.warn('[Generate Invoice API] ⚠️ No pricing data found for lead. Invoice will be generated with ₹0.00 amounts.');
      console.warn('[Generate Invoice API] Please ensure lead has pricing items, estimated_amount, estimated_cost, actual_amount, final_amount, or total_price set.');
    }
    
    const extraChargesTotal = extraCharges?.reduce((sum, charge) => sum + parseFloat(charge.amount || '0'), 0) || 0;
    const partsTotal = jobCard?.job_card_parts?.reduce((sum: number, part: any) => 
      sum + parseFloat(part.total_price || '0'), 0) || 0;
    
    // Also check labor_charges from job_card (workshop-wise pricing)
    const laborChargesFromJobCard = parseFloat(jobCard?.labor_charges || '0');
    
    // If baseAmount is 0 but labor_charges exists, use it
    const computedBaseAmount = baseAmount > 0 ? baseAmount : (laborChargesFromJobCard > 0 ? laborChargesFromJobCard : 0);

    // Allow UI overrides (billing finalization)
    const overrideBaseAmount = billingPayload?.base_amount;
    const overrideDiscountAmount = billingPayload?.discount_amount;
    const overrideCouponCode = billingPayload?.coupon_code;

    const leadDiscount = parseFloat(lead.discount_amount || '0') || 0;
    const leadCoupon = lead.coupon_code || null;
    const requestedDiscount =
      typeof overrideDiscountAmount === 'number' ? overrideDiscountAmount : leadDiscount;
    const requestedCoupon = overrideCouponCode || leadCoupon;

    if (
      !canOverrideCoupon &&
      (overrideDiscountAmount !== undefined || overrideCouponCode !== undefined) &&
      (requestedDiscount !== leadDiscount || requestedCoupon !== leadCoupon)
    ) {
      return NextResponse.json(
        { error: 'Coupon changes are restricted. Please contact a manager.' },
        { status: 403 }
      );
    }

    const finalBaseAmount =
      typeof overrideBaseAmount === 'number' && overrideBaseAmount >= 0
        ? overrideBaseAmount
        : computedBaseAmount;
    
    let discount =
      typeof overrideDiscountAmount === 'number'
        ? overrideDiscountAmount
        : parseFloat(lead.discount_amount || '0');

    const couponCode = overrideCouponCode || lead.coupon_code || null;
    const couponMeta = (lead as any)?.coupon_meta || null;
    const freeServiceLabel = couponMeta?.free_service?.matched_label
      ? String(couponMeta.free_service.matched_label).toLowerCase()
      : null;
    let freeServiceDiscount = 0;
    if (freeServiceLabel && (pricingItems?.length || 0) > 0) {
      freeServiceDiscount = (pricingItems || []).reduce((sum, item) => {
        if (String(item.item_name || '').toLowerCase().includes(freeServiceLabel)) {
          return sum + getEffectivePricingItemAmount(item);
        }
        return sum;
      }, 0);
    }
    if (!discount && freeServiceDiscount > 0) {
      discount = freeServiceDiscount;
    }

    // Calculate subtotal (base amount + parts + extra charges - discount)
    const subtotal = finalBaseAmount + extraChargesTotal + partsTotal - discount;
    
    console.log('[Generate Invoice API] Subtotal calculation:', {
      baseAmount,
      laborChargesFromJobCard,
      finalBaseAmount,
      extraChargesTotal,
      partsTotal,
      partsCount: jobCard?.job_card_parts?.length || 0,
      discount,
      subtotal
    });

    // Get customer address details (used for both tax calculation and invoice display)
    const customerAddress = lead.customer?.address || lead.customer_address || '';
    const customerCity = lead.customer?.city || lead.customer_city || '';
    const customerState = lead.customer?.state || lead.customer_state || 'Maharashtra';
    const customerStateCode = lead.customer?.state_code || lead.customer_state_code || '27';
    const customerPincode = lead.customer?.pincode || lead.customer_pincode || '';

    // Determine place of supply and tax type
    const workshopState = workshop?.state || 'Maharashtra';
    const workshopStateCode = workshop?.state_code || '27';

    const { placeOfSupply, stateCode, useIGST } = getPlaceOfSupply(
      customerState,
      customerStateCode,
      workshopState,
      workshopStateCode
    );

    // GST-inclusive totals: do not add tax on top
    const cgstAmount = 0;
    const sgstAmount = 0;
    const igstAmount = 0;
    const totalTax = 0;

    // Calculate final amount
    const finalAmountBeforeRound = subtotal;
    const finalAmount = roundOff(finalAmountBeforeRound);
    const roundOffAmount = finalAmount - finalAmountBeforeRound;
    
    console.log('[Generate Invoice API] Final amount calculation:', {
      subtotal,
      totalTax,
      finalAmountBeforeRound,
      finalAmount,
      roundOffAmount
    });

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Create line items with HSN/SAC codes
    const lineItems: any[] = [];
    const hsnSacCodes: string[] = [];

    // Add pricing items
    pricingItems?.forEach((item) => {
      const hsnCode = getHSNCode(item.item_name, true);
      const qty = getEffectiveQty(item, 1);
      const amt = getEffectivePricingItemAmount(item);
      let adjustedAmount = amt;
      let isFreeService = false;
      if (freeServiceLabel && String(item.item_name || '').toLowerCase().includes(freeServiceLabel)) {
        adjustedAmount = 0;
        isFreeService = true;
        freeServiceDiscount += amt;
      }
      lineItems.push({
        description: item.item_name,
        hsn_sac: hsnCode,
        qty,
        rate: qty ? adjustedAmount / qty : adjustedAmount,
        amount: adjustedAmount,
        is_addon: item.is_addon || false,
        free_service: isFreeService || undefined,
        original_amount: isFreeService ? amt : undefined,
      });
      if (!hsnSacCodes.includes(hsnCode)) {
        hsnSacCodes.push(hsnCode);
      }
    });

    // Add parts
    jobCard?.job_card_parts?.forEach((part: any) => {
      const hsnCode = getHSNCode(part.part_name, false);
      lineItems.push({
        description: part.part_name,
        hsn_sac: hsnCode,
        qty: part.quantity || 1,
        rate: parseFloat(part.unit_price || '0'),
        amount: parseFloat(part.total_price || '0'),
        is_part: true,
      });
      if (!hsnSacCodes.includes(hsnCode)) {
        hsnSacCodes.push(hsnCode);
      }
    });

    // Add extra charges
    extraCharges?.forEach((charge) => {
      lineItems.push({
        description: charge.description || 'Additional Jobs',
        hsn_sac: '998729', // Service code
        qty: 1,
        rate: parseFloat(charge.amount || '0'),
        amount: parseFloat(charge.amount || '0'),
        is_extra: true,
      });
    });

    // Amount in words
    const amountInWords = numberToWords(finalAmount);

    const now = new Date();
    const nowISO = now.toISOString();
    const invoiceDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const invoiceTime = now.toTimeString().split(' ')[0].substring(0, 8); // HH:MM:SS
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7); // 7 days from invoice date

    // Get workshop bank details (if available)
    const bankName = workshop?.bank_name || 'HDFC Bank';
    const bankAccountName = workshop?.bank_account_name || workshop?.name || 'MyFNG Autocare Pvt. Ltd.';
    const bankAccountNumber = workshop?.bank_account_number || '123456789012';
    const bankIFSC = workshop?.bank_ifsc || 'HDFC0001234';
    const bankBranch = workshop?.bank_branch || `${workshop?.city || 'Kamothe'}, Navi Mumbai`;

    // Get warranty info from job card
    const warrantyInfo = {
      labour_warranty: jobCard?.warranty_labour_period || '1 month / 1,000 km (whichever earlier)',
      parts_warranty: jobCard?.warranty_parts_period || '6 months',
      notes: jobCard?.warranty_notes || 'Warranty on service: 1 month / 1,000 km (whichever earlier) on labour for this job.'
    };

    // Create invoice with all required fields
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        lead_id: leadId,
        workshop_id: lead.workshop_id,
        customer_id: lead.customer_id || lead.customer?.id,
        jobcard_id: jobCard?.id || null,
        invoice_number: invoiceNumber,
        
        // Invoice Date & Time
        invoice_date: invoiceDate,
        invoice_time: invoiceTime,
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: 'Due on Receipt',
        
        // Amounts
        base_amount: finalBaseAmount,
        extra_charges: extraChargesTotal,
        parts_cost: partsTotal,
        labour_cost: finalBaseAmount, // Base service is labour (or labor_charges from job_card)
        sub_total: subtotal,
        
        // Discounts
        coupon_code: couponCode,
        discount_percentage: discount > 0 ? (discount / subtotal) * 100 : 0,
        discount_amount: discount,
        coupon_meta: couponMeta,
        
        // Round off
        round_off_amount: roundOffAmount,
        
        // Taxes
        cgst_percentage: 0,
        cgst_amount: cgstAmount,
        sgst_percentage: 0,
        sgst_amount: sgstAmount,
        igst_percentage: 0,
        igst_amount: igstAmount,
        total_tax: totalTax,
        
        // Final
        final_amount: finalAmount,
        total_amount: finalAmount, // Alias for final_amount (some schemas use total_amount)
        amount_in_words: amountInWords,
        
        // Place of Supply
        place_of_supply: placeOfSupply,
        place_of_supply_state_code: stateCode,
        
        // Line Items & HSN/SAC
        line_items: lineItems,
        hsn_sac_codes: hsnSacCodes,
        
        // Customer Address (for invoice display)
        customer_address: customerAddress,
        customer_city: customerCity,
        customer_state: customerState,
        customer_pincode: customerPincode,
        
        // Bank Details
        bank_name: bankName,
        bank_account_name: bankAccountName,
        bank_account_number: bankAccountNumber,
        bank_ifsc: bankIFSC,
        bank_branch: bankBranch,
        
        // Warranty Info
        warranty_info: warrantyInfo,
        
        // Old Parts (default false, can be updated later)
        old_parts_handed_over: false,
        
        // Status
        status: 'GENERATED',
        payment_status: 'PENDING',
        
        // Audit
        generated_by: userProfile.id,
        created_at: nowISO,
        updated_at: nowISO,
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      console.error('Invoice error details:', JSON.stringify(invoiceError, null, 2));
      return NextResponse.json({ 
        error: 'Failed to generate invoice',
        details: invoiceError.message 
      }, { status: 500 });
    }

    // Best-effort: link coupon redemption rows to this invoice
    try {
      const couponId = couponMeta?.coupon_id || null;
      let q = supabase
        .from('coupon_redemptions')
        .update({ invoice_id: invoice.id })
        .eq('service_lead_id', leadId)
        .is('invoice_id', null);
      if (couponId) q = q.eq('coupon_id', couponId);
      await q;
    } catch {
      // ignore
    }

    // Record billing finalization checklist snapshot (optional)
    if (billingChecklist) {
      await supabase
        .from('invoice_reviews')
        .insert({
          invoice_id: invoice.id,
          reviewed_by: userProfile.id,
          review_status: 'BILLING_FINALIZED',
          review_notes: billingPayload?.billing_notes || 'Billing checklist completed and invoice generated',
          items_verified: true,
          taxes_verified: true,
          customer_details_verified: true,
          reviewed_at: nowISO,
          checklist_data: billingChecklist,
          review_stage: 'BILLING_FINALIZATION',
        } as any);
    }

    // Update lead with invoice details (Step 0: System actions)
    // Status should be INVOICE_GENERATED initially, will change to AWAITING_PAYMENT after approval
    const leadUpdatePayload = {
      invoice_id: invoice.id,
      invoice_amount: finalAmount,
      invoice_generated_by: userProfile.id,
      invoice_generated_at: nowISO,
      status: 'INVOICE_GENERATED', // Will change to AWAITING_PAYMENT after approval
      updated_at: nowISO,
    };

    const tryUpdateLead = async (client: any) =>
      client
        .from('service_leads')
        .update(leadUpdatePayload)
        .eq('id', leadId)
        .select('id, status, invoice_id')
        .maybeSingle();

    let leadUpdate = await tryUpdateLead(supabase);
    if (leadUpdate.error) {
      const msg = String(leadUpdate.error?.message || leadUpdate.error);
      const code = (leadUpdate.error as any)?.code;
      const isRls =
        code === '42501' ||
        /row-level security|violates row level security|permission denied/i.test(msg);
      if (isRls && supabaseAdmin) {
        leadUpdate = await tryUpdateLead(supabaseAdmin);
      }
    }

    if (leadUpdate.error) {
      return NextResponse.json(
        {
          error: 'Failed to update lead status after invoice generation',
          details: (leadUpdate.error as any)?.message || String(leadUpdate.error),
          code: (leadUpdate.error as any)?.code,
          hint: supabaseAdmin
            ? null
            : 'Server is missing SUPABASE_SERVICE_ROLE_KEY; if RLS blocks this update, configure it or adjust policies.',
        },
        { status: 500 }
      );
    }

    // Lock job card for edits after invoice generation (Step 0: System actions)
    // Mark job card as locked after invoice generation
    if (jobCard) {
      // Update job card with locked_at timestamp (column added in migration 78)
      const jobCardUpdatePayload = {
        locked_at: nowISO,
        locked_by: userProfile.id,
        lock_reason: `Locked after invoice generation: ${invoiceNumber}`,
        status: 'INVOICE_GENERATED', // Mark as invoice generated to prevent edits
        updated_at: nowISO,
      };

      const tryUpdateJobCard = async (client: any) =>
        client.from('job_cards').update(jobCardUpdatePayload).eq('id', jobCard.id);

      let jobCardUpdate = await tryUpdateJobCard(supabase);
      if (jobCardUpdate.error) {
        const msg = String(jobCardUpdate.error?.message || jobCardUpdate.error);
        const code = (jobCardUpdate.error as any)?.code;
        const isRls =
          code === '42501' ||
          /row-level security|violates row level security|permission denied/i.test(msg);
        if (isRls && supabaseAdmin) {
          jobCardUpdate = await tryUpdateJobCard(supabaseAdmin);
        }
      }

      if (jobCardUpdate.error) {
        return NextResponse.json(
          {
            error: 'Invoice generated but failed to lock job card',
            details: (jobCardUpdate.error as any)?.message || String(jobCardUpdate.error),
            code: (jobCardUpdate.error as any)?.code,
          },
          { status: 500 }
        );
      }

      // Log job card lock event
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: leadId,
          user_id: userProfile.id,
          activity_type: 'JOB_CARD_LOCKED',
          description: `Job card locked after invoice generation`,
          metadata: {
            jobcard_id: jobCard.id,
            invoice_id: invoice.id,
            invoice_number: invoiceNumber,
            locked_at: nowISO,
            locked_by: userProfile.id,
          },
        });
    }

    // Log status change
    await supabase
      .from('lead_status_history')
      .insert({
        lead_id: leadId,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        changed_by: userProfile.id,
        changed_at: nowISO,
        reason: 'Invoice generated',
        notes: `Invoice number: ${invoiceNumber}`
      });

    // Create activity log
    await supabase
      .from('lead_activities')
      .insert({
        lead_id: leadId,
        user_id: userProfile.id,
        activity_type: 'INVOICE_GENERATED',
        description: `Invoice generated: ${invoiceNumber}`,
        old_status: lead.status,
        new_status: 'INVOICE_GENERATED',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          base_amount: finalBaseAmount,
          extra_charges: extraChargesTotal,
          discount: discount,
          tax_amount: totalTax,
          final_amount: finalAmount,
          round_off: roundOffAmount,
          due_date: dueDate.toISOString().split('T')[0],
          generated_by: userProfile.id,
          generated_at: nowISO
        }
      });

    // Create finance event for invoice creation (Step 0: System actions)
    await createFinanceEvent({
      eventType: 'invoice_created',
      entityType: 'invoice',
      entityId: invoice.id,
      actorId: userProfile.id,
      actorRole: roleCode,
      eventData: {
        invoice_number: invoiceNumber,
        lead_id: leadId,
        jobcard_id: jobCard?.id,
        final_amount: finalAmount,
        base_amount: baseAmount,
        extra_charges: extraChargesTotal,
        parts_cost: partsTotal,
        total_tax: totalTax,
        round_off: roundOffAmount,
        due_date: dueDate.toISOString().split('T')[0],
        generated_at: nowISO,
      },
    });

    // Create lead event for invoice creation (Step 13: Notifications & Audit Trail)
    await supabase
      .from('lead_events')
      .insert({
        lead_id: leadId,
        event_type: 'INVOICE_GENERATED',
        event_description: `Invoice ${invoiceNumber} generated - Amount: ₹${finalAmount.toFixed(2)}`,
        event_data: {
          invoice_id: invoice.id,
          invoice_number: invoiceNumber,
          final_amount: finalAmount,
          base_amount: finalBaseAmount,
          extra_charges: extraChargesTotal,
          parts_cost: partsTotal,
          total_tax: totalTax,
          generated_by: userProfile.id,
          generated_at: nowISO,
        },
        created_by: userProfile.id,
        created_at: nowISO,
    });

    // TODO: Generate PDF invoice
    // TODO: Send invoice to customer (Email/WhatsApp)
    // In-app notifications (Phase A)
    try {
      const leadNumber = lead.lead_number || leadId;

      // Notify workshop admin(s)
      if (lead.workshop_id) {
        await notifyWorkshopRoles({
          workshopId: lead.workshop_id,
          roleCodes: ['WORKSHOP_ADMIN'],
          type: 'INVOICE_GENERATED',
          title: 'Invoice generated',
          message: `Invoice ${invoiceNumber} generated for lead ${leadNumber}.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/workshop_admin/leads/pending`,
          metadata: { invoice_id: invoice.id, invoice_number: invoiceNumber },
        });
      }

      // Notify supervisor (if assigned)
      if (lead.assigned_supervisor_id) {
        await createNotification({
          userId: lead.assigned_supervisor_id,
          type: 'INVOICE_GENERATED',
          title: 'Invoice Generated',
          message: `Invoice ${invoiceNumber} generated for lead ${lead.lead_number || leadId}.`,
          priority: 'MEDIUM',
          leadId,
          leadNumber: lead.lead_number,
          actionUrl: `/dashboard/workshop_supervisor/jobs/${leadId}`,
          metadata: { invoice_id: invoice.id, invoice_number: invoiceNumber },
        });
      }

      // Notify telecaller + teamlead (if telecaller assigned)
      if ((lead as any)?.assigned_telecaller_id) {
        const telecallerId = (lead as any).assigned_telecaller_id as string;
        await createNotification({
          userId: telecallerId,
          type: 'INVOICE_GENERATED',
          title: 'Invoice generated',
          message: `Invoice ${invoiceNumber} generated for lead ${leadNumber}.`,
          priority: 'LOW',
          leadId,
          leadNumber,
          actionUrl: `/dashboard/telecaller/leads/${leadId}`,
          metadata: { invoice_id: invoice.id, invoice_number: invoiceNumber },
        });

        await notifyTelecallerTeamlead({
          telecallerId,
          leadId,
          leadNumber,
          type: 'INVOICE_GENERATED',
          title: 'Invoice generated',
          message: `Invoice ${invoiceNumber} generated for lead ${leadNumber}.`,
          priority: 'LOW',
          metadata: { invoice_id: invoice.id, invoice_number: invoiceNumber },
        });
      }
    } catch (e) {
      console.warn('Notification dispatch failed (non-blocking):', e);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice generated successfully',
      invoice: invoice,
      breakdown: {
        base_amount: finalBaseAmount,
        parts_cost: partsTotal,
        extra_charges: extraChargesTotal,
        discount: discount,
        subtotal: subtotal,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        total_tax: totalTax,
        final_amount: finalAmount,
        round_off: roundOffAmount,
        amount_in_words: amountInWords,
        place_of_supply: placeOfSupply,
        use_igst: useIGST,
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: 'Due on Receipt',
      },
      line_items: lineItems,
      warranty_info: warrantyInfo,
      next_step: 'Review invoice and send to customer for payment'
    }, { status: 201 });

  } catch (error) {
    console.error('Error in generate invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

