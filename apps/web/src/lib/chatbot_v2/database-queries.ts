import { supabase } from './supabase';
import { filterWorkshopsForPincode } from '../whatsappBotFlow/workshopPincode';
import { rankWorkshopsByDistance } from '../whatsappBotFlow/pincodeGeo';
import {
  fetchServicePriceForBooking,
  matchCategoryRow,
} from '../servicePricing';
import {
  isPremiumLuxuryClass,
  PREMIUM_LUXURY_PRICING_MESSAGE,
} from '../vehicleClassPricing';

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
  /** Lead / link city name — breaks ties when a PIN is listed under more than one city. */
  cityHint?: string | null;
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
      console.log(`[DB] Searching workshops by service PIN code: ${city}`);

      const { data, error } = await supabase
        .from('workshops')
        .select(
          'id, name, workshop_name, short_address, address, city, pincode, service_pincode, mapping_pincodes, latitude, longitude, phone, working_time, map_link, near_area_google_map'
        )
        .eq('is_verified', true)
        .eq('is_active', true)
        .limit(200);

      if (error) {
        console.error('Error fetching workshops:', error);
        return [];
      }

      const matched = await rankWorkshopsByDistance(data || [], city, limit);
      console.log(
        `[DB] Found ${matched.length} nearest workshops for PIN ${city}:`,
        matched.map((w: any) => `${w.workshop_name || w.name} ${w.distance_km ?? '?'}km`).join(', '),
      );
      return matched.map((w: any) => ({ ...w, phone: DEFAULT_WORKSHOP_PHONE }));
    }

    // Fuzzy city name match
    console.log(`[DB] Searching workshops by city name: ${city}`);

    const { data, error } = await supabase
      .from('workshops')
      .select('id, name, workshop_name, short_address, address, city, pincode, service_pincode, phone, working_time, map_link, near_area_google_map')
      .eq('is_verified', true)
      .eq('is_active', true)
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
      if (isPremiumLuxuryClass(targetClass)) {
        return [
          {
            error: 'PREMIUM_LUXURY_NO_PRICING',
            message: PREMIUM_LUXURY_PRICING_MESSAGE,
            vehicle_class: targetClass,
          },
        ] as any;
      }
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

