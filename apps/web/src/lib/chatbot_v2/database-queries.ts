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

interface ServicePlanParams {
  category: string;
  carModel: string;
  city: string;
}

export async function getPricing({ service, city, carModel, limit = 5 }: PricingParams) {
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

    // If we had a way to map carModel to class, we would filter here.
    // For now, we return all classes or rely on the service name matching.
    void carModel;

    if (error) {
      console.error('Error fetching pricing:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Unexpected error in getPricing:', err);
    return [];
  }
}

export async function getWorkshops({ city, limit = 5 }: WorkshopParams) {
  if (!supabase) return [];
  const DEFAULT_WORKSHOP_PHONE = '9152307030';

  try {
    // Check if input is a PIN code (6 digits)
    const isPincode = /^\d{6}$/.test(city);

    if (isPincode) {
      // Search for workshops that service this PIN code
      console.log(`[DB] Searching workshops by service PIN code: ${city}`);

      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, workshop_name, short_address, address, city, pincode, service_pincode, phone, working_time, map_link')
        .eq('is_verified', true)
        .ilike('service_pincode', `%${city}%`)
        .limit(limit);

      if (error) {
        console.error('Error fetching workshops:', error);
        return [];
      }

      console.log(`[DB] Found ${data?.length || 0} workshops for PIN ${city}`);
      return (data || []).map((w: any) => ({ ...w, phone: DEFAULT_WORKSHOP_PHONE }));
    }

    // Fuzzy city name match
    console.log(`[DB] Searching workshops by city name: ${city}`);

    const { data, error } = await supabase
      .from('workshops')
      .select('id, name, workshop_name, short_address, address, city, pincode, service_pincode, phone, working_time, map_link')
      .eq('is_verified', true)
      .ilike('city', `%${city}%`)
      .limit(limit);

    if (error) {
      console.error('Error fetching workshops:', error);
      return [];
    }

    return (data || []).map((w: any) => ({ ...w, phone: DEFAULT_WORKSHOP_PHONE }));
  } catch (err) {
    console.error('Unexpected error in getWorkshops:', err);
    return [];
  }
}

