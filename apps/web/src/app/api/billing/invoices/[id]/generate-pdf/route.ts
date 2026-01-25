import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Generate Invoice PDF API
 * Creates professional PDF invoice matching user's format
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { resolveWorkshopServicePriceBestAvailable } from '@/lib/utils/workshopServicePricing';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
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

    const invoiceId = params.id;

    // Get invoice details first (without joins to avoid RLS issues)
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .maybeSingle();

    if (invoiceError) {
      console.error('[Generate PDF API] Invoice fetch error:', invoiceError);
      return NextResponse.json({ 
        error: 'Failed to fetch invoice',
        details: invoiceError.message 
      }, { status: 500 });
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch lead details separately - schema-tolerant fetch
    let lead: any = null;
    if (invoice.lead_id) {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        // NOTE: do NOT select non-existent columns like service_leads.workshop_name (varies by install)
        .select('id, lead_number, workshop_id, customer_name, customer_email, customer_phone, vehicle_number, vehicle_make, vehicle_model, vehicle_variant, vehicle_year, vehicle_fuel_type, model_id, city_id, vehicle_odometer, odometer_km, daily_running_km, next_service_km, next_service_date, service_type, service_type_ids, subservice_ids, customer_address, city, state, pincode')
        .eq('id', invoice.lead_id)
        .maybeSingle();
      
      if (leadError) {
        console.error('[Generate PDF API] Lead fetch error:', leadError);
        // Try fetching without the problematic fields if error occurs
        const { data: leadDataFallback, error: leadErrorFallback } = await supabase
          .from('service_leads')
          .select('*')
          .eq('id', invoice.lead_id)
          .maybeSingle();
        
        if (!leadErrorFallback && leadDataFallback) {
          lead = leadDataFallback;
          console.log('[Generate PDF API] Lead data fetched (fallback):', {
            vehicle_number: lead?.vehicle_number,
            vehicle_make: lead?.vehicle_make,
            vehicle_model: lead?.vehicle_model
          });
        }
      } else {
        lead = leadData;
          console.log('[Generate PDF API] Lead data fetched successfully:', {
          vehicle_number: lead?.vehicle_number,
          vehicle_make: lead?.vehicle_make,
          vehicle_model: lead?.vehicle_model,
          vehicle_fuel_type: lead?.vehicle_fuel_type,
            vehicle_odometer: (lead as any)?.vehicle_odometer,
            odometer_km: (lead as any)?.odometer_km
        });
      }
    }

    // Fetch service types
    let serviceTypes: any[] = [];
    let workshopServicePricing: any[] = [];
    if (lead?.service_type_ids && invoice.workshop_id) {
      try {
        let serviceTypeIds: string[] = [];
        if (typeof lead.service_type_ids === 'string') {
          try {
            serviceTypeIds = JSON.parse(lead.service_type_ids);
          } catch {
            serviceTypeIds = lead.service_type_ids.split(',').map((id: string) => id.trim());
          }
        } else if (Array.isArray(lead.service_type_ids)) {
          serviceTypeIds = lead.service_type_ids;
        }

        if (serviceTypeIds.length > 0) {
          // Fetch service types
          const { data: serviceTypesData } = await supabase
            .from('service_types')
            .select('id, name, description')
            .in('id', serviceTypeIds);
          
          if (serviceTypesData) {
            serviceTypes = serviceTypesData;
          }

          // Fetch workshop-specific pricing for these service types
          const { data: workshopPricingData } = await supabase
            .from('workshop_service_pricing')
            .select('service_type_id, custom_price')
            .eq('workshop_id', invoice.workshop_id)
            .in('service_type_id', serviceTypeIds)
            .eq('is_active', true);
          
          if (workshopPricingData) {
            workshopServicePricing = workshopPricingData;
          }

          // Resolve per-service price (match public customer page behavior)
          try {
            const resolved: any[] = [];
            for (const st of serviceTypes || []) {
              const stId = String((st as any)?.id || '').trim();
              if (!stId) {
                resolved.push(st);
                continue;
              }
              const p = await resolveWorkshopServicePriceBestAvailable({
                supabase,
                workshopId: String(invoice.workshop_id),
                serviceTypeId: stId,
              });
              resolved.push({ ...(st as any), resolved_price: p });
            }
            serviceTypes = resolved;

            // Best-effort: if we found any resolved service prices, reflect them in base_amount for PDF math.
            const sum = resolved.reduce((acc, st) => acc + (Number((st as any)?.resolved_price || 0) || 0), 0);
            if (sum > 0) {
              (invoice as any).base_amount = sum;
            }
          } catch {
            // ignore
          }
        }
      } catch (error) {
        console.error('[Generate PDF API] Error fetching service types:', error);
      }
    }

    // Fetch service type items (parts included in service types)
    let serviceTypeItems: any[] = [];
    if (serviceTypes.length > 0) {
      try {
        const serviceTypeIdsForItems = serviceTypes.map((st: any) => st.id);
        console.log('[Generate PDF API] Fetching service type items for:', serviceTypeIdsForItems);
        
        // Fetch service type items with product details
        const { data: itemsData, error: itemsError } = await supabase
          .from('service_type_items')
          .select(`
            id,
            service_type_id,
            quantity,
            product:master_products(
              id,
              name,
              part_number,
              hsn_sac_code,
              default_price,
              unit
            )
          `)
          .in('service_type_id', serviceTypeIdsForItems)
          .eq('is_active', true);
        
        if (itemsError) {
          console.error('[Generate PDF API] Error fetching service type items:', itemsError);
          // Try alternative query without is_active filter (in case column doesn't exist)
          const { data: itemsDataAlt, error: itemsErrorAlt } = await supabase
            .from('service_type_items')
            .select(`
              id,
              service_type_id,
              quantity,
              product:master_products(
                id,
                name,
                part_number,
                hsn_sac_code,
                default_price,
                unit
              )
            `)
            .in('service_type_id', serviceTypeIdsForItems);
          
          if (!itemsErrorAlt && itemsDataAlt) {
            serviceTypeItems = itemsDataAlt || [];
            console.log('[Generate PDF API] Service type items fetched (alt query):', serviceTypeItems.length, 'items');
          }
        } else if (itemsData) {
          serviceTypeItems = itemsData || [];
          console.log('[Generate PDF API] Service type items fetched:', serviceTypeItems.length, 'items');
        } else {
          // No error but no data - try without is_active filter
          console.log('[Generate PDF API] No data returned, trying without is_active filter...');
          const { data: itemsDataAlt2 } = await supabase
            .from('service_type_items')
            .select(`
              id,
              service_type_id,
              quantity,
              product:master_products(
                id,
                name,
                part_number,
                hsn_sac_code,
                default_price,
                unit
              )
            `)
            .in('service_type_id', serviceTypeIdsForItems);
          
          if (itemsDataAlt2) {
            serviceTypeItems = itemsDataAlt2 || [];
            console.log('[Generate PDF API] Service type items fetched (no filter):', serviceTypeItems.length, 'items');
          }
        }
        
        if (serviceTypeItems.length > 0) {
          serviceTypeItems.forEach((item: any, idx: number) => {
            console.log(`[Generate PDF API] Item ${idx + 1}:`, {
              service_type_id: item.service_type_id,
              quantity: item.quantity,
              product_name: item.product?.name,
              product_price: item.product?.default_price,
              has_product: !!item.product
            });
          });
        } else {
          console.log('[Generate PDF API] No service type items found. Checking database...');
          // Debug: Check what's in the table for this service type
          const { data: debugItems } = await supabase
            .from('service_type_items')
            .select('service_type_id, quantity, is_active')
            .eq('service_type_id', serviceTypeIdsForItems[0])
            .limit(5);
          console.log('[Generate PDF API] Debug - Items for service type:', debugItems);
          
          // Also check all items in table
          const { data: allItems } = await supabase
            .from('service_type_items')
            .select('service_type_id, quantity')
            .limit(10);
          console.log('[Generate PDF API] Debug - Sample service_type_items from DB:', allItems);
        }
      } catch (error) {
        console.error('[Generate PDF API] Error fetching service type items:', error);
      }
    }

    // Fetch service addons
    let serviceAddons: any[] = [];
    if (lead?.subservice_ids) {
      try {
        let addonIds: string[] = [];
        if (typeof lead.subservice_ids === 'string') {
          try {
            addonIds = JSON.parse(lead.subservice_ids);
          } catch {
            addonIds = lead.subservice_ids.split(',').map((id: string) => id.trim());
          }
        } else if (Array.isArray(lead.subservice_ids)) {
          addonIds = lead.subservice_ids;
        }

        if (addonIds.length > 0) {
          const { data: addonsData } = await supabase
            .from('service_addons')
            .select('id, name, description, price')
            .in('id', addonIds);
          
          if (addonsData) {
            serviceAddons = addonsData;
          }
        }
      } catch (error) {
        console.error('[Generate PDF API] Error fetching service addons:', error);
      }
    }

    // Fetch job card separately
    let jobcard: any = null;
    let jobCardParts: any[] = [];
    if (invoice.jobcard_id) {
      const { data: jobcardData, error: jobcardError } = await supabase
        .from('job_cards')
        .select('id, jobcard_number')
        .eq('id', invoice.jobcard_id)
        .maybeSingle();
      
      if (!jobcardError) {
        jobcard = jobcardData;
        
        // Fetch job card parts
        const { data: partsData } = await supabase
          .from('job_card_parts')
          .select('id, part_name, part_number, quantity, unit_price, total_price')
          .eq('job_card_id', invoice.jobcard_id);
        
        if (partsData) {
          jobCardParts = partsData;
        }
      }
    }

    // Fetch lead pricing items for itemized breakdown
    let pricingItems: any[] = [];
    if (invoice.lead_id) {
      const { data: pricingItemsData } = await supabase
        .from('lead_pricing_items')
        .select('*')
        .eq('lead_id', invoice.lead_id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true });
      
      if (pricingItemsData) {
        pricingItems = pricingItemsData;
      }
    }

    // Fetch workshop details separately (invoice.workshop_id may be null in some OS/CI flows).
    // Schema varies across installs; retry with smaller select lists if needed.
    let workshop: any = null;
    const workshopId = (invoice as any)?.workshop_id || (lead as any)?.workshop_id || null;
    if (workshopId) {
      const isMissingCol = (e: any) => {
        const msg = String(e?.message || e || '');
        const code = String(e?.code || '');
        return code === '42703' || code === 'PGRST204' || /column .* does not exist/i.test(msg);
      };
      const tryFetchWorkshop = async (client: any, select: string) =>
        client.from('workshops').select(select).eq('id', workshopId).maybeSingle();

      const selects = [
        // richest
        'id, name, workshop_name, short_address, address, city, state, pincode, phone, email, gst_number, pan_number, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch',
        // common
        'id, name, address, city, state, pincode, phone, email, gst_number, pan_number, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch',
        // minimal (old installs)
        'id, name, address, city, state, phone, email, gst_number',
      ];

      let fetched: any = null;
      let lastErr: any = null;

      for (const sel of selects) {
        const res = await tryFetchWorkshop(supabase, sel);
        if (!res.error && res.data) {
          fetched = res.data;
          break;
        }
        lastErr = res.error;
        if (!isMissingCol(res.error)) break; // stop retrying if not schema-related
      }

      if (!fetched && supabaseAdmin) {
        for (const sel of selects) {
          const res = await tryFetchWorkshop(supabaseAdmin, sel);
          if (!res.error && res.data) {
            fetched = res.data;
            break;
          }
          lastErr = res.error;
          if (!isMissingCol(res.error)) break;
        }
      }

      if (!fetched && lastErr) {
        console.error('[Generate PDF API] Workshop fetch error:', lastErr);
      }
      workshop = fetched;
    }

    // Combine all data
    const invoiceWithRelations = {
      ...invoice,
      lead,
      jobcard,
      workshop,
      serviceTypes,
      serviceAddons,
      jobCardParts,
      pricingItems,
      workshopServicePricing,
      serviceTypeItems,
    };

    // Generate HTML for PDF (will be converted to PDF)
    const htmlContent = generateInvoiceHTML(invoiceWithRelations);

    // For now, return HTML that can be printed/downloaded
    // In production, use a PDF library like puppeteer or pdfkit
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.html"`,
      },
    });

  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateInvoiceHTML(invoice: any): string {
  const invoiceDate = invoice.invoice_date 
    ? formatDateDMY(invoice.invoice_date)
    : formatDateDMY(invoice.created_at);

  const dueDate = invoice.due_date 
    ? formatDateDMY(invoice.due_date)
    : null;

  const lineItems = invoice.line_items || [];
  const workshop = invoice.workshop || {};
  const lead = invoice.lead || {};
  const jobcard = invoice.jobcard || {};
  const serviceTypes = invoice.serviceTypes || [];
  const serviceAddons = invoice.serviceAddons || [];
  const jobCardParts = invoice.jobCardParts || [];
  const pricingItems = invoice.pricingItems || [];
  const workshopServicePricing = invoice.workshopServicePricing || [];
  const serviceTypeItems = invoice.serviceTypeItems || [];
  // vehicleClass is attached by the route (best-effort) for debugging/traceability
  
  const invType = String(invoice?.invoice_type || '').toUpperCase();
  const docLabel =
    invType === 'ORDER_SUMMARY'
      ? 'Order Summary (OS)'
      : invType === 'CUSTOMER_INVOICE'
        ? 'Customer Invoice (CI)'
        : 'Tax Invoice (TI)';

  // Use invoice customer address if available, otherwise use lead
  const customerAddress = invoice.customer_address || lead.customer_address || lead.address || '';
  const customerCity = invoice.customer_city || lead.city || '';
  const customerState = invoice.customer_state || lead.state || '';
  const customerPincode = invoice.customer_pincode || lead.pincode || '';
  
  // Use invoice bank details if available, otherwise use workshop
  const bankName = invoice.bank_name || workshop.bank_name || 'HDFC Bank';
  const bankAccountName = invoice.bank_account_name || workshop.bank_account_name || workshop.name || 'MyFNG Autocare Pvt. Ltd.';
  const bankAccountNumber = invoice.bank_account_number || workshop.bank_account_number || '123456789012';
  const bankIFSC = invoice.bank_ifsc || workshop.bank_ifsc || 'HDFC0001234';
  const bankBranch = invoice.bank_branch || workshop.bank_branch || `${workshop.city || 'Kamothe'}, Navi Mumbai`;

  const toYMD = (v: any) => {
    const s = String(v || '').trim();
    if (!s) return '';
    // already YYYY-MM-DD or ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
  };

  const nextServiceKm =
    lead?.next_service_km != null && lead?.next_service_km !== ''
      ? Number(lead.next_service_km)
      : null;
  const nextServiceDate = toYMD(lead?.next_service_date);

  const gstDetailsEnabled = invType === 'TAX_INVOICE';
  const customerGstin = gstDetailsEnabled ? (invoice.customer_gstin || lead.customer_gstin || '') : '';
  const customerLegalName = gstDetailsEnabled ? (invoice.customer_legal_name || lead.customer_legal_name || '') : '';
  const customerBillingAddress = gstDetailsEnabled ? (invoice.customer_billing_address || lead.customer_billing_address || '') : '';
  const customerBillingStateCode = gstDetailsEnabled ? (invoice.customer_billing_state_code || lead.customer_billing_state_code || '') : '';
  
  // Warranty info
  const warrantyInfo = invoice.warranty_info || {};
  const labourWarranty = warrantyInfo.labour_warranty || '1 month / 1,000 km (whichever earlier)';
  const partsWarranty = warrantyInfo.parts_warranty || '6 months';
  const warrantyNotes = warrantyInfo.notes || 'Warranty on service: 1 month / 1,000 km (whichever earlier) on labour for this job.';
  
  // Old parts handed over
  const oldPartsHandedOver = invoice.old_parts_handed_over || false;
  const oldPartsNotes = invoice.old_parts_handed_over_notes || '';
  
  // Recommended future work
  const recommendedWork = invoice.recommended_future_work || '';
  
  // Round off amount
  const roundOffAmount = invoice.round_off_amount || 0;
  
  // Calculate amounts
  const subtotal = (invoice.base_amount || 0) + (invoice.extra_charges || 0) + (invoice.parts_cost || 0);
  const netTaxableValue = subtotal - (invoice.discount_amount || 0);
  const finalAmount = invoice.final_amount || invoice.total_amount || 0;
  
  // Service type names (combine all service types)
  const serviceTypeNames = serviceTypes.length > 0 
    ? serviceTypes.map((st: any) => st.name).join(' + ') 
    : (lead?.service_type || 'Periodic Service');
  
  // Odometer reading - prefer lead.vehicle_odometer (UI standard), fallback to odometer_km (legacy installs)
  const odometerReading = (lead as any)?.vehicle_odometer ?? (lead as any)?.odometer_km ?? null;
  
  // Debug: Log vehicle details
  if (!lead || !lead.vehicle_number) {
    console.warn('[Generate PDF HTML] Lead or vehicle_number is missing:', {
      hasLead: !!lead,
      vehicle_number: lead?.vehicle_number,
      vehicle_make: lead?.vehicle_make,
      vehicle_model: lead?.vehicle_model
    });
  }
  
  // Website URL
  const website = 'www.myfng.com';
  
  // CIN (if available)
  const cin = workshop.cin || 'U12345MH2020PTC123456';
  
  // Build itemized line items grouped by service types and addons
  const allLineItems: any[] = [];
  let itemCounter = 1;
  let partCounter = 1; // Counter for parts within each service type
  
  // Process service types with their parts
  serviceTypes.forEach((serviceType: any) => {
    // Find pricing for this service type
    const pricingItem = pricingItems.find((pi: any) => {
      const piServiceTypeId = String(pi.service_type_id || '');
      const stId = String(serviceType.id || '');
      return piServiceTypeId === stId;
    });
    
    // Find workshop pricing (pre-fetched best-effort; may not be class/city aware)
    const workshopPricing = workshopServicePricing.find((wsp: any) => {
      const wspId = String(wsp.service_type_id || '');
      const stId = String(serviceType.id || '');
      return wspId === stId;
    });

    // Prefer workshop resolver (city/class aware) to match public estimate pricing.
    // NOTE: This runs in a server route; `invoice.__supabase` is not available here, so resolver call is done earlier.
    const resolvedByRoute = Number((serviceType as any)?.resolved_price || 0) || 0;
    const servicePrice =
      resolvedByRoute ||
      pricingItem?.final_price ||
      pricingItem?.base_price ||
      workshopPricing?.custom_price ||
      (serviceTypes.length > 0 ? (invoice.base_amount || 0) / serviceTypes.length : invoice.base_amount || 0);
    
    // Add service type heading with price
    allLineItems.push({
      sr: itemCounter++,
      description: `${serviceType.name} (Labour)`,
      hsn_sac: pricingItem?.hsn_sac_code || '998729',
      qty: 1,
      rate: servicePrice,
      amount: servicePrice,
      isServiceHeading: true
    });
    
    // Reset part counter for this service type
    partCounter = 1;
    
    // Add parts included in this service type
    const serviceParts = serviceTypeItems.filter((item: any) => {
      const itemServiceTypeId = String(item.service_type_id || '');
      const serviceTypeId = String(serviceType.id || '');
      return itemServiceTypeId === serviceTypeId && item.product;
    });
    
    console.log(`[Generate PDF HTML] Service type "${serviceType.name}" has ${serviceParts.length} parts`);
    
    serviceParts.forEach((item: any) => {
      const product = item.product;
      if (!product || !product.name) {
        console.warn('[Generate PDF HTML] Service type item has no product:', item);
        return;
      }
      
      const productPrice = product.default_price || 0;
      const quantity = item.quantity || 1;
      const totalPrice = productPrice * quantity;
      
      console.log(`[Generate PDF HTML] Adding part ${partCounter}: ${product.name}, Qty: ${quantity}, Price: ${productPrice}`);
      
      allLineItems.push({
        sr: `${itemCounter - 1}.${partCounter++}`, // Sub-numbering: 1.1, 1.2, 1.3, etc.
        description: `${product.name}${product.part_number ? ` (${product.part_number})` : ''}`,
        hsn_sac: product.hsn_sac_code || '271019',
        qty: quantity,
        rate: productPrice,
        amount: totalPrice,
        isPart: true
      });
    });
  });
  
  // If no service types but we have base amount, add as generic service
  if (allLineItems.length === 0 && invoice.base_amount > 0) {
    allLineItems.push({
      sr: itemCounter++,
      description: 'Service Charges (Labour)',
      hsn_sac: '998729',
      qty: 1,
      rate: invoice.base_amount,
      amount: invoice.base_amount,
      isServiceHeading: true
    });
  }
  
  // If no pricing items, build from service types with workshop pricing
  if (allLineItems.length === 0 && serviceTypes.length > 0) {
    let totalServicePrice = 0;
    serviceTypes.forEach((serviceType: any) => {
      // Find workshop pricing for this service type
      const workshopPricing = workshopServicePricing.find((wsp: any) => wsp.service_type_id === serviceType.id);
      const servicePrice = workshopPricing?.custom_price || 
                          (serviceTypes.length > 0 ? (invoice.base_amount || 0) / serviceTypes.length : invoice.base_amount || 0);
      
      totalServicePrice += servicePrice;
      
      // Add service type labour charge
      allLineItems.push({
        sr: itemCounter++,
        description: `${serviceType.name} (Labour)`,
        hsn_sac: '998729',
        qty: 1,
        rate: servicePrice,
        amount: servicePrice,
        isServiceHeading: true
      });
      
      // Reset part counter for this service type
      partCounter = 1;
      
      // Add parts included in this service type (from service_type_items)
      const serviceParts = serviceTypeItems.filter((item: any) => {
        const itemServiceTypeId = String(item.service_type_id || '');
        const serviceTypeId = String(serviceType.id || '');
        return itemServiceTypeId === serviceTypeId && item.product;
      });
      
      serviceParts.forEach((item: any) => {
        const product = item.product;
        if (!product || !product.name) {
          return;
        }
        
        const productPrice = product.default_price || 0;
        const quantity = item.quantity || 1;
        const totalPrice = productPrice * quantity;
        
        allLineItems.push({
          sr: `${itemCounter - 1}.${partCounter++}`, // Sub-numbering: 1.1, 1.2, 1.3, etc.
          description: `${product.name}${product.part_number ? ` (${product.part_number})` : ''}`,
          hsn_sac: product.hsn_sac_code || '271019',
          qty: quantity,
          rate: productPrice,
          amount: totalPrice,
          isPart: true
        });
      });
    });
    
    // If workshop pricing total doesn't match base_amount, adjust the last service labour item
    if (totalServicePrice !== invoice.base_amount && allLineItems.length > 0) {
      // Find the last service labour item (not a part)
      for (let i = allLineItems.length - 1; i >= 0; i--) {
        if (allLineItems[i].description.includes('(Labour)')) {
          const difference = (invoice.base_amount || 0) - totalServicePrice;
          allLineItems[i].amount = (allLineItems[i].amount || 0) + difference;
          allLineItems[i].rate = allLineItems[i].amount;
          break;
        }
      }
    }
  } else if (allLineItems.length === 0 && invoice.base_amount > 0) {
    // Fallback: use base amount as service charge
    allLineItems.push({
      sr: itemCounter++,
      description: 'Service Charges (Labour)',
      hsn_sac: '998729',
      qty: 1,
      rate: invoice.base_amount,
      amount: invoice.base_amount
    });
  }
  
  // Add "Addon" section heading if there are addons
  const addonItems: any[] = [];
  serviceAddons.forEach((addon: any) => {
    // Find addon pricing
    const addonPricing = pricingItems.find((pi: any) => {
      const piSubserviceId = String(pi.subservice_id || '');
      const addonId = String(addon.id || '');
      return piSubserviceId === addonId;
    });
    const addonPrice = addonPricing?.final_price || addonPricing?.base_price || addon.price || 0;
    
    if (addonPrice > 0) {
      addonItems.push({
        sr: itemCounter++,
        description: addon.name,
        hsn_sac: addonPricing?.hsn_sac_code || '998714',
        qty: 1,
        rate: addonPrice,
        amount: addonPrice,
        isAddon: true
      });
    }
  });
  
  // Add addon section if there are addons
  if (addonItems.length > 0) {
    // Add "Addon" heading
    allLineItems.push({
      sr: '',
      description: 'Addon',
      hsn_sac: '',
      qty: '',
      rate: '',
      amount: '',
      isSectionHeading: true
    });
    
    // Add all addon items
    addonItems.forEach(addonItem => {
      allLineItems.push(addonItem);
    });
  }
  
  // Add parts from job card (always show separately)
  jobCardParts.forEach((part: any) => {
    allLineItems.push({
      sr: itemCounter++,
      description: `${part.part_name}${part.part_number ? ` (${part.part_number})` : ''}`,
      hsn_sac: '271019',
      qty: part.quantity || 1,
      rate: part.unit_price || 0,
      amount: part.total_price || 0
    });
  });
  
  // If no parts from job card but we have parts_cost, add it as a line item
  if (jobCardParts.length === 0 && (invoice.parts_cost || 0) > 0) {
    allLineItems.push({
      sr: itemCounter++,
      description: 'Parts & Materials',
      hsn_sac: '271019',
      qty: 1,
      rate: invoice.parts_cost,
      amount: invoice.parts_cost
    });
  }
  
  // Add extra charges if any
  if ((invoice.extra_charges || 0) > 0) {
    allLineItems.push({
      sr: itemCounter++,
      description: 'Additional Charges',
      hsn_sac: '998729',
      qty: 1,
      rate: invoice.extra_charges,
      amount: invoice.extra_charges
    });
  }
  
  // Use invoice line_items if available, otherwise use built line items
  const finalLineItems = lineItems.length > 0 ? lineItems : allLineItems;

  const invoiceType = (invoice as any).invoice_type || 'TAX_INVOICE';
  const showGstBreakup = (invoice as any).show_gst_breakup !== false && invoiceType === 'TAX_INVOICE';
  const docTitle =
    invoiceType === 'ORDER_SUMMARY'
      ? 'ORDER SUMMARY'
      : invoiceType === 'CUSTOMER_INVOICE'
        ? 'CUSTOMER INVOICE'
        : 'TAX INVOICE';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 20px;
      background: #fff;
      font-size: 12px;
    }
    .invoice-container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border: 1px solid #ddd;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }
    .brand-sub {
      font-size: 12px;
      color: #6b7280;
    }
    .brand-meta {
      margin-top: 8px;
      font-size: 11px;
      color: #6b7280;
      line-height: 1.5;
    }
    .brand-head {
      font-weight: 600;
      color: #374151;
    }
    .workshop-title {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 4px;
    }
    .workshop-name {
      font-weight: 600;
      color: #111827;
    }
    .workshop-block {
      width: 320px;
      font-size: 11px;
      color: #4b5563;
      line-height: 1.4;
    }
    .report-meta-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      font-size: 11px;
      color: #4b5563;
      margin-bottom: 16px;
    }
    .report-meta-row .meta-right {
      text-align: right;
    }
    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .detail-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
    }
    .detail-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #111827;
    }
    .detail-row {
      font-size: 11px;
      color: #4b5563;
      margin: 4px 0;
    }
    .detail-row span {
      color: #6b7280;
    }
    .logo-section {
      flex: 0 0 150px;
    }
    .logo-section img {
      max-width: 120px;
      height: auto;
    }
    .title-section {
      flex: 1;
      text-align: center;
    }
    .title-section h1 {
      color: #2563eb;
      font-size: 28px;
      margin-bottom: 5px;
      font-weight: bold;
    }
    .title-section p {
      font-size: 16px;
      color: #666;
      font-weight: 600;
    }
    .from-to-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 30px;
    }
    .from-section, .to-section {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      border-left: 4px solid #2563eb;
    }
    .from-section h3, .to-section h3 {
      color: #2563eb;
      font-size: 14px;
      margin-bottom: 10px;
      text-transform: uppercase;
      font-weight: bold;
    }
    .from-section p, .to-section p {
      margin: 5px 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11px;
    }
    .details-table th {
      background: #2563eb;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #1e40af;
    }
    .details-table td {
      padding: 10px;
      border: 1px solid #ddd;
      background: #fff;
    }
    .details-table tr:nth-child(even) td {
      background: #f8f9fa;
    }
    .line-items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11px;
    }
    .line-items-table th {
      background: #2563eb;
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #1e40af;
    }
    .line-items-table th.text-right {
      text-align: right;
    }
    .line-items-table td {
      padding: 10px 8px;
      border: 1px solid #ddd;
      background: #fff;
    }
    .line-items-table td.text-right {
      text-align: right;
    }
    .line-items-table tr:nth-child(even) td {
      background: #f8f9fa;
    }
    .gst-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 11px;
    }
    .gst-table th {
      background: #1e40af;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #1e3a8a;
    }
    .gst-table th.text-right {
      text-align: right;
    }
    .gst-table td {
      padding: 10px;
      border: 1px solid #ddd;
      background: #fff;
    }
    .gst-table td.text-right {
      text-align: right;
    }
    .gst-table tr:nth-child(even) td {
      background: #f8f9fa;
    }
    .total-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 12px;
    }
    .total-table td {
      padding: 10px;
      border: 1px solid #ddd;
    }
    .total-table td:first-child {
      font-weight: bold;
      background: #f8f9fa;
      width: 70%;
    }
    .total-table td:last-child {
      text-align: right;
      font-weight: bold;
      width: 30%;
    }
    .total-table .grand-total-row td {
      background: #2563eb;
      color: white;
      font-size: 18px;
      font-weight: bold;
      padding: 15px 10px;
    }
    .amount-words {
      margin-top: 15px;
      padding: 15px;
      background: #f0f9ff;
      border-left: 4px solid #2563eb;
      font-style: italic;
      font-size: 13px;
      text-align: center;
    }
    .payment-info {
      margin-top: 20px;
      padding: 15px;
      background: ${invoice.payment_status === 'PAID' ? '#d1fae5' : '#fef3c7'};
      border-radius: 5px;
      border-left: 4px solid ${invoice.payment_status === 'PAID' ? '#10b981' : '#f59e0b'};
    }
    .payment-info p {
      margin: 5px 0;
      font-size: 12px;
    }
    .bank-details {
      margin-top: 20px;
      padding: 15px;
      background: #e0f2fe;
      border-radius: 5px;
      border-left: 4px solid #0284c7;
    }
    .bank-details h3 {
      color: #0284c7;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .bank-details p {
      margin: 5px 0;
      font-size: 12px;
    }
    .notes-section {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
      border-left: 4px solid #6b7280;
    }
    .notes-section h3 {
      color: #374151;
      margin-bottom: 10px;
      font-size: 14px;
    }
    .notes-section p {
      margin: 8px 0;
      font-size: 12px;
      line-height: 1.6;
    }
    .notes-section ul {
      margin-left: 20px;
      margin-top: 5px;
    }
    .notes-section li {
      margin: 5px 0;
      font-size: 12px;
    }
    .declaration {
      margin-top: 30px;
      padding: 15px;
      text-align: center;
      border-top: 2px solid #ddd;
      font-size: 11px;
      color: #666;
    }
    .declaration p {
      margin: 8px 0;
    }
    .signature-section {
      margin-top: 40px;
      text-align: right;
    }
    .signature-section p {
      margin: 5px 0;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
      .invoice-container { border: none; padding: 20px; }
      .header-section { page-break-inside: avoid; }
      .from-to-section { page-break-inside: avoid; }
      .line-items-table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Comprehensive-style Header -->
    <div class="report-header">
      <div class="brand-block">
        <div class="brand-row">
          <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/logo.png" alt="MyFNG Logo" style="max-width: 48px; height: auto;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\'%3E%3Crect fill=\\'%232563eb\\' width=\\'48\\' height=\\'48\\'/%3E%3Ctext fill=\\'white\\' font-family=\\'Arial\\' font-size=\\'14\\' font-weight=\\'bold\\' x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' dominant-baseline=\\'middle\\'%3EMYFNG%3C/text%3E%3C/svg%3E';" />
          <div>
            <div class="brand-title">MY FNG</div>
            <div class="brand-sub">${docLabel}</div>
          </div>
        </div>
        <div class="brand-meta">
          <div class="brand-head">Head Office</div>
          <div>123, Start-up Hub, Tech Park, Bangalore, Karnataka - 560102</div>
          <div class="brand-contact">
            <span><strong>Email:</strong> support@myfng.in</span> |
            <span><strong>Website:</strong> www.myfng.in</span> |
            <span><strong>GSTIN:</strong> 29AAAAA0000A1Z5</span>
          </div>
        </div>
      </div>
      <div class="workshop-block">
        <div class="workshop-title">Workshop</div>
        <div class="workshop-name">${workshop.workshop_name || workshop.name || '—'}</div>
        <div>${workshop.short_address || workshop.address || '—'}${workshop.city || workshop.state || workshop.pincode ? ` ${[workshop.city, workshop.state, workshop.pincode].filter(Boolean).join(', ')}` : ''}</div>
        <div><strong>Phone:</strong> ${workshop.phone || '—'}</div>
        <div><strong>Email:</strong> ${workshop.email || '—'}</div>
        <div><strong>GSTIN:</strong> ${workshop.gst_number || '—'}</div>
      </div>
    </div>

    <div class="report-meta-row">
      <div><span class="text-gray-600">Lead #:</span> <strong>${lead.lead_number || '—'}</strong></div>
      <div><span class="text-gray-600">Invoice #:</span> <strong>${invoice.invoice_number}</strong></div>
      <div class="meta-right"><span class="text-gray-600">Generated:</span> <strong>${formatDateTime(invoice.created_at || new Date().toISOString())}</strong></div>
    </div>

    <!-- Customer + Vehicle Details -->
    <div class="detail-grid">
      <div class="detail-card">
        <div class="detail-title">Customer Details</div>
        <div class="detail-row"><span>Name:</span> <strong>${lead.customer_name || '—'}</strong></div>
        <div class="detail-row"><span>Phone:</span> <strong>${lead.customer_phone || '—'}</strong></div>
        ${lead.customer_email ? `<div class="detail-row"><span>Email:</span> ${lead.customer_email}</div>` : ''}
        <div class="detail-row"><span>Address:</span> ${customerAddress || '—'}</div>
        ${customerGstin ? `<div class="detail-row"><span>GSTIN:</span> <strong>${customerGstin}</strong></div>` : ''}
        ${customerLegalName ? `<div class="detail-row"><span>Legal Name:</span> ${customerLegalName}</div>` : ''}
        ${customerBillingAddress ? `<div class="detail-row"><span>Billing Address:</span> ${customerBillingAddress}</div>` : ''}
        ${customerBillingStateCode ? `<div class="detail-row"><span>State Code:</span> ${customerBillingStateCode}</div>` : ''}
      </div>
      <div class="detail-card">
        <div class="detail-title">Vehicle Details</div>
        <div class="detail-row"><span>Number:</span> <strong>${lead.vehicle_number || '—'}</strong></div>
        <div class="detail-row"><span>Make/Model:</span> ${lead.vehicle_make ? `${lead.vehicle_make}${lead.vehicle_model ? ` ${lead.vehicle_model}` : ''}` : '—'}</div>
        ${lead.vehicle_variant ? `<div class="detail-row"><span>Variant:</span> ${lead.vehicle_variant}</div>` : ''}
        ${lead.vehicle_year ? `<div class="detail-row"><span>Year:</span> ${lead.vehicle_year}</div>` : ''}
        ${lead.vehicle_fuel_type ? `<div class="detail-row"><span>Fuel:</span> ${lead.vehicle_fuel_type}</div>` : ''}
        <div class="detail-row"><span>Odometer:</span> ${odometerReading ? `${parseInt(odometerReading.toString()).toLocaleString('en-IN')} km` : '—'}</div>
        ${nextServiceKm != null && Number.isFinite(nextServiceKm) ? `<div class="detail-row"><span>Next Service KM:</span> <strong>${Math.round(nextServiceKm).toLocaleString('en-IN')} km</strong></div>` : ''}
        ${nextServiceDate ? `<div class="detail-row"><span>Next Service Date:</span> <strong>${formatDateDMY(nextServiceDate)}</strong></div>` : ''}
      </div>
    </div>

    <!-- Line Items Table -->
    <table class="line-items-table">
      <thead>
        <tr>
          <th>Sr</th>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th>Qty</th>
          <th class="text-right">Rate (₹)</th>
          <th class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${finalLineItems.length > 0 ? finalLineItems.map((item: any, idx: number) => {
          const sr = item.sr || item.sr_no || (idx + 1);
          const description = item.description || item.item_name || 'Service';
          const hsnSac = item.hsn_sac || item.hsn_sac_code || '998729';
          const qty = item.qty || item.quantity || 1;
          const rate = item.rate || item.unit_price || item.final_price || 0;
          const amount = item.amount || item.total_price || item.final_price || rate;
          
          // Handle section headings
          if (item.isSectionHeading) {
            return `
          <tr style="background: #e0f2fe; font-weight: bold;">
            <td colspan="6" style="padding: 12px; font-size: 13px; color: #0284c7;">${description}</td>
          </tr>
        `;
          }
          
          // Handle service heading (bold)
          if (item.isServiceHeading) {
            return `
          <tr style="background: #f0f9ff; font-weight: bold;">
            <td>${sr}</td>
            <td><strong>${description}</strong></td>
            <td>${hsnSac}</td>
            <td>${qty}</td>
            <td class="text-right"><strong>${parseFloat(rate.toString()).toFixed(2)}</strong></td>
            <td class="text-right"><strong>${parseFloat(amount.toString()).toFixed(2)}</strong></td>
          </tr>
        `;
          }
          
          // Handle parts (sub-numbered, indented)
          if (item.isPart) {
            return `
          <tr>
            <td style="padding-left: 30px;">${sr}</td>
            <td style="padding-left: 10px;">${description}</td>
            <td>${hsnSac}</td>
            <td>${qty}</td>
            <td class="text-right">${parseFloat(rate.toString()).toFixed(2)}</td>
            <td class="text-right">${parseFloat(amount.toString()).toFixed(2)}</td>
          </tr>
        `;
          }
          
          // Regular items
          return `
          <tr>
            <td>${sr}</td>
            <td>${description}</td>
            <td>${hsnSac}</td>
            <td>${qty}</td>
            <td class="text-right">${parseFloat(rate.toString()).toFixed(2)}</td>
            <td class="text-right">${parseFloat(amount.toString()).toFixed(2)}</td>
          </tr>
        `;
        }).join('') : `
          <tr>
            <td>1</td>
            <td>Service Charges (Labour)</td>
            <td>998729</td>
            <td>1</td>
            <td class="text-right">${(invoice.base_amount || 0).toFixed(2)}</td>
            <td class="text-right">${(invoice.base_amount || 0).toFixed(2)}</td>
          </tr>
          ${(invoice.parts_cost || 0) > 0 ? `
          <tr>
            <td>2</td>
            <td>Parts & Materials</td>
            <td>271019</td>
            <td>1</td>
            <td class="text-right">${invoice.parts_cost.toFixed(2)}</td>
            <td class="text-right">${invoice.parts_cost.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${(invoice.extra_charges || 0) > 0 ? `
          <tr>
            <td>${(invoice.parts_cost || 0) > 0 ? '3' : '2'}</td>
            <td>Additional Charges</td>
            <td>998729</td>
            <td>1</td>
            <td class="text-right">${invoice.extra_charges.toFixed(2)}</td>
            <td class="text-right">${invoice.extra_charges.toFixed(2)}</td>
          </tr>
          ` : ''}
        `}
      </tbody>
    </table>

    <!-- Discount Section -->
    ${invoice.discount_amount > 0 ? `
    <table class="details-table" style="margin-top: 10px;">
      <thead>
        <tr>
          <th colspan="2" style="text-align: center; background: #059669;">Discount / Coupon (If Any)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Description</strong></td>
          <td>${invoice.coupon_code || 'Discount'}</td>
        </tr>
        <tr>
          <td><strong>Amount (₹)</strong></td>
          <td>-${invoice.discount_amount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    ${showGstBreakup ? `
    <!-- GST Breakdown Table -->
    <table class="gst-table">
      <thead>
        <tr>
          <th>Component</th>
          <th class="text-right">Taxable (₹)</th>
          <th class="text-right">Rate</th>
          <th class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.cgst_amount > 0 ? `
        <tr>
          <td>CGST</td>
          <td class="text-right">${netTaxableValue.toFixed(2)}</td>
          <td class="text-right">9%</td>
          <td class="text-right">${invoice.cgst_amount.toFixed(2)}</td>
        </tr>
        ` : ''}
        ${invoice.sgst_amount > 0 ? `
        <tr>
          <td>SGST / UTGST</td>
          <td class="text-right">${netTaxableValue.toFixed(2)}</td>
          <td class="text-right">9%</td>
          <td class="text-right">${invoice.sgst_amount.toFixed(2)}</td>
        </tr>
        ` : ''}
        ${invoice.igst_amount > 0 ? `
        <tr>
          <td>IGST</td>
          <td class="text-right">${netTaxableValue.toFixed(2)}</td>
          <td class="text-right">18%</td>
          <td class="text-right">${invoice.igst_amount.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr style="background: #dbeafe; font-weight: bold;">
          <td colspan="3"><strong>Total GST:</strong></td>
          <td class="text-right"><strong>₹${(invoice.total_tax || (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) + (invoice.igst_amount || 0)).toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
    ` : ''}

    <!-- Invoice Total Table -->
    <table class="total-table">
      <thead>
        <tr>
          <th colspan="2" style="background: #1e40af; color: white; text-align: center; padding: 12px;">Invoice Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Sub-Total</td>
          <td>₹${subtotal.toFixed(2)}</td>
        </tr>
        ${invoice.discount_amount > 0 ? `
        <tr>
          <td>(-) Discount</td>
          <td>-₹${invoice.discount_amount.toFixed(2)}</td>
        </tr>
        ` : ''}
        ${showGstBreakup ? `
        <tr>
          <td>Net Taxable Value</td>
          <td>₹${netTaxableValue.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Add: Total GST</td>
          <td>₹${(invoice.total_tax || (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) + (invoice.igst_amount || 0)).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Grand Total</td>
          <td>₹${(netTaxableValue + (invoice.total_tax || (invoice.cgst_amount || 0) + (invoice.sgst_amount || 0) + (invoice.igst_amount || 0))).toFixed(2)}</td>
        </tr>
        ` : `
        <tr>
          <td>Total</td>
          <td>₹${netTaxableValue.toFixed(2)}</td>
        </tr>
        `}
        ${roundOffAmount !== 0 ? `
        <tr>
          <td>Round Off</td>
          <td>${roundOffAmount > 0 ? '+' : ''}₹${roundOffAmount.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td>${showGstBreakup ? 'Amount Payable (INR)' : 'Amount to Pay (INR)'}</td>
          <td>₹${finalAmount.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    ${invoice.amount_in_words ? `
    <div class="amount-words">
      <strong>Amount in Words:</strong> ${invoice.amount_in_words}
    </div>
    ` : ''}

    <!-- Payment Information -->
    <div class="payment-info">
      <h3 style="margin-bottom: 10px; font-size: 14px;">Payment Information</h3>
      ${invoice.payment_status === 'PAID' ? `
        <p><strong>Paid Via:</strong> ${invoice.payment_mode || 'UPI'}</p>
        ${invoice.payment_txn_id ? `<p><strong>Transaction Ref No.:</strong> ${invoice.payment_txn_id}</p>` : ''}
        <p><strong>Payment Status:</strong> PAID</p>
        ${invoice.paid_at ? `<p><strong>Paid At:</strong> ${formatDateTime(invoice.paid_at)}</p>` : ''}
      ` : `
        <p><strong>Payment Status:</strong> PENDING</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
        <p>(If unpaid, change to "Payment Status: PENDING" and add Due Date.)</p>
      `}
    </div>

    <!-- Notes / Remarks -->
    <div class="notes-section">
      <h3>Notes / Remarks</h3>
      <ul>
        <li><strong>Old parts handed over to customer:</strong> ${oldPartsHandedOver ? 'Yes' : 'No'}${oldPartsNotes ? ` - ${oldPartsNotes}` : ''}</li>
        ${recommendedWork ? `<li><strong>Recommended future work:</strong> ${recommendedWork}</li>` : ''}
        <li><strong>Warranty on service:</strong> ${warrantyNotes}</li>
        ${invoice.invoice_notes ? `<li>${invoice.invoice_notes}</li>` : ''}
      </ul>
    </div>

    <!-- Bank Details -->
    <div class="bank-details">
      <h3>Bank Details (if you want to accept NEFT/RTGS)</h3>
      <p><strong>Bank Name:</strong> ${bankName}</p>
      <p><strong>Account Name:</strong> ${bankAccountName}</p>
      <p><strong>Account No.:</strong> ${bankAccountNumber}</p>
      <p><strong>IFSC:</strong> ${bankIFSC}</p>
      <p><strong>Branch:</strong> ${bankBranch}</p>
    </div>

    <!-- Declaration -->
    <div class="declaration">
      <p><strong>Declaration</strong></p>
      <p>We declare that this invoice shows the actual price of the services and parts described and that all particulars are true and correct.</p>
      <br>
      <p>Place: ${workshop.city || 'Navi Mumbai'}</p>
      <p>Date: ${invoiceDate}</p>
      <br>
      <p>For ${workshop.name || 'MyFNG Autocare Pvt. Ltd.'}</p>
      <br>
      <div class="signature-section">
        <p>(Authorised Signatory)</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