export async function getServicePlansByPincode({ category, carModel, pincode, cityHint }: ServicePlanByPincodeParams) {
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

    // "MARUTI SWIFT" also substring-matches "Swift Dzire" (different class) → MULTIPLE_MATCHES and no
    // prices at all. When the name matches one model exactly (with or without the make), use only that.
    const norm = (v: unknown) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const wantedFull = norm(carModel);
    const wantedModel = norm(modelOnly);
    const exactMatches = carMatches.filter(
      (car: any) =>
        norm(`${car.make || ''}${car.model_name || ''}`) === wantedFull ||
        norm(car.model_name) === wantedFull ||
        norm(car.model_name) === wantedModel,
    );
    if (exactMatches.length > 0 && exactMatches.length < carMatches.length) {
      console.log(`[DB] Narrowed to ${exactMatches.length} exact match(es) for "${carModel}"`);
      carMatches.splice(0, carMatches.length, ...exactMatches);
    }

    // Old/alternate names ("SWIFT DZIRE" → DZIRE, "DZIRE TOUR" → DZIRE): no model contains the full
    // name, so fall back to a model whose name is the last word(s) of what was typed.
    if (carMatches.length === 0 && modelOnly) {
      const typed = modelOnly.toLowerCase().replace(/\s+/g, ' ').trim();
      const tail = allCars.filter((car: any) => {
        const name = String(car.model_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        return name.length >= 3 && (typed.endsWith(` ${name}`) || typed.startsWith(`${name} `));
      });
      if (tail.length > 0) {
        // Prefer the model at the end of the name ("swift dzire" → dzire, not swift).
        const ending = tail.filter((car: any) =>
          typed.endsWith(` ${String(car.model_name || '').toLowerCase().replace(/\s+/g, ' ').trim()}`),
        );
        const picked = ending.length > 0 ? ending : tail;
        console.log(`[DB] No direct match for "${carModel}", using ${picked.map((c: any) => c.model_name).join(', ')}`);
        carMatches.push(...picked);
      }
    }

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

    // Step 2: Resolve city + zone from PIN (same source as book-service / app)
    const cityData = await getCityByPincode(pincode, cityHint);
    let cityId = cityData?.id ? String(cityData.id) : null;
    let zoneId: string | null = null;

    if (cityId) {
      const { data: cityRow } = await supabase
        .from('cities')
        .select('zone_id')
        .eq('id', cityId)
        .maybeSingle();
      zoneId = String((cityRow as any)?.zone_id || '').trim() || null;
    } else if (cityData?.name) {
      const { data: cityRow } = await supabase
        .from('cities')
        .select('id, zone_id')
        .ilike('name', `%${cityData.name}%`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      cityId = String((cityRow as any)?.id || '').trim() || null;
      zoneId = String((cityRow as any)?.zone_id || '').trim() || null;
    }

    // Soft check: PIN should be serviceable, but don't block pricing if city resolved
    const { data: workshopCandidates } = await supabase
      .from('workshops')
      .select('id, name, pincode, service_pincode, mapping_pincodes, city')
      .eq('is_verified', true)
      .eq('is_active', true);
    const workshops = filterWorkshopsForPincode(workshopCandidates || [], pincode);

    if (!cityId && (!workshops || workshops.length === 0)) {
      console.log(`[DB] No city or workshops for PIN code ${pincode}`);
      return [
        {
          error: 'NO_WORKSHOPS_FOR_PIN',
          message: `We don't have workshops servicing PIN code ${pincode} yet. Please try a nearby PIN code.`,
        },
      ] as any;
    }

    if (workshops.length > 0) {
      console.log(
        `[DB] PIN ${pincode} serviced by ${workshops.length} workshop(s):`,
        workshops.map((w: any) => w.name).join(', '),
      );
    }

    // Step 3: Match category (handles "Electrical & Battery Service" ↔ "ELECTRICAL & BATTERY SERVICE")
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('uuid, category');
    if (categoryError) {
      console.error('[DB] Error fetching categories:', categoryError);
      return [];
    }

    const categoryData = matchCategoryRow(category, categoryRows || []);
    if (!categoryData) {
      console.warn(`[DB] Category not found: ${category}`);
      return [];
    }

    console.log(`[DB] Found category: ${categoryData.category} (${categoryData.uuid})`);

    // Step 4: Load active services in this category
    const { data: serviceTypes, error: serviceError } = await supabase
      .from('service_types')
      .select('id, name, description')
      .eq('category_uuid', categoryData.uuid)
      .eq('is_active', true)
      .order('name');

    if (serviceError) {
      console.error('[DB] Error fetching service types:', serviceError);
      return [];
    }

    if (!serviceTypes?.length) {
      console.warn(`[DB] No active services in category ${categoryData.category}`);
      return [];
    }

    // Step 5: Resolve prices in parallel (was sequential — very slow for large catalogues)
    const priced = await Promise.all(
      serviceTypes.map(async (svc) => {
        const price = await fetchServicePriceForBooking(
          supabase,
          svc.id,
          cityId,
          zoneId,
          targetClass,
        );
        if (!(price > 0)) return null;
        return {
          service_name: svc.name,
          description: svc.description,
          min_price: price,
          max_price: price,
          service_type_id: svc.id,
        };
      }),
    );
    const plans = priced.filter(Boolean) as any[];

    if (plans.length === 0) {
      if (isPremiumLuxuryClass(targetClass)) {
        return [
          {
            error: 'PREMIUM_LUXURY_NO_PRICING',
            message: PREMIUM_LUXURY_PRICING_MESSAGE,
            vehicle_class: targetClass,
          },
        ] as any;
      }
      console.warn(
        `[DB] No pricing for category ${categoryData.category}, class ${targetClass}, PIN ${pincode}, city ${cityId || cityData?.name || 'unknown'}`,
      );
      return [];
    }

    console.log(`[DB] Found ${plans.length} priced services for ${categoryData.category} (PIN ${pincode})`);

    // Step 6: Fetch checklists
    const serviceTypeIds = plans.map((p: any) => p.service_type_id);
    const { data: checklistData } = await supabase
      .from('service_type_checklist_templates')
      .select('service_type_id, checklist_items, points')
      .in('service_type_id', serviceTypeIds);

    const checklistMap = new Map<string, { items: any[]; points: number | null }>();
    (checklistData || []).forEach((item: any) => {
      const items = Array.isArray(item.checklist_items) ? item.checklist_items : [];
      const points = typeof item.points === 'number' ? item.points : items.length > 0 ? items.length : null;
      checklistMap.set(item.service_type_id, { items, points });
    });

    return plans.map((plan: any) => {
      const checklist = checklistMap.get(plan.service_type_id);
      return {
        ...plan,
        checklist_items: checklist?.items || [],
        points: checklist?.points ?? null,
      };
    });
  } catch (err) {
    console.error('Unexpected error in getServicePlansByPincode:', err);
    return [];
  }
}

/** Pick one city for a PIN: exact PIN token match, then the hinted city name. Logs when a PIN is in 2+ cities. */
function pickCityForPincode(
  rows: Array<{ id: string; name: string; city_pincodes?: string | null }>,
  pincode: string,
  cityHint?: string | null,
) {
  const pin = String(pincode || '').replace(/\D/g, '');
  const exact = rows.filter((row) =>
    String(row.city_pincodes || '')
      .split(/[^0-9]+/)
      .some((token) => token === pin),
  );
  const pool = exact.length ? exact : rows;
  if (pool.length > 1) {
    console.warn(
      `[DB] PIN ${pin} is listed under ${pool.length} cities: ${pool.map((r) => r.name).join(', ')} — fix City Pincodes`,
    );
  }
  const hint = String(cityHint || '').trim().toLowerCase();
  if (hint && pool.length > 1) {
    const byName =
      pool.find((r) => String(r.name || '').trim().toLowerCase() === hint) ||
      pool.find((r) => String(r.name || '').toLowerCase().includes(hint) || hint.includes(String(r.name || '').toLowerCase()));
    if (byName) return { id: byName.id, name: byName.name };
  }
  // Stable order (by name) so the same PIN never flips between cities.
  const picked = [...pool].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))[0];
  return picked ? { id: picked.id, name: picked.name } : null;
}