export async function getServicePlans({ category, carModel, city }: ServicePlanParams) {
  if (!supabase) return [];

  try {
    // We need to aggregate prices (min/max) for services within a category for a specific city.
    // We also need checklist items.
    console.log(`[DB] Fetching service plans for category: ${category}, car: ${carModel}, city: ${city}`);

    let targetCity = city;
    // Safety: If city is a PIN code, resolve it
    if (/^\d{6}$/.test(city)) {
      const cityData = await getCityByPincode(city);
      if (cityData) {
        targetCity = cityData.name;
        console.log(`[DB] Resolved PIN ${city} to City: ${targetCity}`);
      }
    }

    // Extract just the model name (remove make if present)
    const modelOnly = carModel
      .replace(
        /^(maruti|honda|hyundai|tata|mahindra|ford|toyota|nissan|renault|volkswagen|skoda|kia|mg|chevrolet|fiat|jeep|bmw|audi|mercedes|volvo)\s+/i,
        ''
      )
      .trim();

    // Remove spaces for flexible matching
    const modelNoSpaces = modelOnly.replace(/\s+/g, '');
    console.log(`[DB] Searching for model: "${modelOnly}" (normalized: "${modelNoSpaces}")`);

    let pricingData: any[] | null = null;
    let targetClass: string | null = null;

    // Try calling the RPC function first
    try {
      const { data, error } = await supabase.rpc('get_service_pricing_by_car', {
        p_model_search: modelOnly,
        p_model_normalized: modelNoSpaces,
        p_city: targetCity,
      });

      if (error) {
        console.warn(`[DB] RPC 'get_service_pricing_by_car' failed: ${error.message}. Falling back to manual JOIN query.`);
      } else if (data && data.length > 0) {
        pricingData = data;
        targetClass = data[0].class; // Assuming class is returned by RPC
        console.log(`[DB] Pricing data fetched successfully via RPC. Total records: ${pricingData?.length || 0}`);
      } else {
        console.log(`[DB] RPC 'get_service_pricing_by_car' returned no data. Falling back to manual JOIN query.`);
      }
    } catch (rpcError) {
      console.warn(`[DB] Error calling RPC 'get_service_pricing_by_car': ${rpcError}. Falling back to manual JOIN query.`);
    }

    // If RPC didn't work or returned no data, use manual JOIN query
    if (!pricingData) {
      console.log('[DB] Using manual JOIN query...');

      // Get all cars to find the right one (with space-insensitive matching)
      const { data: allCars, error: carError } = await supabase.from('car_models').select('class, make, model_name');

      if (carError) {
        console.error('[DB] Error fetching car models:', carError);
        return [];
      }

      // Search in both make and model_name for flexible matching
      const carMatches =
        allCars?.filter((car) => {
          const makeMatch =
            car.make.toLowerCase().includes(modelOnly.toLowerCase()) ||
            car.make.replace(/\s+/g, '').toLowerCase().includes(modelNoSpaces.toLowerCase());
          const modelMatch =
            car.model_name.toLowerCase().includes(modelOnly.toLowerCase()) ||
            car.model_name.replace(/\s+/g, '').toLowerCase().includes(modelNoSpaces.toLowerCase());
          const fullMatch = `${car.make} ${car.model_name}`.toLowerCase().includes(carModel.toLowerCase());

          return makeMatch || modelMatch || fullMatch;
        }) || [];

      console.log(`[DB] Found ${carMatches.length} car matches for "${carModel}"`);

      if (carMatches.length === 0) {
        console.warn(`[DB] No car found for ${carModel}`);
        return [
          {
            error: 'CAR_NOT_FOUND',
            message: `I couldn't find "${carModel}" in our database. Please provide a valid car model (e.g., Swift, City, Nexon, i10, etc.)`,
          },
        ] as any;
      }

      if (carMatches.length > 1) {
        // Multiple matches - check if they're all the same class
        const uniqueClasses = Array.from(new Set(carMatches.map((c) => c.class)));

        if (uniqueClasses.length === 1) {
          // All matches have same class, use the first one
          targetClass = carMatches[0].class;
          console.log(`[DB] Multiple matches but same class: ${targetClass}`);
        } else {
          // Different classes - need user to clarify
          console.warn(`[DB] Multiple car matches with different classes for ${carModel}`);
          return [
            {
              error: 'MULTIPLE_MATCHES',
              message:
                `I found multiple models matching "${carModel}". Please specify:\n\n` +
                carMatches
                  .slice(0, 10)
                  .map((c, i) => `${i + 1}. ${c.make} ${c.model_name}`)
                  .join('\n'),
              matches: carMatches.slice(0, 10),
            },
          ] as any;
        }
      } else {
        // Single match - perfect!
        targetClass = carMatches[0].class;
        console.log(`[DB] Found car: ${carMatches[0].make} ${carMatches[0].model_name} (${targetClass})`);
      }

      // First, find the category UUID from the category name
      const { data: categoryData } = await supabase
        .from('categories')
        .select('uuid, category')
        .ilike('category', `%${category}%`)
        .limit(1)
        .single();

      if (!categoryData) {
        console.warn(`[DB] Category not found: ${category}`);
        return [];
      }

      console.log(`[DB] Found category: ${categoryData.category} (${categoryData.uuid})`);

      // Now get pricing for this specific class, city, and category
      const { data: pricing, error: pricingError } = await supabase
        .from('workshop_service_pricing')
        .select(`
                    custom_price,
                    class,
                    service_types!inner (
                        id,
                        name,
                        description,
                        category_uuid
                    ),
                    workshops!inner (
                        city,
                        pincode
                    )
                `)
        .eq('is_active', true)
        .eq('class', targetClass)
        .eq('service_types.category_uuid', categoryData.uuid)
        .ilike('workshops.city', `%${targetCity}%`);

      if (pricingError) {
        console.error('[DB] Error fetching pricing:', pricingError);
        return [];
      }

      pricingData = pricing;
      console.log(`[DB] Found ${pricingData?.length || 0} pricing records for ${targetClass} in ${city}`);

      // DEBUG: Log first few records to see what we got
      if (pricingData && pricingData.length > 0) {
        console.log('[DB] Sample pricing record:', JSON.stringify(pricingData[0], null, 2));
      } else {
        console.log('[DB] No pricing data returned from query');
        console.log('[DB] Query params: class=', targetClass, ', city=', targetCity);
      }
    }

    if (!pricingData || pricingData.length === 0) {
      console.warn(`[DB] No pricing data found for ${carModel} in ${targetCity}`);
      return [];
    }

    // Data is already filtered by category_uuid in the query, no need for additional filtering
    const matches = pricingData;
    console.log(`[DB] Found ${matches.length} services in category "${category}"`);

    if (matches.length === 0) {
      // No services found for this city
      // Show available cities instead
      console.log(`[DB] No services found for ${targetCity}, fetching available cities...`);

      const { data: availableCities } = await supabase.from('workshops').select('city').eq('is_active', true);

      if (availableCities && availableCities.length > 0) {
        // Get unique cities and sort
        const uniqueCities = Array.from(new Set(availableCities.map((w: any) => w.city)))
          .filter((c: any) => c && c.trim())
          .sort();

        return [
          {
            error: 'NO_SERVICE_IN_CITY',
            message:
              `We don't operate in ${targetCity} yet.\n\nWe're currently available in:\n${uniqueCities
                .map((c: any) => `• ${c}`)
                .join('\n')}\n\nPlease choose one of these cities.`,
            available_cities: uniqueCities,
            requested_city: targetCity,
          },
        ] as any;
      }

      return [];
    }

    // Group by service type and take the MINIMUM price (most competitive)
    const grouped = new Map();

    for (const item of matches) {
      const serviceType = Array.isArray(item.service_types) ? item.service_types[0] : item.service_types;
      const sId = serviceType.id;

      if (!grouped.has(sId)) {
        grouped.set(sId, {
          service_name: serviceType.name,
          description: serviceType.description,
          min_price: item.custom_price,
          max_price: item.custom_price, // Set both to same value for exact pricing
          service_type_id: sId,
        });
      } else {
        const group = grouped.get(sId);
        const minPrice = Math.min(group.min_price, item.custom_price);
        group.min_price = minPrice;
        group.max_price = minPrice; // Keep them the same to show exact price
      }
    }

    const plans = Array.from(grouped.values());

    // Now fetch checklists for these service types
    const serviceTypeIds = plans.map((p: any) => p.service_type_id);

    const { data: checklistData } = await supabase
      .from('service_type_checklist_templates')
      .select('service_type_id, checklist_items')
      .in('service_type_id', serviceTypeIds);

    const checklistMap = new Map();
    if (checklistData) {
      checklistData.forEach((item: any) => {
        checklistMap.set(item.service_type_id, item.checklist_items);
      });
    }

    // Combine
    return plans.map((plan: any) => ({
      ...plan,
      checklist_items: checklistMap.get(plan.service_type_id) || [],
    }));
  } catch (err) {
    console.error('Unexpected error in getServicePlans:', err);
    return [];
  }
}

