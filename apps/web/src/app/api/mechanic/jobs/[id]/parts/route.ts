import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Get parts for a job (Merged from Billing & Tracking)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;

    // 1. Fetch Billing Parts (Job Card Parts)
    // We need to find the job_card_id first
    const { data: jobCard } = await supabase
      .from('job_cards')
      .select('id')
      .eq('lead_id', leadId)
      .single();

    let billingParts: any[] = [];
    if (jobCard) {
      const { data } = await supabase
        .from('job_card_parts')
        .select(`
          *,
          master_products ( name, unit, hsn_sac_code )
        `)
        .eq('job_card_id', jobCard.id)
        .order('created_at', { ascending: false });
      billingParts = data || [];
    }

    return NextResponse.json({
      success: true,
      parts: billingParts
    }, { status: 200 });

  } catch (error) {
    console.error('Error in get parts API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a new part to the job (With Tax Calculation & Class Pricing)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;
    const body = await request.json();
    const { 
      product_id, // Optional: Link to Master Product
      part_name, // Manual override or Custom
      quantity = 1,
      unit_price, // Manual override
      is_custom = false
    } = body;

    // 1. Get Job Card ID & Workshop ID
    let { data: jobCard } = await supabase
      .from('job_cards')
      .select('id, workshop_id, lead_id') 
      .eq('lead_id', leadId)
      .single();

    // If no job card exists, create one (Auto-create logic)
    if (!jobCard) {
       // Fetch lead to get basic info if needed, or just create a basic job card
       const { data: lead } = await supabase.from('service_leads').select('lead_number, workshop_id').eq('id', leadId).single();
       const { data: newJobCard, error: createJCError } = await supabase
         .from('job_cards')
         .insert({
            lead_id: leadId,
            job_card_number: `JC-${lead?.lead_number || Date.now()}`,
            created_by: user.id,
            workshop_id: lead?.workshop_id // Ensure workshop_id is linked
         })
         .select()
         .single();
       
       if (createJCError) throw createJCError;
       jobCard = newJobCard;
    }

    if (!jobCard) {
        return NextResponse.json({ error: 'Failed to retrieve or create Job Card' }, { status: 500 });
    }

    // 2. Determine Vehicle Class
    // Fetch lead -> vehicle info -> car_models -> class
    let vehicleClass = null;
    const { data: leadInfo } = await supabase
      .from('service_leads')
      .select('vehicle_model')
      .eq('id', leadId)
      .single();
    
    if (leadInfo?.vehicle_model) {
        // Try to find class from car_models table
        // Assuming vehicle_model in lead matches model_name in car_models
        const { data: carModel } = await supabase
            .from('car_models')
            .select('class')
            .eq('model_name', leadInfo.vehicle_model)
            .maybeSingle();
        
        if (carModel) {
            vehicleClass = carModel.class;
        }
    }

    let finalPartName = part_name;
    let finalPrice = parseFloat(unit_price) || 0;
    let hsnCode = '';
    let taxRate = 18.00; // Default GST
    let productIdToSave = product_id;

    // 3. Fetch Pricing Logic (Priority: Manual > Class Specific > Workshop Default > Master)
    if (product_id && !unit_price) { // Only fetch if price not manually overridden
      // A. Fetch Master Product Details
      const { data: product } = await supabase
        .from('master_products')
        .select('*')
        .eq('id', product_id)
        .single();

      if (product) {
        finalPartName = finalPartName || product.name;
        hsnCode = product.hsn_sac_code;
        taxRate = product.tax_rate || 18.00;
        
        // Start with Master Price
        finalPrice = product.default_price;

        // B. Check Workshop Pricing Overrides
        if (jobCard?.workshop_id) {
            const { data: workshopPrices } = await supabase
                .from('workshop_product_pricing')
                .select('selling_price, class')
                .eq('workshop_id', jobCard.workshop_id)
                .eq('product_id', product_id);

            if (workshopPrices && workshopPrices.length > 0) {
                // Look for Class Specific Match
                const classSpecificPrice = workshopPrices.find(p => p.class === vehicleClass);
                
                // Look for Default Workshop Price (class is NULL)
                const defaultWorkshopPrice = workshopPrices.find(p => p.class === null);

                if (classSpecificPrice) {
                    finalPrice = classSpecificPrice.selling_price;
                } else if (defaultWorkshopPrice) {
                    finalPrice = defaultWorkshopPrice.selling_price;
                }
            }
        }
      }
    } else if (unit_price) {
        // If manual price provided, assume standard Tax if product linked, else default
        if (product_id) {
             const { data: product } = await supabase
                .from('master_products')
                .select('hsn_sac_code, tax_rate')
                .eq('id', product_id)
                .single();
             if (product) {
                 hsnCode = product.hsn_sac_code;
                 taxRate = product.tax_rate;
             }
        }
    }

    // 4. Calculate Taxes
    const qty = parseInt(quantity) || 1;
    const taxableAmount = finalPrice * qty;
    const gstAmount = taxableAmount * (taxRate / 100);
    
    // Split Logic (Assuming Intra-State by default for now)
    const cgstRate = taxRate / 2;
    const sgstRate = taxRate / 2;
    const cgstAmount = gstAmount / 2;
    const sgstAmount = gstAmount / 2;
    const totalAmount = taxableAmount + gstAmount;

    // 5. Insert into Job Card Parts (Billing Table)
    const { data: newPart, error: insertError } = await supabase
      .from('job_card_parts')
      .insert({
        job_card_id: jobCard.id,
        product_id: productIdToSave,
        part_name: finalPartName,
        quantity: qty,
        unit_price: finalPrice,
        
        // Tax Columns
        hsn_sac_code: hsnCode,
        tax_rate: taxRate,
        taxable_amount: taxableAmount,
        cgst_rate: cgstRate,
        cgst_amount: cgstAmount,
        sgst_rate: sgstRate,
        sgst_amount: sgstAmount,
        total_price: totalAmount // Grand Total for this line item
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding billing part:', insertError);
      return NextResponse.json({ error: 'Failed to add part' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Part added to billing',
      part: newPart,
      pricing_debug: { // Helpful for debugging
          vehicle_class: vehicleClass,
          final_price: finalPrice,
          source: productIdToSave ? 'Auto' : 'Manual'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in add part API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
