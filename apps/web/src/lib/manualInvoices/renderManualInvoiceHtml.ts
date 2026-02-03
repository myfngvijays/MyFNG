import { formatDateDMY } from '@/lib/utils';

type RenderOptions = {
  autoPrint?: boolean;
  appUrl?: string;
};

export function renderManualInvoiceHtml(invoice: any, opts: RenderOptions = {}): string {
  const autoPrint = Boolean(opts.autoPrint);
  const invoiceDate = invoice.invoice_date ? formatDateDMY(invoice.invoice_date) : formatDateDMY(invoice.created_at);
  const dueDate = invoice.due_date ? formatDateDMY(invoice.due_date) : null;
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];

  const appUrl = (opts.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  const company = {
    name: 'MY FNG AUTOCARE PVT LTD',
    address: 'A/309, Centrum Business Square, Wagle Industrial Estate, Thane (W), Maharashtra',
    city: 'Thane',
    state: 'Maharashtra',
    pincode: '400604',
    phone: '+91 9167779696',
    email: 'support@myfng.in',
    gst: '27AATCM1780F1Z4',
    pan: 'AATCM1780F',
    bank_name: 'IndusInd Bank',
    bank_account_name: 'MY FNG AUTOCARE PVT LTD',
    bank_account_number: '251317241026',
    bank_ifsc: 'INDB0001928',
    bank_branch: 'Talao Pali Thane Branch',
  };

  const customerAddress = invoice.customer_address || '';
  const customerCity = invoice.customer_city || '';
  const customerState = invoice.customer_state || '';
  const customerPincode = invoice.customer_pincode || '';
  const customerGstin = invoice.customer_gstin || '';
  const customerTaxType = invoice.customer_tax_type || '';
  const placeOfSupply = invoice.place_of_supply || '';
  const carNumber = invoice.car_number || '';
  const carModel = invoice.car_model || '';

  const rows = lineItems
    .map((item: any, idx: number) => {
      const qty = Number(item.qty || 0);
      const unit = Number(item.unit_price || 0);
      const taxPercent = Number(item.tax_percent || 0);
      const discount = Number(item.discount || 0);
      const base = qty * unit;
      const taxable = Math.max(0, base - discount);
      const tax = (taxable * taxPercent) / 100;
      const total = taxable + tax;
      const hsnSac = '996749';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>
            <div class="item-name">${item.item_name || ''}</div>
            <div class="item-desc">${item.item_description || ''}</div>
          </td>
          <td class="num">${hsnSac}</td>
          <td class="num">${qty}</td>
          <td class="num">₹${unit.toFixed(2)}</td>
          <td class="num">${taxPercent.toFixed(2)}%</td>
          <td class="num">₹${discount.toFixed(2)}</td>
          <td class="num">₹${total.toFixed(2)}</td>
        </tr>
      `;
    })
    .join('');

  const baseAmount = Number(invoice.base_amount || 0);
  const discountAmount = Number(invoice.discount || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const totalAmount = Number(invoice.total_amount || 0);
  const cgst = taxAmount / 2;
  const sgst = taxAmount / 2;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          body { font-family: "Inter", Arial, sans-serif; background: #f4f6fb; color: #101828; }
          .page { max-width: 900px; margin: 28px auto; background: #fff; padding: 28px 34px; border-radius: 14px; box-shadow: 0 10px 30px rgba(16,24,40,0.12); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; }
          .logo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
          .logo { height: 44px; width: auto; display: block; }
          .muted { color: #667085; font-size: 12px; }
          .chip { display: inline-block; padding: 4px 12px; border-radius: 999px; background: #e8f0ff; color: #1d4ed8; font-size: 12px; font-weight: 700; letter-spacing: 0.2px; }
          .meta { text-align: right; font-size: 12px; line-height: 1.6; }
          .section { margin-top: 18px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
          .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; background: #fbfbfd; }
          .card h4 { margin: 0 0 6px 0; font-size: 12px; color: #475467; font-weight: 700; letter-spacing: 0.2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px solid #eaecf0; padding: 10px 8px; font-size: 12px; vertical-align: top; }
          th { text-align: left; color: #475467; font-weight: 700; background: #f8fafc; }
          .num { text-align: right; white-space: nowrap; }
          .item-name { font-weight: 600; color: #101828; }
          .item-desc { color: #667085; font-size: 11px; margin-top: 2px; }
          .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
          .totals table { width: 320px; border: none; }
          .totals td { border: none; padding: 6px 0; }
          .totals .label { color: #667085; }
          .totals .grand { font-size: 15px; font-weight: 800; color: #111827; }
          .footer { margin-top: 18px; font-size: 11px; color: #667085; display: flex; justify-content: space-between; }
          .gst { font-size: 11px; color: #475467; margin-top: 4px; }
          .divider { height: 1px; background: #eaecf0; margin: 14px 0; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div>
              <div class="logo-row">
                <img class="logo" src="${appUrl}/logo.png" alt="MyFNG" />
              </div>
              <div class="muted">${company.name}</div>
              <div class="muted">${company.address}, ${company.city}, ${company.state} ${company.pincode}</div>
              <div class="muted">${company.phone} | ${company.email}</div>
              <div class="gst">GSTIN: ${company.gst} | Company PAN No.: ${company.pan}</div>
            </div>
            <div class="meta">
              <div class="chip">INVOICE</div>
              <div><strong>Invoice #:</strong> ${invoice.invoice_number}</div>
              <div><strong>Date:</strong> ${invoiceDate}</div>
              ${dueDate ? `<div><strong>Due:</strong> ${dueDate}</div>` : ''}
            </div>
          </div>

          <div class="section grid">
            <div class="card">
              <h4>Bill To</h4>
              <div><strong>${invoice.customer_name || ''}</strong></div>
              <div class="muted">${invoice.customer_phone || ''}${invoice.customer_email ? ` | ${invoice.customer_email}` : ''}</div>
              <div class="muted">${customerAddress}</div>
              <div class="muted">${customerCity}${customerState ? `, ${customerState}` : ''} ${customerPincode}</div>
              ${customerGstin ? `<div class="muted">GSTIN: ${customerGstin}</div>` : ''}
              ${customerTaxType ? `<div class="muted">Customer Type: ${customerTaxType}</div>` : ''}
              ${placeOfSupply ? `<div class="muted">Place of Supply: ${placeOfSupply}</div>` : ''}
              ${(carNumber || carModel) ? `<div class="muted">Vehicle: ${carNumber || '—'}${carModel ? ` | ${carModel}` : ''}</div>` : ''}
            </div>
            <div class="card">
              <h4>Payment Received</h4>
              <div><strong>₹${Number(invoice.paid_amount || invoice.total_amount || 0).toFixed(2)}</strong></div>
              <div class="muted">Mode: ${invoice.payment_mode || '—'}</div>
              <div class="muted">Reference: ${invoice.payment_reference || '—'}</div>
              <div class="muted">Date: ${invoice.paid_at ? formatDateDMY(invoice.paid_at) : '—'}</div>
            </div>
          </div>

          <div class="section">
            <table>
              <thead>
                <tr>
                  <th style="width:40px">#</th>
                  <th>Item</th>
                  <th class="num" style="width:90px">HSN/SAC</th>
                  <th class="num">Qty</th>
                  <th class="num">Unit Price</th>
                  <th class="num">Tax %</th>
                  <th class="num">Discount</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>

          <div class="totals">
            <table>
              <tr><td class="label">Sub Total</td><td class="num">₹${baseAmount.toFixed(2)}</td></tr>
              <tr><td class="label">Discount</td><td class="num">₹${discountAmount.toFixed(2)}</td></tr>
              <tr><td class="label">CGST</td><td class="num">₹${cgst.toFixed(2)}</td></tr>
              <tr><td class="label">SGST</td><td class="num">₹${sgst.toFixed(2)}</td></tr>
              <tr><td class="grand">Total</td><td class="num grand">₹${totalAmount.toFixed(2)}</td></tr>
            </table>
          </div>

          <div class="footer">
            <div>Thank you for choosing MyFNG.</div>
            <div>Generated by MyFNG System</div>
          </div>
        </div>
        ${autoPrint ? `<script>window.print();</script>` : ''}
      </body>
    </html>
  `;
}

