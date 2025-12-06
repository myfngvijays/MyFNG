/**
 * Generate Invoice PDF API
 * Creates professional PDF invoice matching user's format
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
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

    // Fetch lead details separately - fetch ALL vehicle and customer fields
    let lead: any = null;
    if (invoice.lead_id) {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('id, lead_number, customer_name, customer_email, customer_phone, vehicle_number, vehicle_make, vehicle_model, vehicle_variant, vehicle_year, vehicle_fuel_type, odometer_km, service_type, service_type_ids, subservice_ids, customer_address, city, state, pincode')
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
          odometer_km: lead?.odometer_km
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

    // Fetch workshop details separately
    let workshop: any = null;
    if (invoice.workshop_id) {
      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('name, address, city, state, phone, email, gst_number, pan_number, bank_name, bank_account_name, bank_account_number, bank_ifsc, bank_branch')
        .eq('id', invoice.workshop_id)
        .maybeSingle();
      
      if (!workshopError) {
        workshop = workshopData;
      }
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
      serviceTypeItems
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
    ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : new Date(invoice.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const dueDate = invoice.due_date 
    ? new Date(invoice.due_date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
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
  
  // Odometer reading - use odometer_km field
  const odometerReading = lead?.odometer_km || null;
  
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
    
    // Find workshop pricing
    const workshopPricing = workshopServicePricing.find((wsp: any) => {
      const wspId = String(wsp.service_type_id || '');
      const stId = String(serviceType.id || '');
      return wspId === stId;
    });
    
    const servicePrice = pricingItem?.final_price || 
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

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
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
    <!-- Header with Logo -->
    <div class="header-section">
      <div class="logo-section">
        <img src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/logo.png" alt="MyFNG Logo" style="max-width: 120px; height: auto;" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'120\' height=\'60\'%3E%3Crect fill=\'%232563eb\' width=\'120\' height=\'60\'/%3E%3Ctext fill=\'white\' font-family=\'Arial\' font-size=\'20\' font-weight=\'bold\' x=\'50%25\' y=\'50%25\' text-anchor=\'middle\' dominant-baseline=\'middle\'%3EMyFNG%3C/text%3E%3C/svg%3E';" />
      </div>
      <div class="title-section">
        <h1>TAX INVOICE</h1>
        <p>Invoice #${invoice.invoice_number}</p>
      </div>
    </div>

    <!-- From (Supplier) and To (Customer) -->
    <div class="from-to-section">
      <div class="from-section">
        <h3>From (Supplier):</h3>
        <p><strong>${workshop.name || 'MyFNG Autocare Pvt. Ltd.'}</strong></p>
        <p>Registered Office: ${workshop.address || 'Plot No. 21, Sector 12, Kamothe, Navi Mumbai – 410209'}, Maharashtra, India</p>
        <p>Phone: ${workshop.phone || '+91-98765 43210'}</p>
        <p>Email: ${workshop.email || 'support@myfng.com'}</p>
        <p>Website: ${website}</p>
        ${workshop.gst_number ? `<p><strong>GSTIN:</strong> ${workshop.gst_number}</p>` : '<p><strong>GSTIN:</strong> 27ABCDE1234F1Z5</p>'}
        ${workshop.pan_number ? `<p><strong>PAN:</strong> ${workshop.pan_number}</p>` : '<p><strong>PAN:</strong> ABCDE1234F</p>'}
        <p><strong>CIN:</strong> ${cin}</p>
      </div>
      <div class="to-section">
        <h3>To (Customer):</h3>
        <p><strong>Name:</strong> ${lead.customer_name ? `Mr./Ms. ${lead.customer_name}` : 'N/A'}</p>
        <p><strong>Address:</strong> ${customerAddress || 'N/A'}</p>
        ${customerCity || customerState || customerPincode ? `<p>${[customerCity, customerState, customerPincode].filter(Boolean).join(', ')}</p>` : ''}
        <p><strong>Mobile:</strong> ${lead.customer_phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${lead.customer_email || 'N/A'}</p>
      </div>
    </div>

    <!-- Invoice Details Table -->
    <table class="details-table">
      <thead>
        <tr>
          <th colspan="2" style="text-align: center; background: #1e40af;">Invoice Details</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Invoice No.</strong></td>
          <td>${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td><strong>Invoice Date</strong></td>
          <td>${invoiceDate}</td>
        </tr>
        <tr>
          <td><strong>Place of Supply</strong></td>
          <td>${invoice.place_of_supply || customerState || 'Maharashtra'} (${invoice.place_of_supply_state_code || '27'})</td>
        </tr>
        <tr>
          <td><strong>Lead / Jobcard ID</strong></td>
          <td>${lead.lead_number || 'N/A'} / ${jobcard.jobcard_number || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Payment Terms</strong></td>
          <td>${invoice.payment_terms || 'Due on Receipt'}</td>
        </tr>
        <tr>
          <td><strong>Mode of Payment</strong></td>
          <td>${invoice.payment_mode || 'UPI / Online'}</td>
        </tr>
      </tbody>
    </table>

    <!-- Vehicle Details Table -->
    <table class="details-table">
      <thead>
        <tr>
          <th colspan="2" style="text-align: center; background: #1e40af;">Vehicle Details</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Vehicle Reg. No.</strong></td>
          <td>${lead && lead.vehicle_number ? lead.vehicle_number : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Make / Model</strong></td>
          <td>${lead && lead.vehicle_make ? `${lead.vehicle_make}${lead.vehicle_model ? ` ${lead.vehicle_model}` : ''}${lead.vehicle_variant ? ` ${lead.vehicle_variant}` : ''}${lead.vehicle_year ? ` (${lead.vehicle_year})` : ''}` : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Fuel Type</strong></td>
          <td>${lead && lead.vehicle_fuel_type ? lead.vehicle_fuel_type : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Odometer (In)</strong></td>
          <td>${odometerReading ? `${parseInt(odometerReading.toString()).toLocaleString('en-IN')} km` : 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Service Type</strong></td>
          <td>${serviceTypeNames || (lead && lead.service_type ? lead.service_type : 'N/A')}</td>
        </tr>
      </tbody>
    </table>

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
        ${roundOffAmount !== 0 ? `
        <tr>
          <td>Round Off</td>
          <td>${roundOffAmount > 0 ? '+' : ''}₹${roundOffAmount.toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr class="grand-total-row">
          <td>Amount Payable (INR)</td>
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
        ${invoice.paid_at ? `<p><strong>Paid At:</strong> ${new Date(invoice.paid_at).toLocaleString('en-IN')}</p>` : ''}
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

