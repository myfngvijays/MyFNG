import { supabase } from './supabase';

interface PricingParams {
  service: string;
  city: string;
  carModel?: string;
  limit?: number;
}

interface WorkshopParams {
  city: string;
  limit?: number;
}

interface ServicePlanByPincodeParams {
  category: string;
  carModel: string;
  pincode: string;
}

export async function getPricing({ service, city, limit = 5 }: PricingParams) {
  if (!supabase) return [];

  try {
    let targetCity = city;
    if (/^\d{6}$/.test(city)) {
      const cityData = await getCityByPincode(city);
      if (cityData) targetCity = cityData.name;
    }

    const { data, error } = await supabase
      .from('workshop_pricing_readable')
      .select('*')
      .ilike('city_name', `%${targetCity}%`)
      .ilike('service_name', `%${service}%`)
      .order('custom_price', { ascending: true })
      .limit(limit);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function getWorkshops({ city, limit = 5 }: WorkshopParams) {
  if (!supabase) return [];

  try {
    if (/^\d{6}$/.test(city)) {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, workshop_name, short_address, address, city, pincode, service_pincode, phone, working_time, map_link')
        .eq('is_verified', true)
        .ilike('service_pincode', `%${city}%`)
        .limit(limit);
      if (error) return [];
      return data || [];
    }

    const { data, error } = await supabase
      .from('workshops')
      .select('id, name, workshop_name, short_address, address, city, pincode, service_pincode, phone, working_time, map_link')
      .eq('is_verified', true)
      .ilike('city', `%${city}%`)
      .limit(limit);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function getServicePlansByPincode({ category, carModel, pincode }: ServicePlanByPincodeParams) {
  if (!supabase) return [];

  try {
    const modelOnly = carModel
      .replace(
        /^(maruti|honda|hyundai|tata|mahindra|ford|toyota|nissan|renault|volkswagen|skoda|kia|mg|chevrolet|fiat|jeep|bmw|audi|mercedes|volvo)\s+/i,
        ''
      )
      .trim();
    const modelNoSpaces = modelOnly.replace(/\s+/g, '');

    const { data: allCars, error: carError } = await supabase.from('car_models').select('class, make, model_name');
    if (carError || !allCars?.length) return [];

    const carMatches =
      allCars.filter((car: any) => {
        const makeMatch =
          String(car.make || '')
            .toLowerCase()
            .includes(modelOnly.toLowerCase()) ||
          String(car.make || '')
            .replace(/\s+/g, '')
            .toLowerCase()
            .includes(modelNoSpaces.toLowerCase());
        const modelMatch =
          String(car.model_name || '')
            .toLowerCase()
            .includes(modelOnly.toLowerCase()) ||
          String(car.model_name || '')
            .replace(/\s+/g, '')
            .toLowerCase()
            .includes(modelNoSpaces.toLowerCase());
        const fullMatch = `${car.make || ''} ${car.model_name || ''}`.toLowerCase().includes(carModel.toLowerCase());
        return makeMatch || modelMatch || fullMatch;
      }) || [];

    if (carMatches.length === 0) {
      return [{ error: 'CAR_NOT_FOUND', message: `I couldn't find "${carModel}" in our database.` }] as any;
    }

    const uniqueClasses = Array.from(new Set(carMatches.map((c: any) => c.class)));
    if (uniqueClasses.length > 1) {
      return [
        {
          error: 'MULTIPLE_MATCHES',
          message: `I found multiple models matching "${carModel}". Please specify a more exact model.`,
          matches: carMatches.slice(0, 10),
        },
      ] as any;
    }
    const targetClass = String(carMatches[0].class || '');

    const { data: workshops, error: workshopError } = await supabase
      .from('workshops')
      .select('id')
      .eq('is_verified', true)
      .ilike('service_pincode', `%${pincode}%`);
    if (workshopError || !workshops?.length) {
      return [{ error: 'NO_WORKSHOPS_FOR_PIN', message: `No workshops service PIN ${pincode}.` }] as any;
    }
    const workshopIds = workshops.map((w: any) => w.id);

    const { data: categoryData } = await supabase
      .from('categories')
      .select('uuid, category')
      .ilike('category', `%${category}%`)
      .limit(1)
      .single();
    if (!categoryData?.uuid) return [];

    const { data: pricing, error: pricingError } = await supabase
      .from('workshop_service_pricing')
      .select(
        `
        custom_price,
        class,
        workshop_id,
        service_types!inner (
          id,
          name,
          description,
          category_uuid
        )
      `
      )
      .eq('is_active', true)
      .eq('class', targetClass)
      .eq('service_types.category_uuid', categoryData.uuid)
      .in('workshop_id', workshopIds);
    if (pricingError || !pricing?.length) return [];

    const grouped = new Map<string, any>();
    for (const item of pricing as any[]) {
      const serviceType = Array.isArray(item.service_types) ? item.service_types[0] : item.service_types;
      if (!serviceType?.id) continue;
      const existing = grouped.get(serviceType.id);
      if (!existing) {
        grouped.set(serviceType.id, {
          service_name: serviceType.name,
          description: serviceType.description,
          min_price: item.custom_price,
          max_price: item.custom_price,
          service_type_id: serviceType.id,
        });
      } else {
        const minPrice = Math.min(existing.min_price, item.custom_price);
        existing.min_price = minPrice;
        existing.max_price = minPrice;
      }
    }

    const plans = Array.from(grouped.values());
    const serviceTypeIds = plans.map((p: any) => p.service_type_id);
    const { data: checklistData } = await supabase
      .from('service_type_checklist_templates')
      .select('service_type_id, checklist_items')
      .in('service_type_id', serviceTypeIds);

    const checklistMap = new Map<string, any[]>();
    (checklistData || []).forEach((item: any) => {
      checklistMap.set(item.service_type_id, item.checklist_items || []);
    });

    return plans.map((plan: any) => ({
      ...plan,
      checklist_items: checklistMap.get(plan.service_type_id) || [],
    }));
  } catch {
    return [];
  }
}

export async function getCityByPincode(pincode: string) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .ilike('city_pincodes', `%${pincode}%`)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}