export async function getServicePlansByPincode({ category, carModel, pincode }: ServicePlanByPincodeParams) {
  if (!supabase) return [];

  try {
    console.log(`[DB] Fetching service plans for category: ${category}, car: ${carModel}, PIN: ${pincode}`);

    const modelOnly = carModel
      .replace(
        /^(maruti|honda|hyundai|tata|mahindra|ford|toyota|nissan|renault|volkswagen|skoda|kia|mg|chevrolet|fiat|jeep|bmw|audi|mercedes|volvo)\s+/i,
        ''
      )
      .trim();
    const modelNoSpaces = modelOnly.replace(/\s+/g, '');
    console.log(`[DB] Searching for model: "${modelOnly}" (normalized: "${modelNoSpaces}")`);

    const { data: allCars, error: carError } = await supabase.from('car_models').select('class, make, model_name');
    if (carError) {
      console.error('[DB] Error fetching car models:', carError);
      return [];
    }

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

    console.log(`[DB] Found ${carMatches.length} car matches for "${carModel}"`);

    if (carMatches.length === 0) {
      return [
        {
          error: 'CAR_NOT_FOUND',
          message: `I couldn't find "${carModel}" in our database. Please provide a valid car model (e.g., Swift, City, Nexon, i10, etc.)`,
        },
      ] as any;
    }

    let targetClass: string;
    if (carMatches.length > 1) {
      const uniqueClasses = Array.from(new Set(carMatches.map((c: any) => c.class)));
      if (uniqueClasses.length === 1) {
        targetClass = carMatches[0].class;
        console.log(`[DB] Multiple matches but same class: ${targetClass}`);
      } else {
        return [
          {
            error: 'MULTIPLE_MATCHES',
            message:
              `I found multiple models matching "${carModel}". Please specify:\n\n` +
              carMatches
                .slice(0, 10)
                .map((c: any, i: number) => `${i + 1}. ${c.make} ${c.model_name}`)
                .join('\n'),
            matches: carMatches.slice(0, 10),
          },
        ] as any;
      }
    } else {
      targetClass = carMatches[0].class;
      console.log(`[DB] Found car: ${carMatches[0].make} ${carMatches[0].model_name} (${targetClass})`);
    }

    // Step 2: Find workshops that service this PIN code
    const { data: workshops, error: workshopError } = await supabase
      .from('workshops')
      .select('id, name, pincode, service_pincode')
      .eq('is_verified', true)
      .ilike('service_pincode', `%${pincode}%`);
    if (workshopError) {
      console.error('[DB] Error fetching workshops:', workshopError);
      return [];
    }

    if (!workshops || workshops.length === 0) {
      console.log(`[DB] No workshops service PIN code ${pincode}`);
      return [
        {
          error: 'NO_WORKSHOPS_FOR_PIN',
          message: `We don't have workshops servicing PIN code ${pincode} yet. Please try a nearby PIN code.`,
        },
      ] as any;
    }

    const workshopIds = workshops.map((w: any) => w.id);
    console.log(
      `[DB] Found ${workshops.length} workshops servicing PIN ${pincode}:`,
      workshops.map((w: any) => w.name).join(', ')
    );

    // Step 3: Find category UUID
    const { data: categoryData } = await supabase
      .from('categories')
      .select('uuid, category')
      .ilike('category', `%${category}%`)
      .limit(1)
      .single();
    if (!categoryData) {
      console.warn(`[DB] Category not found: ${category}`);
      return [];
    }

    console.log(`[DB] Found category: ${categoryData.category} (${categoryData.uuid})`);

    // Step 4: Get pricing ONLY from workshops that service this PIN
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
    if (pricingError) {
      console.error('[DB] Error fetching pricing:', pricingError);
      return [];
    }

    if (!pricing || pricing.length === 0) {
      console.warn(`[DB] No pricing data found for ${carModel} (${targetClass}) from workshops servicing PIN ${pincode}`);
      return [];
    }

    console.log(`[DB] Found ${pricing.length} pricing records for ${targetClass} from PIN ${pincode} workshops`);

    // Step 5: Group by service type and get minimum price
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

    // Step 6: Fetch checklists
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
  } catch (err) {
    console.error('Unexpected error in getServicePlansByPincode:', err);
    return [];
  }
}

export async function getCityByPincode(pincode: string) {
  if (!supabase) return null;
  try {
    console.log(`[DB] Resolving city for PIN code: ${pincode}`);
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .ilike('city_pincodes', `%${pincode}%`)
      .eq('is_active', true)
      .limit(1)
      .single();
    if (error) {
      console.warn(`[DB] No city found for PIN ${pincode}:`, error.message);
      return null;
    }
    return data || null; // Returns { id, name }
  } catch (err) {
    console.error('Unexpected error in getCityByPincode:', err);
    return null;
  }
}

export async function getCityByName(cityName: string) {
  if (!supabase) return null;

  try {
    console.log(`[DB] Looking up city by name: ${cityName}`);
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .ilike('name', `%${cityName}%`)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (error) {
      console.warn(`[DB] City not found by name ${cityName}:`, error.message);
      return null;
    }

    return data || null;
  } catch (err) {
    console.error('Unexpected error in getCityByName:', err);
    return null;
  }
}
