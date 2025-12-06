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

    // Get invoice details with all related data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          lead_number,
          customer_name,
          customer_email,
          customer_phone,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          vehicle_fuel_type,
          odometer_reading
        ),
        jobcard:job_cards!jobcard_id(
          id,
          jobcard_number
        ),
        workshop:workshops!workshop_id(
          name,
          address,
          city,
          state,
          phone,
          email,
          gst_number,
          pan_number,
          bank_name,
          bank_account_name,
          bank_account_number,
          bank_ifsc,
          bank_branch
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Generate HTML for PDF (will be converted to PDF)
    const htmlContent = generateInvoiceHTML(invoice);

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
  
  // Use invoice customer address if available, otherwise use lead
  const customerAddress = invoice.customer_address || lead.customer_address || '';
  const customerCity = invoice.customer_city || lead.customer_city || '';
  const customerState = invoice.customer_state || lead.customer_state || '';
  const customerPincode = invoice.customer_pincode || lead.customer_pincode || '';
  
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
  
  // Calculate net taxable value
  const netTaxableValue = (invoice.base_amount || 0) + (invoice.extra_charges || 0) + (invoice.parts_cost || 0) - (invoice.discount_amount || 0);

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
      font-family: 'Arial', sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 40px;
      background: #fff;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border: 1px solid #ddd;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .company-info {
      text-align: left;
      margin-bottom: 30px;
    }
    .company-info h2 {
      color: #1e40af;
      margin-bottom: 10px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
    }
    .info-box {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
    }
    .info-box h3 {
      color: #2563eb;
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #2563eb;
      color: white;
      font-weight: bold;
    }
    tr:hover {
      background: #f8f9fa;
    }
    .text-right {
      text-align: right;
    }
    .total-section {
      margin-top: 20px;
      border-top: 2px solid #2563eb;
      padding-top: 20px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
    }
    .grand-total {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      border-top: 2px solid #2563eb;
      padding-top: 10px;
      margin-top: 10px;
    }
    .amount-words {
      margin-top: 15px;
      padding: 15px;
      background: #f0f9ff;
      border-left: 4px solid #2563eb;
      font-style: italic;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .bank-details {
      margin-top: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 5px;
    }
    @media print {
      body { padding: 0; }
      .invoice-container { border: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="header">
      <h1>TAX INVOICE</h1>
      <p style="font-size: 18px; color: #666;">Invoice #${invoice.invoice_number}</p>
    </div>

    <!-- Company Info -->
    <div class="company-info">
      <h2>${workshop.name || 'MyFNG Autocare Pvt. Ltd.'}</h2>
      <p>${workshop.address || 'Plot No. 21, Sector 12, Kamothe, Navi Mumbai – 410209'}</p>
      <p>Phone: ${workshop.phone || '+91-98765 43210'} | Email: ${workshop.email || 'support@myfng.com'}</p>
      ${workshop.gst_number ? `<p><strong>GSTIN:</strong> ${workshop.gst_number}</p>` : ''}
      ${workshop.pan_number ? `<p><strong>PAN:</strong> ${workshop.pan_number}</p>` : ''}
    </div>

    <!-- Invoice & Customer Info -->
    <div class="info-grid">
      <div class="info-box">
        <h3>Invoice Details</h3>
        <p><strong>Invoice No:</strong> ${invoice.invoice_number}</p>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        ${dueDate ? `<p><strong>Due Date:</strong> ${dueDate}</p>` : ''}
        <p><strong>Place of Supply:</strong> ${invoice.place_of_supply || lead.state || 'Maharashtra'} (${invoice.place_of_supply_state_code || '27'})</p>
        <p><strong>Payment Terms:</strong> ${invoice.payment_terms || 'Due on Receipt'}</p>
        ${jobcard.jobcard_number ? `<p><strong>Lead / Jobcard ID:</strong> ${lead.lead_number || 'N/A'} / ${jobcard.jobcard_number || 'N/A'}</p>` : ''}
      </div>
      <div class="info-box">
        <h3>Customer Details</h3>
        <p><strong>Name:</strong> ${lead.customer_name || 'N/A'}</p>
        ${customerAddress ? `<p><strong>Address:</strong> ${customerAddress}</p>` : ''}
        ${customerCity || customerState || customerPincode ? `<p>${[customerCity, customerState, customerPincode].filter(Boolean).join(', ')}</p>` : ''}
        <p><strong>Phone:</strong> ${lead.customer_phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${lead.customer_email || 'N/A'}</p>
      </div>
    </div>

    <!-- Vehicle Details -->
    <div class="info-box" style="margin-bottom: 20px;">
      <h3>Vehicle Details</h3>
      <p><strong>Registration:</strong> ${lead.vehicle_number || 'N/A'}</p>
      <p><strong>Make/Model:</strong> ${lead.vehicle_make || ''} ${lead.vehicle_model || ''}</p>
      ${lead.vehicle_fuel_type ? `<p><strong>Fuel Type:</strong> ${lead.vehicle_fuel_type}</p>` : ''}
      ${lead.odometer_reading ? `<p><strong>Odometer:</strong> ${lead.odometer_reading} km</p>` : ''}
    </div>

    <!-- Line Items Table -->
    <table>
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
        ${lineItems.map((item: any, idx: number) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.description || 'Service'}</td>
            <td>${item.hsn_sac || '998729'}</td>
            <td>${item.qty || 1}</td>
            <td class="text-right">${(item.rate || 0).toFixed(2)}</td>
            <td class="text-right">${(item.amount || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Amount Summary -->
    <div class="total-section">
      <div class="total-row">
        <span>Sub-Total (without taxes):</span>
        <span>₹${netTaxableValue.toFixed(2)}</span>
      </div>
      ${invoice.discount_amount > 0 ? `
        <div class="total-row">
          <span>Discount / Coupon ${invoice.coupon_code ? `(${invoice.coupon_code})` : ''}:</span>
          <span>-₹${invoice.discount_amount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="total-row">
        <span>Net Taxable Value:</span>
        <span>₹${netTaxableValue.toFixed(2)}</span>
      </div>
      ${invoice.cgst_amount > 0 ? `
        <div class="total-row">
          <span>CGST (9%):</span>
          <span>₹${invoice.cgst_amount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${invoice.sgst_amount > 0 ? `
        <div class="total-row">
          <span>SGST (9%):</span>
          <span>₹${invoice.sgst_amount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${invoice.igst_amount > 0 ? `
        <div class="total-row">
          <span>IGST (18%):</span>
          <span>₹${invoice.igst_amount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="total-row">
        <span>Total GST:</span>
        <span>₹${invoice.total_tax?.toFixed(2) || (invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount).toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>Add: Total GST:</span>
        <span>₹${invoice.total_tax?.toFixed(2) || (invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount).toFixed(2)}</span>
      </div>
      ${roundOffAmount !== 0 ? `
        <div class="total-row">
          <span>Round Off:</span>
          <span>${roundOffAmount > 0 ? '+' : ''}₹${roundOffAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="grand-total total-row">
        <span>Amount Payable (INR):</span>
        <span>₹${invoice.final_amount.toFixed(2)}</span>
      </div>
      ${invoice.amount_in_words ? `
        <div class="amount-words">
          <strong>Amount in Words:</strong> ${invoice.amount_in_words}
        </div>
      ` : ''}
    </div>

    <!-- Payment Info -->
    ${invoice.payment_status === 'PAID' ? `
      <div style="margin-top: 20px; padding: 15px; background: #d1fae5; border-radius: 5px;">
        <p><strong>Payment Status:</strong> PAID</p>
        <p><strong>Payment Mode:</strong> ${invoice.payment_mode || 'N/A'}</p>
        ${invoice.payment_txn_id ? `<p><strong>Transaction Ref:</strong> ${invoice.payment_txn_id}</p>` : ''}
        ${invoice.paid_at ? `<p><strong>Paid At:</strong> ${new Date(invoice.paid_at).toLocaleString('en-IN')}</p>` : ''}
      </div>
    ` : `
      <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 5px;">
        <p><strong>Payment Status:</strong> PENDING</p>
        <p>Payment due on receipt</p>
      </div>
    `}

    <!-- Bank Details -->
    <div class="bank-details">
      <h3 style="margin-bottom: 10px; color: #2563eb;">Bank Details (NEFT/RTGS)</h3>
      <p><strong>Bank Name:</strong> ${bankName}</p>
      <p><strong>Account Name:</strong> ${bankAccountName}</p>
      <p><strong>Account No:</strong> ${bankAccountNumber}</p>
      <p><strong>IFSC:</strong> ${bankIFSC}</p>
      <p><strong>Branch:</strong> ${bankBranch}</p>
    </div>

    <!-- Notes / Remarks -->
      <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
        <h3 style="margin-bottom: 10px; color: #2563eb;">Notes / Remarks</h3>
      <p><strong>Old parts handed over to customer:</strong> ${oldPartsHandedOver ? 'Yes' : 'No'}${oldPartsNotes ? ` - ${oldPartsNotes}` : ''}</p>
      ${recommendedWork ? `<p><strong>Recommended future work:</strong> ${recommendedWork}</p>` : ''}
      <p><strong>Warranty on service:</strong> ${warrantyNotes}</p>
      ${invoice.invoice_notes ? `<p>${invoice.invoice_notes}</p>` : ''}
      </div>

    <!-- Footer -->
    <div class="footer">
      <p><strong>Declaration:</strong> We declare that this invoice shows the actual price of the services and parts described and that all particulars are true and correct.</p>
      <p style="margin-top: 20px;">Place: ${workshop.city || 'Navi Mumbai'}</p>
      <p>Date: ${invoiceDate}</p>
      <p style="margin-top: 30px;">For ${workshop.name || 'MyFNG Autocare Pvt. Ltd.'}</p>
      <p style="margin-top: 40px;">(Authorised Signatory)</p>
    </div>
  </div>
</body>
</html>
  `;
}