export async function getCityByPincode(pincode: string, cityHint?: string | null) {
  if (!supabase) return null;
  try {
    console.log(`[DB] Resolving city for PIN code: ${pincode}`);
    const { data: rows, error } = await supabase
      .from('cities')
      .select('id, name, city_pincodes')
      .ilike('city_pincodes', `%${pincode}%`)
      .eq('is_active', true)
      .limit(20);
    const data = pickCityForPincode((rows || []) as any[], pincode, cityHint);
    if (data) return data;

    if (error) {
      console.warn(`[DB] No city found for PIN ${pincode}:`, error.message);
    }

    const { data: workshopCandidates } = await supabase
      .from('workshops')
      .select('id, city, service_pincode, mapping_pincodes')
      .eq('is_verified', true)
      .eq('is_active', true);

    const matchedWorkshop = filterWorkshopsForPincode(workshopCandidates || [], pincode)[0];
    if (!matchedWorkshop?.city) return null;

    const cityName = String(matchedWorkshop.city || '').trim();
    const { data: cityByWorkshop } = await supabase
      .from('cities')
      .select('id, name')
      .ilike('name', `%${cityName}%`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (cityByWorkshop) return cityByWorkshop;

    return { id: null, name: cityName };
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

export async function resolveVehicleClassFromModelName(carModel: string): Promise<string | null> {
  if (!supabase || !String(carModel || '').trim()) return null;

  const modelOnly = carModel
    .replace(
      /^(maruti|honda|hyundai|tata|mahindra|ford|toyota|nissan|renault|volkswagen|skoda|kia|mg|chevrolet|fiat|jeep|bmw|audi|mercedes|volvo|jaguar)\s+/i,
      '',
    )
    .trim();
  const modelNoSpaces = modelOnly.replace(/\s+/g, '');

  const { data: allCars, error } = await supabase.from('car_models').select('class, make, model_name');
  if (error || !allCars?.length) return null;

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

  if (carMatches.length === 0) return null;
  const uniqueClasses = Array.from(new Set(carMatches.map((c: any) => c.class).filter(Boolean)));
  if (uniqueClasses.length === 1) return String(uniqueClasses[0]);
  return String(carMatches[0]?.class || '') || null;
}
