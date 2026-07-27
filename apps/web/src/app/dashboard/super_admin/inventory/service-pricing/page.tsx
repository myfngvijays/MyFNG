'use client';

import React, { useState, useEffect } from 'react';
import { Save, Search, Store, Loader2, Car, MapPin, Copy, Building2, Download, Upload, X } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export default function ServiceTypePricingPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [zones, setZones] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Car Class State
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<string[]>(['DEFAULT']);

  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // CSV Import/Export Modal
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvOnlyOverrides, setCsvOnlyOverrides] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string>('');
  const [csvInfo, setCsvInfo] = useState<string>('');

  const supabase = getBrowserClient();
  const pricingBroadcastRef = React.useRef<any>(null);

  useEffect(() => {
    // Broadcast channel: used to notify other pages (e.g., supervisor job page) to refresh prices
    // even if Postgres realtime isn't enabled for pricing tables.
    const ch = supabase.channel('pricing-updates');
    ch.subscribe();
    pricingBroadcastRef.current = ch;
    return () => {
      try {
        supabase.removeChannel(ch);
      } catch {
        // ignore
      }
      pricingBroadcastRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const broadcastPricingUpdate = (payload: any) => {
    try {
      const ch = pricingBroadcastRef.current;
      if (!ch) return;
      ch.send({
        type: 'broadcast',
        event: 'workshop_service_pricing_updated',
        payload: { ...payload, at: new Date().toISOString() },
      });
    } catch {
      // non-blocking
    }
  };

  const escapeCsv = (value: any) => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const buildCsv = (headers: string[], rows: any[][]) => {
    const headerLine = headers.map(escapeCsv).join(',');
    const body = rows.map(r => r.map(escapeCsv).join(',')).join('\n');
    return `${headerLine}\n${body}\n`;
  };

  const downloadTextFile = (content: string, filename: string, mime = 'text/csv') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Minimal CSV parser (supports quoted fields + escaped quotes)
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = '';
    };
    const pushRow = () => {
      // Ignore completely empty trailing rows
      if (row.length === 1 && row[0].trim() === '') {
        row = [];
        return;
      }
      rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          field += c;
        }
        continue;
      }

      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        pushField();
      } else if (c === '\n') {
        pushField();
        pushRow();
      } else if (c === '\r') {
        // ignore
      } else {
        field += c;
      }
    }
    pushField();
    if (row.length) pushRow();
    return rows;
  };

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
    fetchCarClasses();
  }, []);

  const fetchCarClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('class')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get unique classes and filter out null/empty values
      const uniqueClasses = [...new Set(
        (data || [])
          .map((item: any) => item.class)
          .filter((cls: string | null) => cls && cls.trim() !== '')
      )].sort();
      
      // Add DEFAULT at the beginning
      setAvailableClasses(['DEFAULT', ...uniqueClasses]);
    } catch (error) {
      console.error('Error fetching car classes:', error);
      // Fallback to default classes if fetch fails
      setAvailableClasses(['DEFAULT', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'MUV']);
    }
  };

  // Fetch cities when zone changes
  useEffect(() => {
    if (selectedZone) {
      fetchCitiesByZone(selectedZone);
      // Reset city, workshop and class selection when zone changes
      setSelectedCity('');
      setSelectedWorkshop('');
      setSelectedClass('DEFAULT');
      setServiceTypes([]);
      setPrices({});
    } else {
      setCities([]);
      setSelectedCity('');
      setFilteredWorkshops([]);
      setSelectedWorkshop('');
      setSelectedClass('DEFAULT');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedZone]);

  // Filter workshops by zone and city
  useEffect(() => {
    if (selectedZone) {
      let filtered = workshops.filter(w => w.zone_id === selectedZone);
      if (selectedCity) {
        // Match by city name (workshops have city as string, not city_id)
        const selectedCityName = cities.find(c => c.id === selectedCity)?.name;
        if (selectedCityName) {
          filtered = filtered.filter(w => w.city?.toLowerCase() === selectedCityName.toLowerCase());
        }
      }
      setFilteredWorkshops(filtered);
    } else {
      setFilteredWorkshops([]);
    }
  }, [selectedZone, selectedCity, workshops, cities]);

  // Reset workshop when city or class changes
  useEffect(() => {
    if (selectedZone && (selectedCity || selectedClass)) {
      setSelectedWorkshop('');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedCity, selectedClass]);

  // Fetch pricing when workshop, class, zone, or city changes
  useEffect(() => {
    if (selectedWorkshop && selectedWorkshop !== 'ALL' && selectedZone && selectedClass) {
      // Individual workshop mode - fetch pricing data
      fetchPricingData(selectedWorkshop, selectedClass, selectedZone, selectedCity);
    } else if (selectedWorkshop === 'ALL' && selectedZone && selectedClass) {
      // Bulk mode - just fetch service types without pricing (user will set prices)
      fetchServiceTypesForBulkMode();
    } else {
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedWorkshop, selectedClass, selectedZone, selectedCity]);

  const fetchWorkshops = async () => {
    try {
      const { data } = await supabase.from('workshops').select('id, name, city, zone_id');
      setWorkshops(data || []);
      if (data && data.length > 0) setLoading(false);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const fetchZones = async () => {
    try {
      const { data } = await supabase.from('zones').select('id, name').eq('is_active', true).order('name');
      setZones(data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
    }
  };

  const fetchCitiesByZone = async (zoneId: string) => {
    try {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('zone_id', zoneId)
        .eq('is_active', true)
        .order('name');
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchServiceTypesForBulkMode = async () => {
    setLoading(true);
    try {
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .limit(5000);

      setServiceTypes(allServiceTypes || []);
      setPrices({});
    } catch (error) {
      console.error('Error fetching service types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string, zoneId: string, cityId?: string) => {
    setLoading(true);
    try {
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .limit(5000);

      let query = supabase
        .from('workshop_service_pricing')
        .select('service_type_id, custom_price')
        .eq('workshop_id', workshopId)
        .limit(5000);

      if (vehicleClass === 'DEFAULT') {
        query = query.is('class', null);
      } else {
        query = query.eq('class', vehicleClass);
      }

      if (cityId) {
        query = query.eq('city_id', cityId);
      } else {
        query = query.is('city_id', null);
      }

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      } else {
        query = query.is('zone_id', null);
      }

      const { data: existingPrices } = await query;

      let priceMap: Record<string, number> = {};
      existingPrices?.forEach((p: any) => {
        priceMap[p.service_type_id] = p.custom_price;
      });

      // When a specific city is selected, also load zone-level pricing (city_id = null)
      // as fallback for services that don't have city-specific overrides
      if (cityId) {
        let fallbackQuery = supabase
          .from('workshop_service_pricing')
          .select('service_type_id, custom_price')
          .eq('workshop_id', workshopId)
          .is('city_id', null)
          .limit(5000);

        if (vehicleClass === 'DEFAULT') {
          fallbackQuery = fallbackQuery.is('class', null);
        } else {
          fallbackQuery = fallbackQuery.eq('class', vehicleClass);
        }

        if (zoneId) {
          fallbackQuery = fallbackQuery.eq('zone_id', zoneId);
        } else {
          fallbackQuery = fallbackQuery.is('zone_id', null);
        }

        const { data: zonePrices } = await fallbackQuery;
        zonePrices?.forEach((p: any) => {
          // Only use zone-level price if no city-specific price exists
          if (priceMap[p.service_type_id] === undefined) {
            priceMap[p.service_type_id] = p.custom_price;
          }
        });
      }

      setServiceTypes(allServiceTypes || []);
      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (serviceTypeId: string, price: string) => {
    setPrices(prev => {
      const next = { ...prev };
      const trimmed = (price ?? '').toString().trim();
      if (trimmed === '') {
        delete next[serviceTypeId];
        return next;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        delete next[serviceTypeId];
        return next;
      }
      next[serviceTypeId] = n;
      return next;
    });
  };

  const saveServicePricingForWorkshops = async (args: {
    workshopIds: string[];
    priceMap: Record<string, number>;
    overwriteAllServiceTypes: boolean;
  }) => {
    const { workshopIds, priceMap, overwriteAllServiceTypes } = args;
    if (!selectedZone || !selectedClass) throw new Error('Please select Zone and Car Class first.');
    if (!workshopIds.length) throw new Error('No workshops selected.');

    const serviceTypeIdsToAffect = overwriteAllServiceTypes
      ? (serviceTypes || []).map((st: any) => st.id).filter(Boolean)
      : Object.keys(priceMap);

    if (!serviceTypeIdsToAffect.length) {
      throw new Error('No services found to update for this selection.');
    }

    const inBatchSize = 50;

    for (const workshopId of workshopIds) {
      // Delete in batches to avoid URL length limits
      for (let i = 0; i < serviceTypeIdsToAffect.length; i += inBatchSize) {
        const batch = serviceTypeIdsToAffect.slice(i, i + inBatchSize);
        let delQuery = supabase
          .from('workshop_service_pricing')
          .delete()
          .eq('workshop_id', workshopId)
          .in('service_type_id', batch);

        if (selectedClass === 'DEFAULT') {
          delQuery = delQuery.is('class', null);
        } else {
          delQuery = delQuery.eq('class', selectedClass);
        }

        if (selectedCity) {
          delQuery = delQuery.eq('city_id', selectedCity);
        } else {
          delQuery = delQuery.is('city_id', null);
        }

        if (selectedZone) {
          delQuery = delQuery.eq('zone_id', selectedZone);
        } else {
          delQuery = delQuery.is('zone_id', null);
        }

        const { error: delError } = await delQuery;
        if (delError) throw delError;
      }

      // When saving at zone level ("All Cities"), also delete city-specific overrides
      // so zone-level pricing becomes the effective pricing for all cities
      if (!selectedCity && selectedZone) {
        for (let i = 0; i < serviceTypeIdsToAffect.length; i += inBatchSize) {
          const batch = serviceTypeIdsToAffect.slice(i, i + inBatchSize);
          let cityDelQuery = supabase
            .from('workshop_service_pricing')
            .delete()
            .eq('workshop_id', workshopId)
            .in('service_type_id', batch)
            .eq('zone_id', selectedZone)
            .not('city_id', 'is', null);

          if (selectedClass === 'DEFAULT') {
            cityDelQuery = cityDelQuery.is('class', null);
          } else {
            cityDelQuery = cityDelQuery.eq('class', selectedClass);
          }

          const { error: cityDelError } = await cityDelQuery;
          if (cityDelError) throw cityDelError;
        }
      }

      // Insert for THIS workshop immediately after its delete
      const toInsert: any[] = [];
      for (const [serviceTypeId, price] of Object.entries(priceMap)) {
        if (!Number.isFinite(price) || price < 0) continue;
        toInsert.push({
          workshop_id: workshopId,
          service_type_id: serviceTypeId,
          custom_price: price,
          class: selectedClass === 'DEFAULT' ? null : selectedClass,
          zone_id: selectedZone || null,
          city_id: selectedCity || null,
        });
      }

      const insertBatchSize = 100;
      for (let i = 0; i < toInsert.length; i += insertBatchSize) {
        const batch = toInsert.slice(i, i + insertBatchSize);
        const { error } = await supabase.from('workshop_service_pricing').insert(batch);
        if (error) throw error;
      }
    }
  };

  const handleSave = async () => {
    if (!selectedWorkshop || selectedWorkshop === 'ALL') return;
    setSaving(true);
    try {
      if (Object.keys(prices).length === 0) {
        alert("No prices to save.");
        return;
      }
      await saveServicePricingForWorkshops({
        workshopIds: [selectedWorkshop],
        priceMap: prices,
        overwriteAllServiceTypes: false,
      });

      alert('Pricing updated successfully!');
      broadcastPricingUpdate({
        workshop_id: selectedWorkshop,
        zone_id: selectedZone || null,
        city_id: selectedCity || null,
        vehicle_class: selectedClass || null,
      });
    } catch (error: any) {
      alert('Error updating pricing: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    if (!selectedZone || selectedWorkshop !== 'ALL') return;
    if (Object.keys(prices).length === 0) {
      alert("Please set prices first before applying to all workshops.");
      return;
    }

    const locationText = selectedCity 
      ? `${cities.find(c => c.id === selectedCity)?.name || 'City'} in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`
      : `${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`;

    const confirmed = confirm(
      `Are you sure you want to apply these service prices to ALL ${filteredWorkshops.length} workshops in ${locationText}?`
    );
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const workshopIds = filteredWorkshops.map(w => w.id);
      await saveServicePricingForWorkshops({
        workshopIds,
        priceMap: prices,
        overwriteAllServiceTypes: false,
      });

      alert(`Service pricing applied successfully to ${workshopIds.length} workshops!`);
      broadcastPricingUpdate({
        workshop_ids: workshopIds,
        zone_id: selectedZone || null,
        city_id: selectedCity || null,
        vehicle_class: selectedClass || null,
      });
      // Reset to show first workshop
      if (filteredWorkshops.length > 0) {
        setSelectedWorkshop(filteredWorkshops[0].id);
      }
    } catch (error: any) {
      alert('Error applying bulk pricing: ' + error.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const filteredServiceTypes = serviceTypes.filter(st => 
    st.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isBulkMode = selectedWorkshop === 'ALL' && selectedZone && selectedClass;

  const exportServicePricingCsv = () => {
    setCsvError('');
    setCsvInfo('');
    if (!selectedZone || !selectedClass || !selectedWorkshop) {
      setCsvError('Please select Zone, Car Class and Workshop first.');
      return;
    }
    if (!serviceTypes?.length) {
      setCsvError('No service types loaded yet.');
      return;
    }

    const zoneName = zones.find(z => z.id === selectedZone)?.name || 'zone';
    const cityName = selectedCity ? (cities.find(c => c.id === selectedCity)?.name || 'city') : 'all-cities';
    const className = selectedClass === 'DEFAULT' ? 'default' : selectedClass;
    const workshopName = selectedWorkshop === 'ALL'
      ? `all-workshops`
      : (workshops.find(w => w.id === selectedWorkshop)?.name || 'workshop');

    const headers = [
      'zone_id',
      'city_id',
      'class',
      'workshop_id',
      'service_type_id',
      'service_name',
      'hsn_code',
      'custom_price',
    ];

    const sorted = [...serviceTypes].sort((a: any, b: any) => (a?.name || '').localeCompare(b?.name || ''));
    const selectedRows = csvOnlyOverrides
      ? sorted.filter((st: any) => prices[st.id] !== undefined)
      : sorted;

    const rows = selectedRows.map((st: any) => [
      selectedZone || '',
      selectedCity || '',
      selectedClass === 'DEFAULT' ? '' : selectedClass,
      selectedWorkshop,
      st.id,
      st.name,
      st.hsn_sac_code || '',
      prices[st.id] !== undefined ? prices[st.id] : '',
    ]);

    const csv = buildCsv(headers, rows);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `service-pricing-${zoneName}-${cityName}-${className}-${workshopName}-${date}.csv`
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    downloadTextFile(csv, filename);
    setCsvInfo(`Downloaded ${rows.length} rows.`);
  };

  const applyImportedCsv = async (file: File) => {
    setCsvBusy(true);
    setCsvError('');
    setCsvInfo('');
    try {
      if (!selectedZone || !selectedClass || !selectedWorkshop) {
        throw new Error('Please select Zone, Car Class and Workshop first.');
      }
      if (!serviceTypes?.length) {
        throw new Error('No service types loaded yet.');
      }

      const text = await file.text();
      const grid = parseCsv(text);
      if (!grid.length) throw new Error('CSV is empty.');

      const header = grid[0].map(h => (h || '').trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const idxServiceTypeId = col('service_type_id');
      const idxCustomPrice = col('custom_price');

      if (idxServiceTypeId === -1 || idxCustomPrice === -1) {
        throw new Error('CSV must contain headers: service_type_id, custom_price');
      }

      const idxZone = col('zone_id');
      const idxCity = col('city_id');
      const idxClass = col('class');
      const idxWorkshop = col('workshop_id');

      const allowedIds = new Set((serviceTypes || []).map((st: any) => st.id));

      const importedPriceMap: Record<string, number> = {};
      const errors: string[] = [];

      // Validate scope match if scope columns exist
      const expectedClass = selectedClass === 'DEFAULT' ? '' : selectedClass;
      const expectedCity = selectedCity || '';
      const expectedZone = selectedZone || '';
      const expectedWorkshop = selectedWorkshop;

      for (let r = 1; r < grid.length; r++) {
        const row = grid[r];
        const stId = (row[idxServiceTypeId] || '').trim();
        if (!stId) continue;

        if (!allowedIds.has(stId)) {
          errors.push(`Row ${r + 1}: Unknown service_type_id "${stId}"`);
          continue;
        }

        if (idxWorkshop !== -1) {
          const w = (row[idxWorkshop] || '').trim();
          if (w && w !== expectedWorkshop) {
            errors.push(`Row ${r + 1}: workshop_id mismatch (file "${w}" vs selected "${expectedWorkshop}")`);
          }
        }
        if (idxZone !== -1) {
          const z = (row[idxZone] || '').trim();
          if (z && z !== expectedZone) {
            errors.push(`Row ${r + 1}: zone_id mismatch (file "${z}" vs selected "${expectedZone}")`);
          }
        }
        if (idxCity !== -1) {
          const c = (row[idxCity] || '').trim();
          if ((c || '') !== (expectedCity || '')) {
            // City can legitimately be blank for "all cities"; enforce exact match
            errors.push(`Row ${r + 1}: city_id mismatch (file "${c}" vs selected "${expectedCity}")`);
          }
        }
        if (idxClass !== -1) {
          const cl = (row[idxClass] || '').trim();
          if ((cl || '') !== (expectedClass || '')) {
            errors.push(`Row ${r + 1}: class mismatch (file "${cl}" vs selected "${expectedClass}")`);
          }
        }

        const priceRaw = (row[idxCustomPrice] || '').trim();
        if (priceRaw === '') {
          continue;
        }
        const n = Number(priceRaw);
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`Row ${r + 1}: invalid custom_price "${priceRaw}" for service_type_id "${stId}"`);
          continue;
        }
        importedPriceMap[stId] = n;
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n...and ${errors.length - 8} more` : ''));
      }

      // Update UI state immediately
      setPrices(importedPriceMap);

      // Persist to DB (overwrite for full scope so clears work)
      if (selectedWorkshop === 'ALL') {
        if (!filteredWorkshops.length) throw new Error('No workshops found for this zone/city selection.');
        const locationText = selectedCity
          ? `${cities.find(c => c.id === selectedCity)?.name || 'City'} in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`
          : `${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`;
        const confirmed = confirm(
          `Apply imported service prices to ALL ${filteredWorkshops.length} workshops in ${locationText}?`
        );
        if (!confirmed) {
          setCsvInfo('Imported prices loaded into the screen. Click “Apply to All” when ready.');
          return;
        }
        await saveServicePricingForWorkshops({
          workshopIds: filteredWorkshops.map(w => w.id),
          priceMap: importedPriceMap,
          overwriteAllServiceTypes: true,
        });
        alert(`Imported pricing applied successfully to ${filteredWorkshops.length} workshops!`);
        if (filteredWorkshops.length > 0) setSelectedWorkshop(filteredWorkshops[0].id);
      } else {
        await saveServicePricingForWorkshops({
          workshopIds: [selectedWorkshop],
          priceMap: importedPriceMap,
          overwriteAllServiceTypes: true,
        });
        alert('Imported pricing saved successfully!');
        // Refresh from DB to reflect canonical state
        await fetchPricingData(selectedWorkshop, selectedClass, selectedZone, selectedCity);
      }

      setShowCsvModal(false);
    } catch (e: any) {
      setCsvError(e?.message || 'Failed to import CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchWorkshops(), fetchZones(), fetchCarClasses()]);
    if (selectedZone) {
      await fetchCitiesByZone(selectedZone);
    }
    if (selectedWorkshop && selectedWorkshop !== 'ALL') {
      await fetchPricingData(selectedWorkshop, selectedClass, selectedZone, selectedCity);
    } else if (selectedWorkshop === 'ALL' && selectedZone) {
      await fetchServiceTypesForBulkMode();
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Service Type Pricing</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">Override service prices by Zone, City, Workshop & Car Class</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <AdminPageRefresh onClick={() => void handleRefresh()} loading={loading} />
          {isBulkMode && (
            <button 
              onClick={handleBulkSave}
              disabled={bulkSaving || Object.keys(prices).length === 0}
              className="btn btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              {bulkSaving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              <span className="hidden sm:inline">Apply to All ({filteredWorkshops.length}) Workshops</span>
              <span className="sm:hidden">Apply All ({filteredWorkshops.length})</span>
            </button>
          )}
          <button
            onClick={() => {
              setCsvError('');
              setCsvInfo('');
              setShowCsvModal(true);
            }}
            disabled={!selectedZone || !selectedClass || !selectedWorkshop}
            className="btn btn-outline bg-white flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            title="Export or Import pricing via CSV"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Import/Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || !selectedWorkshop || selectedWorkshop === 'ALL'}
            className="btn btn-primary flex items-center justify-center gap-1.5 sm:gap-2 disabled:opacity-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </button>
        </div>
      </div>

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900">Import / Export Service Pricing (CSV)</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  Scope: <span className="font-medium text-gray-700">
                    {zones.find(z => z.id === selectedZone)?.name || 'Zone'}
                    {selectedCity && ` / ${cities.find(c => c.id === selectedCity)?.name || 'City'}`}
                    {' / '}
                    {selectedClass === 'DEFAULT' ? 'Default' : selectedClass}
                    {' / '}
                    {selectedWorkshop === 'ALL'
                      ? `All Workshops (${filteredWorkshops.length})`
                      : (workshops.find(w => w.id === selectedWorkshop)?.name || 'Workshop')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="p-2 rounded-lg hover:bg-gray-50 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={csvOnlyOverrides}
                    onChange={(e) => setCsvOnlyOverrides(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Export only overridden prices
                </label>
                <button
                  onClick={exportServicePricingCsv}
                  disabled={csvBusy || !serviceTypes?.length}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="text-xs sm:text-sm font-medium text-gray-800 mb-1">Upload CSV to update prices</div>
                <div className="text-[10px] sm:text-xs text-gray-500 mb-2">
                  CSV must include headers: <span className="font-mono">service_type_id, custom_price</span>. Blank price will clear the override.
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyImportedCsv(f);
                      // allow re-upload same file
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-xs sm:text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {csvBusy ? 'Importing & saving…' : 'Select CSV file'}
                  </div>
                </div>
              </div>

              {csvError && (
                <div className="text-xs sm:text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {csvError}
                </div>
              )}
              {csvInfo && (
                <div className="text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {csvInfo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls: Zone → City → Class → Workshop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
        {/* Zone Selector - FIRST */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">1. Select Zone *</label>
          <div className="relative">
            <MapPin className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <select 
              className="w-full pl-8 sm:pl-10 p-2 sm:p-3 text-xs sm:text-sm border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="">-- Select Zone First --</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* City Selector - SECOND */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">2. Select City (Optional)</label>
          <div className="relative">
            <Building2 className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <select 
              className="w-full pl-8 sm:pl-10 p-2 sm:p-3 text-xs sm:text-sm border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="">All Cities in Zone</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Class Selector - THIRD */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">3. Select Car Class *</label>
          <div className="relative">
            <Car className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <select 
              className="w-full pl-8 sm:pl-10 p-2 sm:p-3 text-xs sm:text-sm border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="DEFAULT">Default (Base Price)</option>
              {availableClasses.filter(c => c !== 'DEFAULT').map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Workshop Selector - FOURTH */}
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">4. Select Workshop</label>
          <div className="relative">
            <Store className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <select 
              className="w-full pl-8 sm:pl-10 p-2 sm:p-3 text-xs sm:text-sm border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
              disabled={!selectedZone || !selectedClass}
            >
              <option value="">-- Select Workshop --</option>
              {selectedZone && selectedClass && (
                <>
                  <option value="ALL" className="font-semibold bg-blue-50">
                    📋 All Workshops {selectedCity ? `in ${cities.find(c => c.id === selectedCity)?.name}` : `in Zone`} ({filteredWorkshops.length})
                  </option>
                  {filteredWorkshops.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Info Banner for Bulk Mode */}
      {isBulkMode && (
        <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs sm:text-sm text-blue-800">
            <strong>Bulk Mode:</strong> Set prices below and click "Apply to All Workshops" to update all {filteredWorkshops.length} workshops 
            {selectedCity ? ` in ${cities.find(c => c.id === selectedCity)?.name}` : ''} 
            {selectedCity ? '' : ` in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`} 
            {' '}for {selectedClass === 'DEFAULT' ? 'all classes' : selectedClass} at once.
            Or select a specific workshop to update individual pricing.
          </p>
        </div>
      )}

      {/* Pricing Table */}
      {!selectedZone || !selectedClass || !selectedWorkshop ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <MapPin className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-300 mx-auto mb-2 sm:mb-3" />
          <p className="text-gray-500 text-sm sm:text-base">
            {!selectedZone && "Please select a zone first"}
            {selectedZone && !selectedClass && "Please select a car class"}
            {selectedZone && selectedClass && !selectedWorkshop && "Please select a workshop"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <input 
                type="text" 
                placeholder="Filter services..." 
                className="w-full pl-8 sm:pl-10 p-1.5 sm:p-2 border rounded-lg text-xs sm:text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              Editing rates for: <span className="font-bold text-brand-primary">
                {zones.find(z => z.id === selectedZone)?.name || 'Zone'} 
                {selectedCity && ` / ${cities.find(c => c.id === selectedCity)?.name || 'City'}`}
                {' / '}
                {selectedClass === 'DEFAULT' ? 'All Classes' : selectedClass}
                {' / '}
                {isBulkMode ? `All Workshops (${filteredWorkshops.length})` : 
                 workshops.find(w => w.id === selectedWorkshop)?.name || 'Workshop'}
              </span>
            </div>
          </div>
          
          <div className="max-h-[400px] sm:max-h-[500px] md:max-h-[600px] overflow-y-auto">
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="p-3 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">Service Name</th>
                    <th className="p-3 sm:p-4 font-medium text-gray-600 text-xs sm:text-sm">HSN Code</th>
                    <th className="p-3 sm:p-4 font-medium text-gray-600 text-right text-xs sm:text-sm">
                      {isBulkMode ? 'Bulk Price (All Workshops)' : 'Custom Price'}
                    </th>
                    <th className="p-3 sm:p-4 font-medium text-gray-600 text-center text-xs sm:text-sm">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={4} className="p-6 sm:p-8 text-center text-xs sm:text-sm">Loading...</td></tr>
                  ) : (
                    filteredServiceTypes.map((serviceType) => {
                      const currentPrice = prices[serviceType.id];
                      const hasOverride = currentPrice !== undefined;
                      
                      return (
                        <tr key={serviceType.id} className={hasOverride ? 'bg-blue-50/30' : ''}>
                          <td className="p-3 sm:p-4 font-medium text-xs sm:text-sm">{serviceType.name}</td>
                          <td className="p-3 sm:p-4 text-[10px] sm:text-xs text-gray-500">{serviceType.hsn_sac_code || '-'}</td>
                          <td className="p-3 sm:p-4 text-right">
                            <div className="relative inline-block w-28 sm:w-32">
                              <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs sm:text-sm">₹</span>
                              <input 
                                type="number" 
                                className={`w-full pl-5 sm:pl-6 p-1 sm:p-1.5 border rounded text-right font-medium text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none ${hasOverride ? 'border-blue-300 text-blue-700' : 'border-gray-200'}`}
                                placeholder="0"
                                value={currentPrice ?? ''}
                                onChange={(e) => handlePriceChange(serviceType.id, e.target.value)}
                              />
                            </div>
                          </td>
                          <td className="p-3 sm:p-4 text-center">
                            {hasOverride && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                                {isBulkMode ? 'Bulk Rate' : 'Custom Rate'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-100">
              {loading ? (
                <div className="p-6 text-center text-xs sm:text-sm">Loading...</div>
              ) : (
                filteredServiceTypes.map((serviceType) => {
                  const currentPrice = prices[serviceType.id];
                  const hasOverride = currentPrice !== undefined;
                  
                  return (
                    <div key={serviceType.id} className={`p-3 sm:p-4 ${hasOverride ? 'bg-blue-50/30' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-xs sm:text-sm mb-1">{serviceType.name}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500">HSN: {serviceType.hsn_sac_code || '-'}</div>
                        </div>
                        {hasOverride && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0">
                            {isBulkMode ? 'Bulk' : 'Custom'}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs sm:text-sm">₹</span>
                        <input 
                          type="number" 
                          className={`w-full pl-5 sm:pl-6 p-1.5 sm:p-2 border rounded text-right font-medium text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none ${hasOverride ? 'border-blue-300 text-blue-700' : 'border-gray-200'}`}
                          placeholder="0"
                          value={currentPrice ?? ''}
                          onChange={(e) => handlePriceChange(serviceType.id, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
