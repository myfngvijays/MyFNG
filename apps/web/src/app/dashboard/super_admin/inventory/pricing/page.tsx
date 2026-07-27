'use client';

import React, { useState, useEffect } from 'react';
import { Save, Search, Store, Loader2, Car, MapPin, Copy, Download, Upload, X } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export default function WorkshopPricingPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [zones, setZones] = useState<any[]>([]);
  
  // Car Class State
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<string[]>(['DEFAULT']); 

  const [products, setProducts] = useState<any[]>([]);
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

  // Filter workshops by zone when zone changes
  useEffect(() => {
    if (selectedZone) {
      const filtered = workshops.filter(w => w.zone_id === selectedZone);
      setFilteredWorkshops(filtered);
      // Reset workshop selection when zone changes
      setSelectedWorkshop('');
      setProducts([]);
      setPrices({});
    } else {
      setFilteredWorkshops([]);
      setSelectedWorkshop('');
      setProducts([]);
      setPrices({});
    }
  }, [selectedZone, workshops]);

  // Fetch pricing when workshop, class, or zone changes
  useEffect(() => {
    if (selectedWorkshop && selectedWorkshop !== 'ALL') {
      // Individual workshop mode - fetch pricing data
      fetchPricingData(selectedWorkshop, selectedClass, selectedZone);
    } else if (selectedWorkshop === 'ALL' && selectedZone) {
      // Bulk mode - just fetch products without pricing (user will set prices)
      fetchProductsForBulkMode();
    } else {
      setProducts([]);
      setPrices({});
    }
  }, [selectedWorkshop, selectedClass, selectedZone]);

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

  const fetchProductsForBulkMode = async () => {
    setLoading(true);
    try {
      const { data: masterProducts } = await supabase
        .from('master_products')
        .select('*')
        .order('name')
        .limit(5000);

      setProducts(masterProducts || []);
      setPrices({});
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string, zoneId: string) => {
    setLoading(true);
    try {
      const { data: masterProducts } = await supabase
        .from('master_products')
        .select('*')
        .order('name')
        .limit(5000);

      let query = supabase
        .from('workshop_product_pricing')
        .select('product_id, selling_price')
        .eq('workshop_id', workshopId)
        .limit(5000);

      if (vehicleClass === 'DEFAULT') {
        query = query.is('class', null);
      } else {
        query = query.eq('class', vehicleClass);
      }

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      } else {
        query = query.is('zone_id', null);
      }

      const { data: existingPrices } = await query;

      const priceMap: Record<string, number> = {};
      existingPrices?.forEach((p: any) => {
        priceMap[p.product_id] = p.selling_price;
      });

      setProducts(masterProducts || []);
      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (productId: string, price: string) => {
    setPrices(prev => {
      const next = { ...prev };
      const trimmed = (price ?? '').toString().trim();
      if (trimmed === '') {
        delete next[productId];
        return next;
      }
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        delete next[productId];
        return next;
      }
      next[productId] = n;
      return next;
    });
  };

  const saveProductPricingForWorkshops = async (args: {
    workshopIds: string[];
    priceMap: Record<string, number>;
    overwriteAllProducts: boolean;
  }) => {
    const { workshopIds, priceMap, overwriteAllProducts } = args;
    if (!selectedZone) throw new Error('Please select Zone first.');
    if (!workshopIds.length) throw new Error('No workshops selected.');

    const productIdsToAffect = overwriteAllProducts
      ? (products || []).map((p: any) => p.id).filter(Boolean)
      : Object.keys(priceMap);

    if (!productIdsToAffect.length) {
      throw new Error('No products found to update for this selection.');
    }

    const inBatchSize = 50;

    for (const workshopId of workshopIds) {
      // Delete in batches to avoid URL length limits
      for (let i = 0; i < productIdsToAffect.length; i += inBatchSize) {
        const batch = productIdsToAffect.slice(i, i + inBatchSize);
        let delQuery = supabase
          .from('workshop_product_pricing')
          .delete()
          .eq('workshop_id', workshopId)
          .in('product_id', batch);

        if (selectedClass === 'DEFAULT') {
          delQuery = delQuery.is('class', null);
        } else {
          delQuery = delQuery.eq('class', selectedClass);
        }

        if (selectedZone) {
          delQuery = delQuery.eq('zone_id', selectedZone);
        } else {
          delQuery = delQuery.is('zone_id', null);
        }

        const { error: delError } = await delQuery;
        if (delError) throw delError;
      }

      // Insert for THIS workshop immediately after its delete
      const toInsert: any[] = [];
      for (const [productId, price] of Object.entries(priceMap)) {
        if (!Number.isFinite(price) || price < 0) continue;
        toInsert.push({
          workshop_id: workshopId,
          product_id: productId,
          selling_price: price,
          class: selectedClass === 'DEFAULT' ? null : selectedClass,
          zone_id: selectedZone || null,
        });
      }

      const insertBatchSize = 100;
      for (let i = 0; i < toInsert.length; i += insertBatchSize) {
        const batch = toInsert.slice(i, i + insertBatchSize);
        const { error } = await supabase.from('workshop_product_pricing').insert(batch);
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
      await saveProductPricingForWorkshops({
        workshopIds: [selectedWorkshop],
        priceMap: prices,
        overwriteAllProducts: false,
      });

      alert('Pricing updated successfully!');
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

    const confirmed = confirm(
      `Are you sure you want to apply these prices to ALL ${filteredWorkshops.length} workshops in this zone?`
    );
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const workshopIds = filteredWorkshops.map(w => w.id);
      await saveProductPricingForWorkshops({
        workshopIds,
        priceMap: prices,
        overwriteAllProducts: false,
      });

      alert(`Pricing applied successfully to ${workshopIds.length} workshops!`);
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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isBulkMode = selectedWorkshop === 'ALL' && selectedZone;

  const exportWorkshopPricingCsv = () => {
    setCsvError('');
    setCsvInfo('');
    if (!selectedZone || !selectedWorkshop) {
      setCsvError('Please select Zone and Workshop first.');
      return;
    }
    if (!products?.length) {
      setCsvError('No products loaded yet.');
      return;
    }

    const zoneName = zones.find(z => z.id === selectedZone)?.name || 'zone';
    const className = selectedClass === 'DEFAULT' ? 'default' : selectedClass;
    const workshopName = selectedWorkshop === 'ALL'
      ? `all-workshops`
      : (workshops.find(w => w.id === selectedWorkshop)?.name || 'workshop');

    const headers = [
      'zone_id',
      'class',
      'workshop_id',
      'product_id',
      'product_name',
      'type',
      'default_price',
      'selling_price',
    ];

    const sorted = [...products].sort((a: any, b: any) => (a?.name || '').localeCompare(b?.name || ''));
    const selectedRows = csvOnlyOverrides
      ? sorted.filter((p: any) => prices[p.id] !== undefined)
      : sorted;

    const rows = selectedRows.map((p: any) => [
      selectedZone || '',
      selectedClass === 'DEFAULT' ? '' : selectedClass,
      selectedWorkshop,
      p.id,
      p.name,
      p.type || '',
      p.default_price ?? '',
      prices[p.id] !== undefined ? prices[p.id] : '',
    ]);

    const csv = buildCsv(headers, rows);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `workshop-pricing-${zoneName}-${className}-${workshopName}-${date}.csv`
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    downloadTextFile(csv, filename);
    setCsvInfo(`Downloaded ${rows.length} rows.`);
  };

  const applyImportedWorkshopPricingCsv = async (file: File) => {
    setCsvBusy(true);
    setCsvError('');
    setCsvInfo('');
    try {
      if (!selectedZone || !selectedWorkshop) {
        throw new Error('Please select Zone and Workshop first.');
      }
      if (!products?.length) {
        throw new Error('No products loaded yet.');
      }

      const text = await file.text();
      const grid = parseCsv(text);
      if (!grid.length) throw new Error('CSV is empty.');

      const header = grid[0].map(h => (h || '').trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const idxProductId = col('product_id');
      const idxSellingPrice = col('selling_price');

      if (idxProductId === -1 || idxSellingPrice === -1) {
        throw new Error('CSV must contain headers: product_id, selling_price');
      }

      const idxZone = col('zone_id');
      const idxClass = col('class');
      const idxWorkshop = col('workshop_id');

      const allowedIds = new Set((products || []).map((p: any) => p.id));
      const importedPriceMap: Record<string, number> = {};
      const errors: string[] = [];

      const expectedClass = selectedClass === 'DEFAULT' ? '' : selectedClass;
      const expectedZone = selectedZone || '';
      const expectedWorkshop = selectedWorkshop;

      for (let r = 1; r < grid.length; r++) {
        const row = grid[r];
        const pId = (row[idxProductId] || '').trim();
        if (!pId) continue;

        if (!allowedIds.has(pId)) {
          errors.push(`Row ${r + 1}: Unknown product_id "${pId}"`);
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
        if (idxClass !== -1) {
          const cl = (row[idxClass] || '').trim();
          if ((cl || '') !== (expectedClass || '')) {
            errors.push(`Row ${r + 1}: class mismatch (file "${cl}" vs selected "${expectedClass}")`);
          }
        }

        const priceRaw = (row[idxSellingPrice] || '').trim();
        if (priceRaw === '') {
          continue; // blank means clear; handled by overwrite mode deletes
        }
        const n = Number(priceRaw);
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`Row ${r + 1}: invalid selling_price "${priceRaw}" for product_id "${pId}"`);
          continue;
        }
        importedPriceMap[pId] = n;
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n...and ${errors.length - 8} more` : ''));
      }

      // Update UI state immediately
      setPrices(importedPriceMap);

      // Persist to DB (overwrite for full scope so clears work)
      if (selectedWorkshop === 'ALL') {
        if (!filteredWorkshops.length) throw new Error('No workshops found for this zone selection.');
        const confirmed = confirm(
          `Apply imported product prices to ALL ${filteredWorkshops.length} workshops in this zone?`
        );
        if (!confirmed) {
          setCsvInfo('Imported prices loaded into the screen. Click “Apply to All” when ready.');
          return;
        }
        await saveProductPricingForWorkshops({
          workshopIds: filteredWorkshops.map(w => w.id),
          priceMap: importedPriceMap,
          overwriteAllProducts: true,
        });
        alert(`Imported pricing applied successfully to ${filteredWorkshops.length} workshops!`);
        if (filteredWorkshops.length > 0) setSelectedWorkshop(filteredWorkshops[0].id);
      } else {
        await saveProductPricingForWorkshops({
          workshopIds: [selectedWorkshop],
          priceMap: importedPriceMap,
          overwriteAllProducts: true,
        });
        alert('Imported pricing saved successfully!');
        await fetchPricingData(selectedWorkshop, selectedClass, selectedZone);
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
    if (selectedWorkshop && selectedWorkshop !== 'ALL') {
      await fetchPricingData(selectedWorkshop, selectedClass, selectedZone);
    } else if (selectedWorkshop === 'ALL' && selectedZone) {
      await fetchProductsForBulkMode();
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshop Pricing</h1>
          <p className="text-gray-500">Override prices by Zone, Workshop & Car Class</p>
        </div>
        <div className="flex gap-2">
          <AdminPageRefresh onClick={() => void handleRefresh()} loading={loading} />
          {isBulkMode && (
            <button 
              onClick={handleBulkSave}
              disabled={bulkSaving || Object.keys(prices).length === 0}
              className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Apply to All ({filteredWorkshops.length}) Workshops
            </button>
          )}
          <button
            onClick={() => {
              setCsvError('');
              setCsvInfo('');
              setShowCsvModal(true);
            }}
            disabled={!selectedZone || !selectedWorkshop}
            className="btn btn-outline bg-white flex items-center gap-2 disabled:opacity-50"
            title="Export or Import pricing via CSV"
          >
            <Download className="w-4 h-4" />
            Import/Export CSV
          </button>
          <button 
            onClick={handleSave}
            disabled={saving || !selectedWorkshop || selectedWorkshop === 'ALL'}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900">Import / Export Workshop Pricing (CSV)</div>
                <div className="text-sm text-gray-500 mt-1">
                  Scope: <span className="font-medium text-gray-700">
                    {zones.find(z => z.id === selectedZone)?.name || 'Zone'}
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

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={csvOnlyOverrides}
                    onChange={(e) => setCsvOnlyOverrides(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Export only overridden prices
                </label>
                <button
                  onClick={exportWorkshopPricingCsv}
                  disabled={csvBusy || !products?.length}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-800 mb-1">Upload CSV to update prices</div>
                <div className="text-xs text-gray-500 mb-2">
                  CSV must include headers: <span className="font-mono">product_id, selling_price</span>. Blank price will clear the override.
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyImportedWorkshopPricingCsv(f);
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                  />
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {csvBusy ? 'Importing & saving…' : 'Select CSV file'}
                  </div>
                </div>
              </div>

              {csvError && (
                <div className="text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {csvError}
                </div>
              )}
              {csvInfo && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {csvInfo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls: Zone First, then Workshop & Class */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Zone Selector - FIRST */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Zone *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
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

        {/* Workshop Selector - Shows workshops in selected zone */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. Select Workshop</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="">-- Select Workshop --</option>
              {selectedZone && (
                <>
                  <option value="ALL" className="font-semibold bg-blue-50">
                    📋 All Workshops in Zone ({filteredWorkshops.length})
                  </option>
                  {filteredWorkshops.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Class Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">3. Select Car Class</label>
          <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedWorkshop}
            >
              <option value="DEFAULT">Default (Base Price)</option>
              {availableClasses.filter(c => c !== 'DEFAULT').map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Info Banner for Bulk Mode */}
      {isBulkMode && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Bulk Mode:</strong> Set prices below and click "Apply to All Workshops" to update all {filteredWorkshops.length} workshops in this zone at once.
            Or select a specific workshop to update individual pricing.
          </p>
        </div>
      )}

      {/* Pricing Table */}
      {!selectedWorkshop ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Please select a zone first, then choose a workshop</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filter products..." 
                className="w-full pl-10 p-2 border rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500">
              Editing rates for: <span className="font-bold text-brand-primary">
                {isBulkMode ? `All Workshops in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}` : 
                 workshops.find(w => w.id === selectedWorkshop)?.name || 'Workshop'} 
                {' / '}
                {selectedClass === 'DEFAULT' ? 'All Classes' : selectedClass}
              </span>
            </div>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-medium text-gray-600">Product Name</th>
                  <th className="p-4 font-medium text-gray-600">Type</th>
                  <th className="p-4 font-medium text-gray-600 text-right">Global Default</th>
                  <th className="p-4 font-medium text-gray-600 text-right">
                    {isBulkMode ? 'Bulk Price (All Workshops)' : 'Workshop Price'}
                  </th>
                  <th className="p-4 font-medium text-gray-600 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center">Loading...</td></tr>
                ) : (
                  filteredProducts.map((product) => {
                    const currentPrice = prices[product.id];
                    const hasOverride = currentPrice !== undefined;
                    
                    return (
                      <tr key={product.id} className={hasOverride ? 'bg-blue-50/30' : ''}>
                        <td className="p-4 font-medium">{product.name}</td>
                        <td className="p-4 text-xs text-gray-500">{product.type}</td>
                        <td className="p-4 text-right text-gray-500">₹{product.default_price}</td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                            <input 
                              type="number" 
                              className={`w-full pl-6 p-1.5 border rounded text-right font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none ${hasOverride ? 'border-blue-300 text-blue-700' : 'border-gray-200'}`}
                              placeholder={product.default_price.toString()}
                              value={currentPrice ?? ''}
                              onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {hasOverride && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
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
        </div>
      )}
    </div>
  );
}
