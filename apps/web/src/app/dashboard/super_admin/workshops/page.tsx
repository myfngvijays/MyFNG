'use client';

import React, { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { useRouter } from 'next/navigation';
import { Store, Search, Plus, MapPin, Edit2, X, Building, Globe, Download, Upload } from 'lucide-react';

export default function WorkshopManagementPage() {
  const router = useRouter();
  const supabase = getBrowserClient();
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]); // For Zone Dropdown
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // CSV Import/Export (Bulk Add Workshops)
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string>('');
  const [csvInfo, setCsvInfo] = useState<string>('');
  const [csvSummary, setCsvSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
  }, [filterStatus]);

  const fetchZones = async () => {
    const { data } = await supabase.from('zones').select('id, name');
    setZones(data || []);
  };

  const fetchWorkshops = async () => {
    try {
      let query = supabase
        .from('workshops')
        .select('*, zones(name)') // Fetch zone name too
        .order('created_at', { ascending: false });

      if (filterStatus === 'active') {
        query = query.eq('is_verified', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_verified', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (workshop: any) => {
    setEditingWorkshop({ ...workshop }); // Create a copy
    setShowEditModal(true);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          name: editingWorkshop.name,
          workshop_name: editingWorkshop.workshop_name || null,
          contact_person: editingWorkshop.contact_person,
          phone: editingWorkshop.phone,
          alt_mobile: editingWorkshop.alt_mobile || null,
          email: editingWorkshop.email,
          notification_mobile: editingWorkshop.notification_mobile || null,
          
          // Address
          address: editingWorkshop.address,
          short_address: editingWorkshop.short_address || null,
          location: editingWorkshop.location || null,
          city: editingWorkshop.city,
          state: editingWorkshop.state,
          pincode: editingWorkshop.pincode,
          service_pincode: editingWorkshop.service_pincode || null,
          map_link: editingWorkshop.map_link || null,
          latitude:
            editingWorkshop.latitude === '' || editingWorkshop.latitude == null
              ? null
              : Number.isFinite(Number(editingWorkshop.latitude))
                ? Number(editingWorkshop.latitude)
                : null,
          longitude:
            editingWorkshop.longitude === '' || editingWorkshop.longitude == null
              ? null
              : Number.isFinite(Number(editingWorkshop.longitude))
                ? Number(editingWorkshop.longitude)
                : null,
          workshop_area: editingWorkshop.workshop_area || null,
          landmark: editingWorkshop.landmark || null,
          distance:
            editingWorkshop.distance === '' || editingWorkshop.distance == null
              ? null
              : Number(editingWorkshop.distance),
          near_famous_area: editingWorkshop.near_famous_area || null,
          near_area_google_map: editingWorkshop.near_area_google_map || null,
          ro_mumbai: editingWorkshop.ro_mumbai || null,
          system: editingWorkshop.system || null,
          category: editingWorkshop.category || null,
          
          // Zone & Tax
          zone_id: editingWorkshop.zone_id,
          gst_number: editingWorkshop.gst_number,

          // Managers / Groups / Flags
          manager_name: editingWorkshop.manager_name || null,
          manager_mobile: editingWorkshop.manager_mobile || null,
          manager_name2: editingWorkshop.manager_name2 || null,
          manager_mobile2: editingWorkshop.manager_mobile2 || null,
          manager_name3: editingWorkshop.manager_name3 || null,
          manager_mobile3: editingWorkshop.manager_mobile3 || null,
          whatsapp_group_id: editingWorkshop.whatsapp_group_id || null,
          creadit_card_swap: (editingWorkshop.creadit_card_swap || '').trim() || null,
          engine_oil: (editingWorkshop.engine_oil || '').trim() || null,
          insurance_claim: (editingWorkshop.insurance_claim || '').trim() || null,
          service_panel_issue: (editingWorkshop.service_panel_issue || '').trim() || null,
          note: editingWorkshop.note || null,
          active_date: editingWorkshop.active_date || null,
          retainer_fee: (editingWorkshop.retainer_fee || '').trim() || null,
          prepaid_postpaid: editingWorkshop.prepaid_postpaid || null,
          mou: editingWorkshop.mou === '' || editingWorkshop.mou == null ? null : !!editingWorkshop.mou,
          board: editingWorkshop.board === '' || editingWorkshop.board == null ? null : !!editingWorkshop.board,
          gmb: editingWorkshop.gmb === '' || editingWorkshop.gmb == null ? null : !!editingWorkshop.gmb,
          
          // Bank Details
          bank_account_number: editingWorkshop.bank_account_number,
          ifsc_code: editingWorkshop.ifsc_code,
          upi_id: editingWorkshop.upi_id,
          commission_percentage:
            editingWorkshop.commission_percentage === '' || editingWorkshop.commission_percentage == null
              ? null
              : Number(editingWorkshop.commission_percentage),
        })
        .eq('id', editingWorkshop.id);

      if (error) throw error;
      
      alert('Workshop updated successfully!');
      setShowEditModal(false);
        fetchWorkshops();
    } catch (error: any) {
      alert('Error updating workshop: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (workshopId: string) => {
    if (!confirm('Approve this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Approved!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleDisable = async (workshopId: string) => {
    if (!confirm('Disable this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: false }).eq('id', workshopId);
      if (!error) { alert('Disabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleEnable = async (workshopId: string) => {
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Enabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const escapeCsv = (value: any) => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const buildCsv = (headers: string[], rows: any[][]) => {
    const headerLine = headers.map(escapeCsv).join(',');
    const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
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

      if (c === '"') inQuotes = true;
      else if (c === ',') pushField();
      else if (c === '\n') {
        pushField();
        pushRow();
      } else if (c === '\r') {
        // ignore
      } else field += c;
    }
    pushField();
    if (row.length) pushRow();
    return rows;
  };

  const runWithConcurrency = async <T,>(tasks: Array<() => Promise<T>>, concurrency = 6): Promise<T[]> => {
    const results: T[] = [];
    let idx = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (idx < tasks.length) {
        const current = idx++;
        results[current] = await tasks[current]();
      }
    });
    await Promise.all(workers);
    return results;
  };

  const downloadWorkshopCsvTemplate = () => {
    setCsvError('');
    setCsvInfo('');
    setCsvSummary(null);

    const headers = [
      // If id is provided -> update; else -> create
      'id',
      // Required (for create)
      'name',
      'workshop_name',
      'contact_person',
      'phone',
      'alt_mobile',
      'email',
      'notification_mobile',
      'address',
      'short_address',
      'location',
      'city',
      'state',
      'pincode',
      'service_pincode',
      // Optional
      'zone_id',
      'zone_name',
      'ro_mumbai',
      'system',
      'category',
      'workshop_area',
      'landmark',
      'distance',
      'near_famous_area',
      'near_area_google_map',
      'manager_name',
      'manager_mobile',
      'manager_name2',
      'manager_mobile2',
      'manager_name3',
      'manager_mobile3',
      'creadit_card_swap',
      'engine_oil',
      'insurance_claim',
      'service_panel_issue',
      'note',
      'active_date',
      'retainer_fee',
      'prepaid_postpaid',
      'mou',
      'board',
      'gmb',
      'whatsapp_group_id',
      'gst_number',
      'map_link',
      'latitude',
      'longitude',
      'bank_account_number',
      'ifsc_code',
      'upi_id',
      'commission_percentage',
      'is_verified',
    ];

    const exampleZoneId = zones?.[0]?.id || '';
    const exampleZoneName = zones?.[0]?.name || '';
    // Build example row by header name to guarantee column alignment (avoids Excel CSV errors)
    const example: Record<string, any> = {
      id: '',
      name: 'Aman Workshop',
      workshop_name: '',
      contact_person: 'Aman',
      phone: '9999999999',
      alt_mobile: '',
      email: 'aman@example.com',
      notification_mobile: '',
      address: '123 Main Road, Near Landmark',
      short_address: '',
      location: '',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      service_pincode: '',
      zone_id: exampleZoneId,
      zone_name: exampleZoneName,
      map_link: 'https://maps.google.com/?q=...',
      is_verified: 'true',
    };
    const rows = [headers.map((h) => (example[h] ?? ''))];

    /* Legacy hard-coded example row (kept commented to avoid header mismatch issues)
    const rows = [
      [
        '',
        'Aman Workshop',
        '',
        'Aman',
        '9999999999',
        '',
        'aman@example.com',
        '',
        '123 Main Road, Near Landmark',
        '',
        '',
        'Delhi',
        'Delhi',
        '110001',
        '',
        exampleZoneId,
        exampleZoneName,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'https://maps.google.com/?q=...',
        '',
        '',
        '',
        '',
        '',
        '',
        'true',
      ],
    ];
    */

    const csv = buildCsv(headers, rows);
    downloadTextFile(csv, `workshops-import-template-${new Date().toISOString().slice(0, 10)}.csv`);
    setCsvInfo('Template downloaded. Fill rows and upload to create/update workshops.');
  };

  const applyWorkshopCsv = async (file: File) => {
    setCsvBusy(true);
    setCsvError('');
    setCsvInfo('');
    setCsvSummary(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (!grid.length) throw new Error('CSV is empty.');

      const header = grid[0].map((h) => (h || '').trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);
      const colAny = (names: string[]) => {
        for (const n of names) {
          const idx = col(n.toLowerCase());
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxName = col('name');
      const idxContact = col('contact_person');
      const idxPhone = col('phone');
      const idxEmail = col('email');
      const idxAddress = col('address');
      const idxCity = col('city');
      const idxState = col('state');
      const idxPincode = col('pincode');

      if ([idxName, idxContact, idxPhone, idxEmail, idxAddress, idxCity, idxState, idxPincode].some((i) => i === -1)) {
        throw new Error(
          'CSV must include required headers: name, contact_person, phone, email, address, city, state, pincode'
        );
      }

      const idxId = col('id');
      const idxZoneId = col('zone_id');
      const idxZoneName = col('zone_name');
      const idxGst = col('gst_number');
      const idxMap = col('map_link');
      const idxLat = col('latitude');
      const idxLng = col('longitude');
      const idxBank = col('bank_account_number');
      const idxIfsc = col('ifsc_code');
      const idxUpi = col('upi_id');
      const idxComm = col('commission_percentage');
      const idxVerified = col('is_verified');

      const idxWorkshopName = col('workshop_name');
      const idxAltMobile = col('alt_mobile');
      const idxNotificationMobile = col('notification_mobile');
      const idxShortAddress = col('short_address');
      const idxLocation = col('location');
      const idxServicePincode = col('service_pincode');

      const idxRoMumbai = col('ro_mumbai');
      const idxSystem = col('system');
      const idxCategory = col('category');
      const idxWorkshopArea = col('workshop_area');
      const idxLandmark = col('landmark');
      const idxDistance = col('distance');
      const idxNearFamousArea = col('near_famous_area');
      const idxNearAreaGoogleMap = col('near_area_google_map');

      const idxManagerName = col('manager_name');
      const idxManagerMobile = col('manager_mobile');
      const idxManagerName2 = col('manager_name2');
      const idxManagerMobile2 = col('manager_mobile2');
      const idxManagerName3 = col('manager_name3');
      const idxManagerMobile3 = col('manager_mobile3');

      const idxCreditSwap = colAny(['creadit_card_swap', 'credit_card_swap']);
      const idxEngineOil = col('engine_oil');
      const idxInsuranceClaim = col('insurance_claim');
      const idxServicePanelIssue = col('service_panel_issue');
      const idxNote = col('note');
      const idxActiveDate = col('active_date');
      const idxRetainerFee = col('retainer_fee');
      const idxPrepaidPostpaid = col('prepaid_postpaid');
      const idxMou = col('mou');
      const idxBoard = col('board');
      const idxGmb = col('gmb');
      const idxWhatsappGroupId = col('whatsapp_group_id');

      const rows = grid.slice(1).filter((r) => r.some((x) => (x || '').trim() !== ''));
      if (!rows.length) throw new Error('CSV has no data rows.');

      // Zone name -> id map
      const zoneNameToId = new Map<string, string>();
      for (const z of zones) {
        if (z?.name && z?.id) zoneNameToId.set(String(z.name).trim().toLowerCase(), String(z.id));
      }

      const errors: string[] = [];
      const tasks: Array<() => Promise<{ ok: boolean; kind: 'created' | 'updated' | 'skipped' | 'failed'; error?: string }>> = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;

        const id = idxId !== -1 ? (r[idxId] || '').trim() : '';
        const name = (r[idxName] || '').trim();
        const contact_person = (r[idxContact] || '').trim();
        const phone = (r[idxPhone] || '').trim();
        const email = (r[idxEmail] || '').trim();
        const address = (r[idxAddress] || '').trim();
        const city = (r[idxCity] || '').trim();
        const state = (r[idxState] || '').trim();
        const pincode = (r[idxPincode] || '').trim();
        const servicePincodeRaw = idxServicePincode !== -1 ? (r[idxServicePincode] || '').trim() : '';

        if (!name) errors.push(`Row ${rowNum}: name is required`);
        if (!contact_person) errors.push(`Row ${rowNum}: contact_person is required`);
        if (!phone) errors.push(`Row ${rowNum}: phone is required`);
        if (!email) errors.push(`Row ${rowNum}: email is required`);
        if (!address) errors.push(`Row ${rowNum}: address is required`);
        if (!city) errors.push(`Row ${rowNum}: city is required`);
        if (!state) errors.push(`Row ${rowNum}: state is required`);
        if (!pincode) errors.push(`Row ${rowNum}: pincode is required`);
        if (pincode && pincode.length > 10) errors.push(`Row ${rowNum}: pincode too long (max 10): "${pincode}"`);

        const zoneIdRaw = idxZoneId !== -1 ? (r[idxZoneId] || '').trim() : '';
        const zoneNameRaw = idxZoneName !== -1 ? (r[idxZoneName] || '').trim() : '';
        const resolvedZoneId =
          zoneIdRaw ||
          (zoneNameRaw ? zoneNameToId.get(zoneNameRaw.trim().toLowerCase()) || '' : '');

        if (zoneNameRaw && !zoneIdRaw && !resolvedZoneId) {
          errors.push(`Row ${rowNum}: zone_name "${zoneNameRaw}" not found`);
        }

        const parseOptionalNumber = (val: string) => {
          const t = (val || '').trim();
          if (!t) return null;
          const n = Number(t);
          if (!Number.isFinite(n)) return NaN;
          return n;
        };

        const lat = idxLat !== -1 ? parseOptionalNumber(r[idxLat] || '') : null;
        const lng = idxLng !== -1 ? parseOptionalNumber(r[idxLng] || '') : null;
        const comm = idxComm !== -1 ? parseOptionalNumber(r[idxComm] || '') : null;
        const distance = idxDistance !== -1 ? parseOptionalNumber(r[idxDistance] || '') : null;
        const retainer_fee = idxRetainerFee !== -1 ? (r[idxRetainerFee] || '').trim() : '';

        if (lat !== null && Number.isNaN(lat)) errors.push(`Row ${rowNum}: invalid latitude "${r[idxLat] || ''}"`);
        if (lng !== null && Number.isNaN(lng)) errors.push(`Row ${rowNum}: invalid longitude "${r[idxLng] || ''}"`);
        if (comm !== null && Number.isNaN(comm)) errors.push(`Row ${rowNum}: invalid commission_percentage "${r[idxComm] || ''}"`);
        if (distance !== null && Number.isNaN(distance)) errors.push(`Row ${rowNum}: invalid distance "${r[idxDistance] || ''}"`);
        // retainer_fee is TEXT in DB; no numeric validation

        const parseOptionalBoolean = (val: string) => {
          const t = (val || '').trim();
          if (!t) return null;
          const v = t.toLowerCase();
          if (['true', '1', 'yes', 'y'].includes(v)) return true;
          if (['false', '0', 'no', 'n'].includes(v)) return false;
          return 'INVALID';
        };

        const parseOptionalDate = (val: string) => {
          const t = (val || '').trim();
          if (!t) return null;
          // Expect YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return 'INVALID';
          return t;
        };

        const mou = idxMou !== -1 ? parseOptionalBoolean(r[idxMou] || '') : null;
        const board = idxBoard !== -1 ? parseOptionalBoolean(r[idxBoard] || '') : null;
        const gmb = idxGmb !== -1 ? parseOptionalBoolean(r[idxGmb] || '') : null;

        const activeDate = idxActiveDate !== -1 ? parseOptionalDate(r[idxActiveDate] || '') : null;

        const boolErr = (label: string, raw: string) => errors.push(`Row ${rowNum}: invalid ${label} "${raw}" (use true/false)`);
        if (mou === 'INVALID') boolErr('mou', r[idxMou] || '');
        if (board === 'INVALID') boolErr('board', r[idxBoard] || '');
        if (gmb === 'INVALID') boolErr('gmb', r[idxGmb] || '');

        if (activeDate === 'INVALID') errors.push(`Row ${rowNum}: invalid active_date "${r[idxActiveDate] || ''}" (use YYYY-MM-DD)`);

        const is_verified =
          idxVerified !== -1 && (r[idxVerified] || '').trim() !== ''
            ? ['true', '1', 'yes', 'y'].includes((r[idxVerified] || '').trim().toLowerCase())
            : true; // default true for bulk add

        const payload: any = {
          name,
          contact_person,
          phone,
          email,
          address,
          city,
          state,
          pincode,
          is_verified,
        };

        // Special handling: service_pincode is VARCHAR(10) but many sheets provide a list like:
        // "401502 | 401501 | 401404". In that case we:
        // - set service_pincode = first pincode
        // - set mapping_pincodes = all pincodes (jsonb) if more than one
        const extractPincodes = (raw: string) => {
          const t = (raw || '').trim();
          if (!t) return [] as string[];
          // Prefer digit runs (supports "400028/22" -> ["400028", "22"] so we filter by length below)
          const matches = t.match(/\b\d{2,10}\b/g) || [];
          const norm = matches.length ? matches : t.split(/[|,]/).map((x) => x.trim()).filter(Boolean);
          const cleaned = norm
            .map((x) => String(x).replace(/[^\d]/g, ''))
            .filter((x) => x.length > 0);
          const pincodes = cleaned.filter((x) => x.length >= 5 && x.length <= 10);
          return Array.from(new Set(pincodes));
        };

        if (idxServicePincode !== -1) {
          const pincodes = extractPincodes(servicePincodeRaw);
          if (pincodes.length === 0) {
            if (servicePincodeRaw && servicePincodeRaw.length > 10) {
              errors.push(
                `Row ${rowNum}: service_pincode too long (max 10). If you have multiple pincodes, separate them with | and we will store them in mapping_pincodes.`
              );
            } else {
              payload.service_pincode = servicePincodeRaw || null;
            }
          } else {
            payload.service_pincode = pincodes[0].slice(0, 10);
            if (pincodes.length > 1) payload.mapping_pincodes = pincodes;
          }
        }

        // Optional fields (only apply if header exists)
        const setOpt = (key: string, idx: number) => {
          if (idx === -1) return;
          const v = ((r[idx] || '').trim() || null) as any;
          payload[key] = v;
        };

        setOpt('workshop_name', idxWorkshopName);
        setOpt('alt_mobile', idxAltMobile);
        setOpt('notification_mobile', idxNotificationMobile);
        setOpt('short_address', idxShortAddress);
        setOpt('location', idxLocation);

        setOpt('ro_mumbai', idxRoMumbai);
        setOpt('system', idxSystem);
        setOpt('category', idxCategory);
        setOpt('workshop_area', idxWorkshopArea);
        setOpt('landmark', idxLandmark);
        setOpt('near_famous_area', idxNearFamousArea);
        setOpt('near_area_google_map', idxNearAreaGoogleMap);

        setOpt('manager_name', idxManagerName);
        setOpt('manager_mobile', idxManagerMobile);
        setOpt('manager_name2', idxManagerName2);
        setOpt('manager_mobile2', idxManagerMobile2);
        setOpt('manager_name3', idxManagerName3);
        setOpt('manager_mobile3', idxManagerMobile3);

        setOpt('note', idxNote);
        setOpt('prepaid_postpaid', idxPrepaidPostpaid);
        setOpt('whatsapp_group_id', idxWhatsappGroupId);

        if (idxGst !== -1) payload.gst_number = ((r[idxGst] || '').trim() || null) as any;
        if (idxMap !== -1) payload.map_link = ((r[idxMap] || '').trim() || null) as any;
        if (idxLat !== -1) payload.latitude = lat === null ? null : lat;
        if (idxLng !== -1) payload.longitude = lng === null ? null : lng;
        if (idxZoneId !== -1 || idxZoneName !== -1) payload.zone_id = resolvedZoneId || null;
        if (idxBank !== -1) payload.bank_account_number = ((r[idxBank] || '').trim() || null) as any;
        if (idxIfsc !== -1) payload.ifsc_code = ((r[idxIfsc] || '').trim() || null) as any;
        if (idxUpi !== -1) payload.upi_id = ((r[idxUpi] || '').trim() || null) as any;
        if (idxComm !== -1) payload.commission_percentage = comm === null ? null : comm;

        if (idxDistance !== -1) payload.distance = distance === null ? null : distance;
        if (idxRetainerFee !== -1) payload.retainer_fee = retainer_fee ? retainer_fee : null;
        if (idxActiveDate !== -1) payload.active_date = activeDate === null ? null : activeDate;

        if (idxCreditSwap !== -1) payload.creadit_card_swap = ((r[idxCreditSwap] || '').trim() || null) as any;
        if (idxEngineOil !== -1) payload.engine_oil = ((r[idxEngineOil] || '').trim() || null) as any;
        if (idxInsuranceClaim !== -1) payload.insurance_claim = ((r[idxInsuranceClaim] || '').trim() || null) as any;
        if (idxServicePanelIssue !== -1) payload.service_panel_issue = ((r[idxServicePanelIssue] || '').trim() || null) as any;
        if (idxMou !== -1) payload.mou = mou === null ? null : mou;
        if (idxBoard !== -1) payload.board = board === null ? null : board;
        if (idxGmb !== -1) payload.gmb = gmb === null ? null : gmb;

        if (id) {
          tasks.push(async () => {
            try {
              const { error } = await supabase.from('workshops').update(payload).eq('id', id);
              if (error) return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${error.message}` };
              return { ok: true, kind: 'updated' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${e?.message || 'Failed to update'}` };
            }
          });
        } else {
          tasks.push(async () => {
            try {
              const { error } = await supabase.from('workshops').insert([payload]);
              if (error) return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${error.message}` };
              return { ok: true, kind: 'created' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${e?.message || 'Failed to create'}` };
            }
          });
        }
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...and ${errors.length - 10} more` : ''));
      }

      const confirmed = confirm(`Upload will process ${tasks.length} row(s). Continue?`);
      if (!confirmed) return;

      const results = await runWithConcurrency(tasks, 6);
      const summary = { total: tasks.length, created: 0, updated: 0, skipped: 0, failed: 0 };
      const failedMsgs: string[] = [];
      for (const r of results) {
        if (!r?.ok) {
          summary.failed++;
          if (r?.error) failedMsgs.push(r.error);
          continue;
        }
        if (r.kind === 'created') summary.created++;
        else if (r.kind === 'updated') summary.updated++;
        else if (r.kind === 'skipped') summary.skipped++;
      }
      setCsvSummary(summary);
      if (failedMsgs.length) {
        setCsvError(failedMsgs.slice(0, 8).join('\n') + (failedMsgs.length > 8 ? `\n...and ${failedMsgs.length - 8} more` : ''));
      } else {
        setCsvInfo('Import completed successfully.');
      }

      await fetchWorkshops();
    } catch (e: any) {
      setCsvError(e?.message || 'Failed to import CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  const filteredWorkshops = workshops.filter((w) =>
    searchTerm === '' ||
    w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-8 sm:p-10 md:p-12 text-center text-sm sm:text-base text-gray-500">Loading workshops...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Store className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="truncate">Workshop Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Manage workshops, approvals, and zones</p>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={() => router.push('/dashboard/super_admin/workshops/public-pages')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Public Pages</span>
                <span className="sm:hidden">Public</span>
              </button>
              <button
                onClick={() => {
                  setCsvError('');
                  setCsvInfo('');
                  setCsvSummary(null);
                  setShowCsvModal(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
                title="Bulk add/update workshops via CSV"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Import/Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard/super_admin/workshops/add')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Add Workshop</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900">Import / Export Workshops (CSV)</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  Download template → fill rows → upload to create/update in bulk.
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
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-gray-600">
                  Zones loaded: <span className="font-medium text-gray-800">{zones.length}</span>
                  <span className="text-gray-400"> • </span>
                  Tip: provide <span className="font-mono">zone_id</span> (preferred) or <span className="font-mono">zone_name</span>.
                </div>
                <button
                  onClick={downloadWorkshopCsvTemplate}
                  disabled={csvBusy}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="text-xs sm:text-sm font-medium text-gray-800 mb-1">Upload CSV</div>
                <div className="text-[10px] sm:text-xs text-gray-500 mb-2">
                  Required columns: <span className="font-mono">name, contact_person, phone, email, address, city, state, pincode</span>.
                  If <span className="font-mono">id</span> is provided, that row will be updated; otherwise a new workshop will be created.
                </div>
                <div className="text-[10px] sm:text-xs text-gray-500 mb-2">
                  Tip: If you have multiple service pincodes, put them in <span className="font-mono">service_pincode</span> separated by <span className="font-mono">|</span>
                  (e.g. <span className="font-mono">401502 | 401501 | 401404</span>). We will auto-store the list in <span className="font-mono">mapping_pincodes</span>.
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyWorkshopCsv(f);
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-xs sm:text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {csvBusy ? 'Importing…' : 'Select CSV file'}
                  </div>
                </div>
              </div>

              {csvSummary && (
                <div className="text-xs sm:text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-1">Import Summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] sm:text-xs">
                    <div><span className="text-gray-500">Total</span>: {csvSummary.total}</div>
                    <div><span className="text-gray-500">Created</span>: {csvSummary.created}</div>
                    <div><span className="text-gray-500">Updated</span>: {csvSummary.updated}</div>
                    <div><span className="text-gray-500">Skipped</span>: {csvSummary.skipped}</div>
                    <div><span className="text-gray-500">Failed</span>: {csvSummary.failed}</div>
                  </div>
                </div>
              )}

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

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by name, city, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border rounded-lg"
                />
              </div>
            <div className="flex gap-2 overflow-x-auto">
            {['all', 'active', 'inactive', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg capitalize text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Workshops Table - Desktop */}
        <div className="bg-white rounded-lg shadow overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3">Workshop</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Contact</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Location / Zone</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Status</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="font-medium text-sm sm:text-base text-gray-900">{workshop.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{workshop.contact_person || 'N/A'}</div>
                        {(workshop.short_address || workshop.workshop_area) && (
                          <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                            {workshop.short_address || workshop.workshop_area}
                          </div>
                        )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                        <div className="text-gray-900 truncate max-w-[200px]">{workshop.phone}</div>
                        <div className="text-gray-500 truncate">{workshop.email}</div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                      <div className="text-gray-900">{workshop.city}, {workshop.state}</div>
                      {workshop.zones?.name ? (
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-blue-600 mt-1">
                          <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> {workshop.zones.name}
                        </div>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-orange-500 mt-1">No Zone Assigned</div>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className={`px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {workshop.is_verified ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                        <button onClick={() => handleEditClick(workshop)} className="text-blue-600 hover:text-blue-900 whitespace-nowrap">
                          Edit
                        </button>
                        {workshop.is_verified ? (
                          <button onClick={() => handleDisable(workshop.id)} className="text-red-600 hover:text-red-900 whitespace-nowrap">Disable</button>
                        ) : (
                          <button onClick={() => handleApprove(workshop.id)} className="text-green-600 hover:text-green-900 whitespace-nowrap">Approve</button>
                        )}
                        <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="text-purple-600 hover:text-purple-900 whitespace-nowrap">
                          Manage Rate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Workshops Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
          {filteredWorkshops.map((workshop) => (
            <div key={workshop.id} className="bg-white rounded-lg shadow p-3 sm:p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm sm:text-base text-gray-900 mb-1">{workshop.name}</div>
                  <div className="text-xs text-gray-500">{workshop.contact_person || 'N/A'}</div>
                  {(workshop.short_address || workshop.workshop_area) && (
                    <div className="text-[11px] text-gray-400 mt-1">{workshop.short_address || workshop.workshop_area}</div>
                  )}
                </div>
                <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full flex-shrink-0 ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {workshop.is_verified ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900">{workshop.phone}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 truncate max-w-[200px]">{workshop.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Location:</span>
                  <span className="text-gray-900">{workshop.city}, {workshop.state}</span>
                </div>
                {workshop.zones?.name && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Zone:</span>
                    <div className="flex items-center gap-1 text-blue-600 font-semibold">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {workshop.zones.name}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEditClick(workshop)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-lg hover:bg-blue-50">
                  Edit
                </button>
                {workshop.is_verified ? (
                  <button onClick={() => handleDisable(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => handleApprove(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-green-600 hover:text-green-900 border border-green-200 rounded-lg hover:bg-green-50">
                    Approve
                  </button>
                )}
                <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-purple-600 hover:text-purple-900 border border-purple-200 rounded-lg hover:bg-purple-50">
                  Manage Rate
                </button>
              </div>
            </div>
          ))}

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-white rounded-lg shadow">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal (Full Details) */}
      {showEditModal && editingWorkshop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl max-w-3xl w-full p-4 sm:p-5 md:p-6 m-2 sm:m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-5 md:mb-6 border-b pb-3 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-bold">Edit Workshop Details</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveChanges} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Basic Info */}
              <div className="col-span-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Basic Information</h3>
              </div>
              
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Name *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.name} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, name: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Alternate Workshop Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.workshop_name || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, workshop_name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.contact_person} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, contact_person: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.phone} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, phone: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.alt_mobile || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, alt_mobile: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notification Mobile</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.notification_mobile || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, notification_mobile: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.email} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, email: e.target.value})} 
                />
              </div>

              {/* Address */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Location & Address</h3>
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea required className="w-full px-3 py-2 text-sm border rounded-lg" rows={2}
                  value={editingWorkshop.address} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, address: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Short Address</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.short_address || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, short_address: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Location (sheet)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.location || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, location: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Map Link</label>
                <div className="relative">
                  <Globe className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <input
                    type="url"
                    placeholder="Paste Google Maps link (https://maps.google.com/...)"
                    className="w-full pl-9 sm:pl-10 pr-3 py-2 text-sm border rounded-lg"
                    value={editingWorkshop.map_link || ''}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, map_link: e.target.value })}
                  />
                </div>
                {!!editingWorkshop.map_link && (
                  <a
                    href={editingWorkshop.map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open link
                  </a>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.latitude ?? ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, latitude: e.target.value })}
                  placeholder="Example: 28.6139"
                />
                <div className="text-[11px] text-gray-500 mt-1">Distance calculation requires lat/lng.</div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.longitude ?? ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, longitude: e.target.value })}
                  placeholder="Example: 77.2090"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.city} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, city: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.state} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, state: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.pincode} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, pincode: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Service Pincode</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.service_pincode || ''}
                  onChange={(e) => setEditingWorkshop({ ...editingWorkshop, service_pincode: e.target.value })}
                />
              </div>

              {/* Zone Selector */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-blue-800 mb-1">Assign Zone *</label>
                <div className="relative">
                  <MapPin className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-blue-500 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <select 
                    className="w-full pl-8 sm:pl-10 px-3 py-2 text-sm border rounded-lg bg-blue-50 focus:bg-white border-blue-200"
                    value={editingWorkshop.zone_id || ''}
                    onChange={e => setEditingWorkshop({...editingWorkshop, zone_id: e.target.value || null})}
                  >
                    <option value="">-- No Zone Assigned --</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="col-span-2">
                <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                  <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-gray-800">
                    Extra Fields (optional)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Area</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.workshop_area || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, workshop_area: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Landmark</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.landmark || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, landmark: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.distance ?? ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, distance: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Near Famous Area</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.near_famous_area || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, near_famous_area: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Near Area (Google Map)</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.near_area_google_map || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, near_area_google_map: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">RO Mumbai</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.ro_mumbai || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, ro_mumbai: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">System</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.system || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, system: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.category || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, category: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">WhatsApp Group ID</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.whatsapp_group_id || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, whatsapp_group_id: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_name || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Mobile</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_mobile || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_mobile: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Name 2</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_name2 || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_name2: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Mobile 2</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_mobile2 || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_mobile2: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Name 3</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_name3 || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_name3: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Manager Mobile 3</label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 text-sm border rounded-lg"
                          value={editingWorkshop.manager_mobile3 || ''}
                          onChange={(e) => setEditingWorkshop({ ...editingWorkshop, manager_mobile3: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Note</label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        rows={2}
                        value={editingWorkshop.note || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, note: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Active Date</label>
                      <input
                        type="date"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.active_date ? String(editingWorkshop.active_date).slice(0, 10) : ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, active_date: e.target.value || null })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Retainer Fee</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.retainer_fee ?? ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, retainer_fee: e.target.value })}
                        placeholder="Example: 5000 / 5000+GST / NA"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Prepaid/Postpaid</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                        value={editingWorkshop.prepaid_postpaid || ''}
                        onChange={(e) => setEditingWorkshop({ ...editingWorkshop, prepaid_postpaid: e.target.value })}
                      />
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        ['creadit_card_swap', 'Credit Card Swap'],
                        ['engine_oil', 'Engine Oil'],
                        ['insurance_claim', 'Insurance Claim'],
                        ['service_panel_issue', 'Service Panel Issue'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{label}</label>
                          <select
                            className="w-full px-3 py-2 text-sm border rounded-lg"
                            value={editingWorkshop[key] || ''}
                            onChange={(e) => setEditingWorkshop({ ...editingWorkshop, [key]: e.target.value })}
                          >
                            <option value="">--</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        ['mou', 'MOU'],
                        ['board', 'Board'],
                        ['gmb', 'GMB'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-xs sm:text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={!!editingWorkshop[key]}
                            onChange={(e) => setEditingWorkshop({ ...editingWorkshop, [key]: e.target.checked })}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>

              {/* Bank Details */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Bank & Financial Details</h3>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.gst_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, gst_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.commission_percentage || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, commission_percentage: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.bank_account_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, bank_account_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.ifsc_code || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, ifsc_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.upi_id || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, upi_id: e.target.value})} 
                />
              </div>

              <div className="col-span-2 flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-3 sm:pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
