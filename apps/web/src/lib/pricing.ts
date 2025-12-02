// Pricing utility functions for TypeScript
// These functions implement the same priority logic as PostgreSQL functions

export interface PricingResult {
  price: number;
  source: 'class_zone' | 'class' | 'zone' | 'workshop_default' | 'master_default';
  metadata?: {
    workshopId: string;
    class?: string | null;
    zoneId?: string | null;
  };
}

/**
 * Get Service Type price based on workshop, class, and zone
 * Priority: Workshop+Class+Zone > Workshop+Class > Workshop+Zone > Workshop Default > 0
 */
export async function getServicePrice(
  supabase: any,
  workshopId: string,
  serviceTypeId: string,
  vehicleClass: string | null = null,
  zoneId: string | null = null
): Promise<PricingResult> {
  // Priority 1: Workshop + Service Type + Class + Zone
  if (vehicleClass && zoneId) {
    const { data } = await supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('workshop_id', workshopId)
      .eq('service_type_id', serviceTypeId)
      .eq('class', vehicleClass)
      .eq('zone_id', zoneId)
      .single();
    
    if (data?.custom_price) {
      return {
        price: data.custom_price,
        source: 'class_zone',
        metadata: { workshopId, class: vehicleClass, zoneId }
      };
    }
  }

  // Priority 2: Workshop + Service Type + Class (zone = NULL)
  if (vehicleClass) {
    const { data } = await supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('workshop_id', workshopId)
      .eq('service_type_id', serviceTypeId)
      .eq('class', vehicleClass)
      .is('zone_id', null)
      .single();
    
    if (data?.custom_price) {
      return {
        price: data.custom_price,
        source: 'class',
        metadata: { workshopId, class: vehicleClass }
      };
    }
  }

  // Priority 3: Workshop + Service Type + Zone (class = NULL)
  if (zoneId) {
    const { data } = await supabase
      .from('workshop_service_pricing')
      .select('custom_price')
      .eq('workshop_id', workshopId)
      .eq('service_type_id', serviceTypeId)
      .is('class', null)
      .eq('zone_id', zoneId)
      .single();
    
    if (data?.custom_price) {
      return {
        price: data.custom_price,
        source: 'zone',
        metadata: { workshopId, zoneId }
      };
    }
  }

  // Priority 4: Workshop Default (both NULL)
  const { data } = await supabase
    .from('workshop_service_pricing')
    .select('custom_price')
    .eq('workshop_id', workshopId)
    .eq('service_type_id', serviceTypeId)
    .is('class', null)
    .is('zone_id', null)
    .single();

  if (data?.custom_price) {
    return {
      price: data.custom_price,
      source: 'workshop_default',
      metadata: { workshopId }
    };
  }

  // Priority 5: Return 0 (no default price in service_types table)
  return {
    price: 0,
    source: 'master_default',
    metadata: { workshopId }
  };
}

/**
 * Get Product price based on workshop, class, and zone
 * Priority: Workshop+Class+Zone > Workshop+Class > Workshop+Zone > Workshop Default > Master Default
 */
export async function getProductPrice(
  supabase: any,
  workshopId: string,
  productId: string,
  vehicleClass: string | null = null,
  zoneId: string | null = null
): Promise<PricingResult> {
  // Priority 1: Workshop + Product + Class + Zone
  if (vehicleClass && zoneId) {
    const { data } = await supabase
      .from('workshop_product_pricing')
      .select('selling_price')
      .eq('workshop_id', workshopId)
      .eq('product_id', productId)
      .eq('class', vehicleClass)
      .eq('zone_id', zoneId)
      .single();
    
    if (data?.selling_price) {
      return {
        price: data.selling_price,
        source: 'class_zone',
        metadata: { workshopId, class: vehicleClass, zoneId }
      };
    }
  }

  // Priority 2: Workshop + Product + Class (zone = NULL)
  if (vehicleClass) {
    const { data } = await supabase
      .from('workshop_product_pricing')
      .select('selling_price')
      .eq('workshop_id', workshopId)
      .eq('product_id', productId)
      .eq('class', vehicleClass)
      .is('zone_id', null)
      .single();
    
    if (data?.selling_price) {
      return {
        price: data.selling_price,
        source: 'class',
        metadata: { workshopId, class: vehicleClass }
      };
    }
  }

  // Priority 3: Workshop + Product + Zone (class = NULL)
  if (zoneId) {
    const { data } = await supabase
      .from('workshop_product_pricing')
      .select('selling_price')
      .eq('workshop_id', workshopId)
      .eq('product_id', productId)
      .is('class', null)
      .eq('zone_id', zoneId)
      .single();
    
    if (data?.selling_price) {
      return {
        price: data.selling_price,
        source: 'zone',
        metadata: { workshopId, zoneId }
      };
    }
  }

  // Priority 4: Workshop Default (both NULL)
  const { data: workshopData } = await supabase
    .from('workshop_product_pricing')
    .select('selling_price')
    .eq('workshop_id', workshopId)
    .eq('product_id', productId)
    .is('class', null)
    .is('zone_id', null)
    .single();

  if (workshopData?.selling_price) {
    return {
      price: workshopData.selling_price,
      source: 'workshop_default',
      metadata: { workshopId }
    };
  }

  // Priority 5: Master Product Default
  const { data: productData } = await supabase
    .from('master_products')
    .select('default_price')
    .eq('id', productId)
    .single();

  return {
    price: productData?.default_price || 0,
    source: 'master_default',
    metadata: { workshopId }
  };
}

