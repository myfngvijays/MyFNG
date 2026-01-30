import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/car-models/search?q=query
 * 
 * Autocomplete endpoint for car models
 * Used by chatbot for car model suggestions
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const mode = (searchParams.get('mode') || 'model').toLowerCase(); // 'model' | 'make'

    const supabase = await createClient();

    const q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const parts = q.split(' ').filter(Boolean);
    const makePart = parts[0] || q;
    const modelPart = parts.slice(1).join(' ').trim();

    // Make-only mode (used for chips): return distinct makes matching query.
    if (mode === 'make') {
      // If query is empty/short, return popular/top makes (so chips show immediately).
      if ((q || '').length < 2) {
        const { data, error } = await supabase
          .from('car_models')
          .select('make')
          .eq('is_active', true)
          .order('make', { ascending: true })
          .limit(200);

        if (error) {
          console.error('Error fetching popular car makes:', error);
          return NextResponse.json({ error: 'Failed to fetch popular car makes' }, { status: 500 });
        }

        const makes = Array.from(
          new Set((data || []).map((r: any) => String(r.make || '').trim()).filter(Boolean))
        ).slice(0, 20);

        return NextResponse.json({ makes });
      }

      const runMakes = async (useActiveFilter: boolean) => {
        let base = supabase
          .from('car_models')
          .select('make')
          .order('make', { ascending: true })
          .limit(30);
        if (useActiveFilter) base = base.eq('is_active', true);
        return await base.ilike('make', `%${q}%`);
      };

      let { data, error } = await runMakes(true);
      if (!error && (!data || data.length === 0)) {
        const res2 = await runMakes(false);
        data = res2.data;
        error = res2.error;
      }

      if (error) {
        console.error('Error searching car makes:', error);
        return NextResponse.json({ error: 'Failed to search car makes' }, { status: 500 });
      }

      const makes = Array.from(
        new Set((data || []).map((r: any) => String(r.make || '').trim()).filter(Boolean))
      ).slice(0, 20);

      return NextResponse.json({ makes });
    }

    if (q.length < 2) {
      return NextResponse.json({ models: [] });
    }

    const run = async (useActiveFilter: boolean) => {
      let base = supabase
        .from('car_models')
        .select('id, make, model_name, variant, class')
        .order('make', { ascending: true })
        .order('model_name', { ascending: true })
        .limit(10);

      if (useActiveFilter) base = base.eq('is_active', true);

      if (parts.length >= 2 && makePart.length >= 2 && modelPart.length >= 2) {
        return await base.ilike('make', `%${makePart}%`).ilike('model_name', `%${modelPart}%`);
      }

      if (parts.length === 1) {
        return await base.or(`make.ilike.%${q}%,model_name.ilike.%${q}%`);
      }

      const orBits = parts.flatMap((tkn) => [`make.ilike.%${tkn}%`, `model_name.ilike.%${tkn}%`]).join(',');
      return await base.or(orBits);
    };

    let { data, error } = await run(true);
    if (!error && (!data || data.length === 0)) {
      const res2 = await run(false);
      data = res2.data;
      error = res2.error;
    }

    if (error) {
      console.error('Error searching car models:', error);
      return NextResponse.json({ error: 'Failed to search car models' }, { status: 500 });
    }

    return NextResponse.json({ 
      models: (data || []).map((car: any) => ({
        id: car.id,
        make: car.make,
        model: car.model_name,
        variant: car.variant || null,
        vehicleClass: car.class || null
      }))
    });
  } catch (error) {
    console.error('Car model search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
