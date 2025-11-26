/**
 * Invoice Validation API
 * Phase 1 - Step 1: Invoice Review & Approval
 * Purpose: Validate invoice against lead_pricing_items, extra charges, and tax calculations
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateTaxes, getPlaceOfSupply } from '@/lib/utils/invoiceUtils';

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

    // Get invoice with lead details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          customer_id,
          customer_state,
          customer_state_code,
          workshop:workshops!workshop_id(
            id,
            state,
            state_code
          )
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const leadId = invoice.lead_id;
    const validationResults: any = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {
        lineItems: { valid: true, issues: [] },
        extraCharges: { valid: true, issues: [] },
        taxCalculation: { valid: true, issues: [] },
        customerDetails: { valid: true, issues: [] },
        b2bGstin: { valid: true, issues: [] },
      },
    };

    // 1. Validate Line Items vs lead_pricing_items
    const { data: pricingItems } = await supabase
      .from('lead_pricing_items')
      .select('*')
      .eq('lead_id', leadId)
      .eq('status', 'ACTIVE');

    const invoiceLineItems = invoice.line_items || [];

    if (pricingItems && pricingItems.length > 0) {
      // Check if all pricing items are in invoice
      for (const pricingItem of pricingItems) {
        const found = invoiceLineItems.find(
          (item: any) =>
            item.description === pricingItem.item_name &&
            Math.abs(parseFloat(item.amount) - parseFloat(pricingItem.final_price || '0')) < 0.01
        );

        if (!found) {
          validationResults.checks.lineItems.valid = false;
          validationResults.checks.lineItems.issues.push({
            type: 'MISSING_ITEM',
            message: `Pricing item "${pricingItem.item_name}" not found in invoice or amount mismatch`,
            pricingItem: pricingItem,
          });
        }
      }

      // Check for items in invoice not in pricing items
      for (const invoiceItem of invoiceLineItems) {
        if (!invoiceItem.is_extra && !invoiceItem.is_addon) {
          const found = pricingItems.find(
            (item) => item.item_name === invoiceItem.description
          );
          if (!found) {
            validationResults.checks.lineItems.valid = false;
            validationResults.checks.lineItems.issues.push({
              type: 'EXTRA_ITEM',
              message: `Invoice item "${invoiceItem.description}" not found in pricing items`,
              invoiceItem: invoiceItem,
            });
          }
        }
      }
    } else {
      validationResults.checks.lineItems.valid = false;
      validationResults.checks.lineItems.issues.push({
        type: 'NO_PRICING_ITEMS',
        message: 'No pricing items found for this lead',
      });
    }

    // 2. Validate Extra Charges (must be APPROVED)
    const { data: extraCharges } = await supabase
      .from('lead_extra_charges')
      .select('*')
      .eq('lead_id', leadId);

    const invoiceExtraCharges = invoiceLineItems.filter((item: any) => item.is_extra);

    if (extraCharges && extraCharges.length > 0) {
      // Check all approved extra charges are in invoice
      const approvedCharges = extraCharges.filter((charge) => charge.status === 'APPROVED');
      for (const charge of approvedCharges) {
        const found = invoiceExtraCharges.find(
          (item: any) =>
            Math.abs(parseFloat(item.amount) - parseFloat(charge.amount || '0')) < 0.01
        );

        if (!found) {
          validationResults.checks.extraCharges.valid = false;
          validationResults.checks.extraCharges.issues.push({
            type: 'MISSING_APPROVED_CHARGE',
            message: `Approved extra charge of ₹${charge.amount} not found in invoice`,
            charge: charge,
          });
        }
      }

      // Check for unapproved charges in invoice
      const unapprovedCharges = extraCharges.filter((charge) => charge.status !== 'APPROVED');
      for (const charge of unapprovedCharges) {
        const found = invoiceExtraCharges.find(
          (item: any) =>
            Math.abs(parseFloat(item.amount) - parseFloat(charge.amount || '0')) < 0.01
        );

        if (found) {
          validationResults.checks.extraCharges.valid = false;
          validationResults.checks.extraCharges.issues.push({
            type: 'UNAPPROVED_CHARGE',
            message: `Unapproved extra charge of ₹${charge.amount} found in invoice`,
            charge: charge,
          });
        }
      }
    }

    // 3. Validate Tax Calculation
    const customerState = invoice.lead?.customer_state || invoice.lead?.workshop?.state || 'Maharashtra';
    const customerStateCode = invoice.lead?.customer_state_code || invoice.lead?.workshop?.state_code || '27';
    const workshopState = invoice.lead?.workshop?.state || 'Maharashtra';
    const workshopStateCode = invoice.lead?.workshop?.state_code || '27';

    const { placeOfSupply, stateCode, useIGST } = getPlaceOfSupply(
      customerState,
      customerStateCode,
      workshopState,
      workshopStateCode
    );

    const subtotal = parseFloat(invoice.sub_total || '0');
    const { cgstAmount, sgstAmount, igstAmount, totalTax } = calculateTaxes(
      subtotal,
      useIGST,
      9, // CGST 9%
      9, // SGST 9%
      18 // IGST 18%
    );

    const expectedCGST = parseFloat(cgstAmount.toFixed(2));
    const expectedSGST = parseFloat(sgstAmount.toFixed(2));
    const expectedIGST = parseFloat(igstAmount.toFixed(2));
    const expectedTotalTax = parseFloat(totalTax.toFixed(2));

    const actualCGST = parseFloat(invoice.cgst_amount || '0');
    const actualSGST = parseFloat(invoice.sgst_amount || '0');
    const actualIGST = parseFloat(invoice.igst_amount || '0');
    const actualTotalTax = parseFloat(invoice.total_tax || '0');

    if (Math.abs(actualCGST - expectedCGST) > 0.01) {
      validationResults.checks.taxCalculation.valid = false;
      validationResults.checks.taxCalculation.issues.push({
        type: 'CGST_MISMATCH',
        message: `CGST mismatch: Expected ₹${expectedCGST}, Found ₹${actualCGST}`,
        expected: expectedCGST,
        actual: actualCGST,
      });
    }

    if (Math.abs(actualSGST - expectedSGST) > 0.01) {
      validationResults.checks.taxCalculation.valid = false;
      validationResults.checks.taxCalculation.issues.push({
        type: 'SGST_MISMATCH',
        message: `SGST mismatch: Expected ₹${expectedSGST}, Found ₹${actualSGST}`,
        expected: expectedSGST,
        actual: actualSGST,
      });
    }

    if (Math.abs(actualIGST - expectedIGST) > 0.01) {
      validationResults.checks.taxCalculation.valid = false;
      validationResults.checks.taxCalculation.issues.push({
        type: 'IGST_MISMATCH',
        message: `IGST mismatch: Expected ₹${expectedIGST}, Found ₹${actualIGST}`,
        expected: expectedIGST,
        actual: actualIGST,
      });
    }

    if (Math.abs(actualTotalTax - expectedTotalTax) > 0.01) {
      validationResults.checks.taxCalculation.valid = false;
      validationResults.checks.taxCalculation.issues.push({
        type: 'TOTAL_TAX_MISMATCH',
        message: `Total tax mismatch: Expected ₹${expectedTotalTax}, Found ₹${actualTotalTax}`,
        expected: expectedTotalTax,
        actual: actualTotalTax,
      });
    }

    // 4. Validate Customer Details
    if (!invoice.lead?.customer_id) {
      validationResults.checks.customerDetails.valid = false;
      validationResults.checks.customerDetails.issues.push({
        type: 'MISSING_CUSTOMER',
        message: 'Customer ID is missing',
      });
    }

    // 5. B2B GSTIN Check (if applicable)
    if (invoice.customer_gstin) {
      // Validate GSTIN format (15 characters, alphanumeric)
      const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstinRegex.test(invoice.customer_gstin)) {
        validationResults.checks.b2bGstin.valid = false;
        validationResults.checks.b2bGstin.issues.push({
          type: 'INVALID_GSTIN',
          message: 'Customer GSTIN format is invalid',
          gstin: invoice.customer_gstin,
        });
      }
    }

    // Determine overall validity
    validationResults.valid =
      validationResults.checks.lineItems.valid &&
      validationResults.checks.extraCharges.valid &&
      validationResults.checks.taxCalculation.valid &&
      validationResults.checks.customerDetails.valid &&
      validationResults.checks.b2bGstin.valid;

    // Collect all errors and warnings
    if (!validationResults.checks.lineItems.valid) {
      validationResults.errors.push(...validationResults.checks.lineItems.issues);
    }
    if (!validationResults.checks.extraCharges.valid) {
      validationResults.errors.push(...validationResults.checks.extraCharges.issues);
    }
    if (!validationResults.checks.taxCalculation.valid) {
      validationResults.errors.push(...validationResults.checks.taxCalculation.issues);
    }
    if (!validationResults.checks.customerDetails.valid) {
      validationResults.errors.push(...validationResults.checks.customerDetails.issues);
    }
    if (!validationResults.checks.b2bGstin.valid) {
      validationResults.warnings.push(...validationResults.checks.b2bGstin.issues);
    }

    return NextResponse.json({
      success: true,
      validation: validationResults,
      invoice_id: invoiceId,
      lead_id: leadId,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in invoice validation API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

