/**
 * PDF Generation Service
 * Generates professional invoice PDFs
 */

export interface InvoicePDFData {
  invoice: any;
  workshop: any;
  lead: any;
}

/**
 * Generate PDF download link
 */
export async function generateInvoicePDF(invoiceId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/billing/invoices/${invoiceId}/generate-pdf`);
    
    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    // For now, return the HTML URL (can be printed as PDF)
    // In production, convert HTML to PDF using puppeteer or similar
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    return url;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  }
}

/**
 * Download invoice as PDF
 */
export async function downloadInvoicePDF(invoiceId: string, invoiceNumber: string) {
  try {
    const response = await fetch(`/api/billing/invoices/${invoiceId}/generate-pdf`);
    
    if (!response.ok) {
      throw new Error('Failed to generate PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}

/**
 * Print invoice
 */
export function printInvoice(invoiceId: string) {
  const printUrl = `/api/billing/invoices/${invoiceId}/generate-pdf`;
  const printWindow = window.open(printUrl, '_blank');
  
  if (printWindow) {
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 500); // Small delay to ensure content is loaded
    };
  } else {
    // Fallback: if popup blocked, open in same window
    window.location.href = printUrl;
    setTimeout(() => {
      window.print();
    }, 1000);
  }
}

