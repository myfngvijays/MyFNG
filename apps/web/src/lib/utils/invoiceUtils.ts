/**
 * Invoice Utility Functions
 * Helper functions for invoice generation
 */

/**
 * Convert number to words (Indian numbering system)
 */
export function numberToWords(amount: number): string {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertHundreds(num: number): string {
    let result = '';
    
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    
    if (num > 0) {
      result += ones[num] + ' ';
    }
    
    return result.trim();
  }

  if (amount === 0) return 'Zero Rupees Only';

  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = '';

  // Crores
  if (rupees >= 10000000) {
    const crores = Math.floor(rupees / 10000000);
    words += convertHundreds(crores) + 'Crore ';
    rupees %= 10000000;
  }

  // Lakhs
  if (rupees >= 100000) {
    const lakhs = Math.floor(rupees / 100000);
    words += convertHundreds(lakhs) + 'Lakh ';
    rupees %= 100000;
  }

  // Thousands
  if (rupees >= 1000) {
    const thousands = Math.floor(rupees / 1000);
    words += convertHundreds(thousands) + 'Thousand ';
    rupees %= 1000;
  }

  // Hundreds, Tens, Ones
  if (rupees > 0) {
    words += convertHundreds(rupees);
  }

  words = words.trim() + ' Rupees';

  if (paise > 0) {
    words += ' and ' + convertHundreds(paise) + 'Paise';
  }

  return words + ' Only';
}

/**
 * Generate invoice number in format: INV-YYYY-NNNNNN
 */
export function generateInvoiceNumber(year?: number): string {
  const currentYear = year || new Date().getFullYear();
  const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `INV-${currentYear}-${randomNum}`;
}

/**
 * Get HSN/SAC code for service type
 */
export function getHSNCode(serviceType: string, isService: boolean = true): string {
  // HSN codes for services (SAC - Service Accounting Code)
  const serviceCodes: Record<string, string> = {
    'periodic_service': '998729', // Maintenance and repair services
    'ac_service': '998714', // AC service
    'battery_replacement': '8507', // Battery
    'tyre_replacement': '4011', // Tyres
    'brake_service': '998729', // Brake service
    'engine_oil': '271019', // Engine oil
    'oil_filter': '842123', // Oil filter
    'alignment': '998729', // Wheel alignment
  };

  // HSN codes for parts
  const partCodes: Record<string, string> = {
    'engine_oil': '271019',
    'oil_filter': '842123',
    'air_filter': '842131',
    'fuel_filter': '842123',
    'spark_plug': '8511',
    'brake_pad': '8708',
    'brake_disc': '8708',
    'battery': '8507',
    'tyre': '4011',
  };

  if (isService) {
    return serviceCodes[serviceType.toLowerCase()] || '998729';
  } else {
    return partCodes[serviceType.toLowerCase()] || '8708';
  }
}

/**
 * Determine place of supply and tax type
 */
export function getPlaceOfSupply(
  customerState: string,
  customerStateCode: string,
  workshopState: string,
  workshopStateCode: string
): {
  placeOfSupply: string;
  stateCode: string;
  useIGST: boolean;
} {
  // If customer and workshop are in same state, use CGST + SGST
  // Otherwise, use IGST
  const sameState = customerStateCode === workshopStateCode;

  return {
    placeOfSupply: customerState || 'Maharashtra',
    stateCode: customerStateCode || '27',
    useIGST: !sameState,
  };
}

/**
 * Calculate taxes (CGST + SGST or IGST)
 */
export function calculateTaxes(
  taxableAmount: number,
  useIGST: boolean,
  cgstRate: number = 9,
  sgstRate: number = 9,
  igstRate: number = 18
): {
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
} {
  if (useIGST) {
    const igstAmount = (taxableAmount * igstRate) / 100;
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: igstAmount,
      totalTax: igstAmount,
    };
  } else {
    const cgstAmount = (taxableAmount * cgstRate) / 100;
    const sgstAmount = (taxableAmount * sgstRate) / 100;
    return {
      cgstAmount: cgstAmount,
      sgstAmount: sgstAmount,
      igstAmount: 0,
      totalTax: cgstAmount + sgstAmount,
    };
  }
}

/**
 * Round off amount
 */
export function roundOff(amount: number): number {
  return Math.round(amount);
}

