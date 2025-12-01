import React from 'react';

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  jobCardNo: string;
  jobCardDate: string;
  
  workshop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gstin: string;
    logoUrl?: string;
  };
  
  customer: {
    name: string;
    contactPerson?: string;
    gstin?: string;
    address: string;
    phone: string;
    email?: string;
  };
  
  vehicle: {
    regNumber: string;
    kms: string;
    vin: string;
    model: string;
    engineNo?: string;
  };
  
  parts: InvoiceItem[];
  services: InvoiceItem[];
  
  totals: {
    subTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    grandTotal: number;
    amountInWords: string;
  };
}

export interface InvoiceItem {
  sNo: number;
  name: string;
  hsn: string;
  qty: number;
  unitPrice: number;
  taxableAmount: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  totalAmount: number;
}

export const InvoiceTemplate = React.forwardRef<HTMLDivElement, { data: InvoiceData }>(({ data }, ref) => {
  return (
    <div ref={ref} className="bg-white p-8 max-w-4xl mx-auto text-xs font-sans text-gray-900 print:p-0">
      {/* Header */}
      <div className="border-b-2 border-gray-800 mb-4 pb-4">
        <div className="flex justify-between items-start">
          <div className="w-2/3">
            <h1 className="text-3xl font-bold text-brand-primary mb-2 uppercase">MY FNG</h1>
            <p className="whitespace-pre-line text-gray-600 leading-tight">
              Head Office: 123, Start-up Hub, Tech Park,<br />
              Bangalore, Karnataka - 560102
            </p>
            <div className="mt-2 space-y-1">
              <p><strong>Ph:</strong> +91 98765 43210</p>
              <p><strong>Email:</strong> support@myfng.in</p>
              <p><strong>Website:</strong> www.myfng.in</p>
              <p className="font-bold mt-2">GSTIN: 29AAAAA0000A1Z5</p>
            </div>
          </div>
          <div className="w-1/3 flex justify-end">
            {/* Using local logo or fallback */}
             <div className="h-24 w-24 flex items-center justify-center">
                <img src="/logo.png" alt="MY FNG" className="h-full object-contain" onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl font-bold text-brand-primary">MY FNG</span>';
                }} />
             </div>
          </div>
        </div>
        <div className="text-center mt-4">
          <span className="font-bold text-lg border-b-2 border-gray-800 uppercase">Tax Invoice</span>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 border border-gray-300 mb-6">
        {/* Customer Details */}
        <div className="p-2 border-r border-gray-300">
          <h3 className="font-bold bg-gray-100 p-1 mb-2 uppercase border-b border-gray-200">Customer Details</h3>
          <div className="space-y-1">
            <div className="flex"><span className="w-24 font-semibold">Name:</span> <span>{data.customer.name}</span></div>
            {data.customer.contactPerson && (
              <div className="flex"><span className="w-24 font-semibold">Contact Name:</span> <span>{data.customer.contactPerson}</span></div>
            )}
            <div className="flex"><span className="w-24 font-semibold">Cust GSTIN:</span> <span>{data.customer.gstin || 'N/A'}</span></div>
            <div className="flex"><span className="w-24 font-semibold">Address:</span> <span className="flex-1">{data.customer.address}</span></div>
            <div className="flex"><span className="w-24 font-semibold">Phone:</span> <span>{data.customer.phone}</span></div>
            <div className="flex"><span className="w-24 font-semibold">Email:</span> <span>{data.customer.email}</span></div>
          </div>
        </div>

        {/* Invoice & Vehicle Details */}
        <div className="p-2">
          <h3 className="font-bold bg-gray-100 p-1 mb-2 uppercase border-b border-gray-200">Invoice & Vehicle Details</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between"><span className="font-semibold">Invoice No:</span> <span>{data.invoiceNo}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Jobcard No:</span> <span>{data.jobCardNo}</span></div>
            
            <div className="flex justify-between"><span className="font-semibold">Date:</span> <span>{data.invoiceDate}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Job Date:</span> <span>{data.jobCardDate}</span></div>
            
            <div className="col-span-2 border-t border-dashed border-gray-300 my-1"></div>
            
            <div className="flex justify-between"><span className="font-semibold">Reg. Number:</span> <span>{data.vehicle.regNumber}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Kms Driven:</span> <span>{data.vehicle.kms}</span></div>
            
            <div className="flex justify-between"><span className="font-semibold">VIN:</span> <span>{data.vehicle.vin}</span></div>
            <div className="flex justify-between"><span className="font-semibold">Engine No:</span> <span>{data.vehicle.engineNo || '-'}</span></div>
            
            <div className="col-span-2 flex"><span className="font-semibold w-20">Model:</span> <span>{data.vehicle.model}</span></div>
          </div>
        </div>
      </div>

      {/* Tables Function */}
      {renderTable("Particulars of Parts", data.parts)}
      
      <div className="my-4"></div>
      
      {renderTable("Particulars of Services", data.services)}

      {/* Totals */}
      <div className="flex justify-end mt-4 mb-8">
        <div className="w-1/2">
          <div className="border border-gray-300 rounded-sm">
            <div className="flex justify-between p-2 border-b border-gray-200">
              <span className="font-bold">Sub Total (Before Tax)</span>
              <span>₹ {data.totals.subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2 border-b border-gray-200 text-gray-600">
              <span>Total CGST</span>
              <span>₹ {data.totals.cgstTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2 border-b border-gray-200 text-gray-600">
              <span>Total SGST</span>
              <span>₹ {data.totals.sgstTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-100 font-bold text-base">
              <span>Grand Total</span>
              <span>₹ {data.totals.grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-2 text-right italic text-gray-600">
             Amount in words: <span className="font-semibold text-gray-800">{data.totals.amountInWords}</span>
          </div>
        </div>
      </div>

      {/* Footer / Signatures */}
      <div className="mt-12 pt-8 border-t border-gray-300 flex justify-between items-end">
        <div className="text-center w-1/3">
          <div className="h-16 border-b border-gray-400 mb-2"></div>
          <p className="font-semibold">Customer Signature</p>
        </div>
        <div className="text-center w-1/3">
          <p className="text-gray-500 text-[10px] mb-8">
            Subject to {data.workshop.name} terms and conditions.
            <br /> Goods once sold will not be taken back.
          </p>
          <div className="h-16 border-b border-gray-400 mb-2"></div>
          <p className="font-semibold">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';

// Helper to render tables
function renderTable(title: string, items: InvoiceItem[]) {
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-2">
      <h3 className="font-bold text-gray-700 mb-1 uppercase text-xs px-1">{title}</h3>
      <table className="w-full border-collapse border border-gray-300 text-[11px]">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 p-1 w-8 text-center">S.No</th>
            <th className="border border-gray-300 p-1 text-left">Particulars</th>
            <th className="border border-gray-300 p-1 w-16 text-center">HSN/SAC</th>
            <th className="border border-gray-300 p-1 w-10 text-center">Qty</th>
            <th className="border border-gray-300 p-1 w-16 text-right">Rate</th>
            <th className="border border-gray-300 p-1 w-16 text-right">Taxable</th>
            
            <th className="border border-gray-300 p-1 w-24 text-center">
              CGST
              <div className="grid grid-cols-2 border-t border-gray-300 mt-1">
                <span className="border-r border-gray-300">%</span>
                <span>Amt</span>
              </div>
            </th>
            <th className="border border-gray-300 p-1 w-24 text-center">
              SGST
              <div className="grid grid-cols-2 border-t border-gray-300 mt-1">
                <span className="border-r border-gray-300">%</span>
                <span>Amt</span>
              </div>
            </th>
            
            <th className="border border-gray-300 p-1 w-20 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="odd:bg-white even:bg-gray-50">
              <td className="border border-gray-300 p-1 text-center">{item.sNo}</td>
              <td className="border border-gray-300 p-1 font-medium">{item.name}</td>
              <td className="border border-gray-300 p-1 text-center">{item.hsn}</td>
              <td className="border border-gray-300 p-1 text-center">{item.qty}</td>
              <td className="border border-gray-300 p-1 text-right">{item.unitPrice.toFixed(2)}</td>
              <td className="border border-gray-300 p-1 text-right">{item.taxableAmount.toFixed(2)}</td>
              
              {/* CGST */}
              <td className="border border-gray-300 p-0">
                <div className="grid grid-cols-2 h-full">
                  <span className="border-r border-gray-300 p-1 text-center">{item.cgstRate}%</span>
                  <span className="p-1 text-right">{item.cgstAmount.toFixed(2)}</span>
                </div>
              </td>

              {/* SGST */}
              <td className="border border-gray-300 p-0">
                 <div className="grid grid-cols-2 h-full">
                  <span className="border-r border-gray-300 p-1 text-center">{item.sgstRate}%</span>
                  <span className="p-1 text-right">{item.sgstAmount.toFixed(2)}</span>
                </div>
              </td>
              
              <td className="border border-gray-300 p-1 text-right font-bold">{item.totalAmount.toFixed(2)}</td>
            </tr>
          ))}
          {/* Empty row filler if needed */}
        </tbody>
      </table>
    </div>
  );
}

