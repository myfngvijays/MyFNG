'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ArrowLeft, Save, Store, User, Building2, Banknote } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddWorkshopPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Workshop Details
    name: '',
    workshop_name: '',
    map_link: '',
    gst_number: '',
    state: '',
    district: '',
    city: '',
    rto_code: '',
    pincode: '',
    service_pincode: '',
    mapping_pincodes: '', // CSV string
    address: '',
    short_address: '',
    location: '',
    ro_mumbai: '',
    system: '',
    category: '',
    workshop_area: '',
    landmark: '',
    distance: '',
    near_famous_area: '',
    near_area_google_map: '',
    pickup_drop_km: '',
    one_day_capacity: '',
    latitude: '',
    longitude: '',
    working_time: '09:00 AM - 06:00 PM',
    working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    google_place_id: '',
    workshop_type: 'Car Service Center',
    whatsapp_group_id: '',
    creadit_card_swap: '',
    engine_oil: '',
    insurance_claim: '',
    service_panel_issue: '',
    note: '',
    active_date: '',
    retainer_fee: '',
    prepaid_postpaid: '',
    mou: false,
    board: false,
    gmb: false,
    
    // Contact Details
    contact_person: '',
    designation: '',
    phone: '',
    is_whatsapp: true,
    email: '',
    alt_mobile: '',
    notification_mobile: '',
    manager_name: '',
    manager_mobile: '',
    manager_name2: '',
    manager_mobile2: '',
    manager_name3: '',
    manager_mobile3: '',
    id_proof: '',

    // Bank Details
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    upi_id: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDayChange = (day: string) => {
    setFormData(prev => {
      const days = prev.working_days.includes(day)
        ? prev.working_days.filter(d => d !== day)
        : [...prev.working_days, day];
      return { ...prev, working_days: days };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.state || !formData.district || !formData.city || 
          !formData.rto_code || !formData.pincode || !formData.address || 
          !formData.pickup_drop_km || !formData.one_day_capacity || !formData.contact_person || 
          !formData.phone) {
        toast.error('Please fill all required fields');
        setLoading(false);
        return;
      }

      // Prepare data for submission
      const workshopData = {
        name: formData.name,
        workshop_name: formData.workshop_name || null,
        map_link: formData.map_link || null,
        gst_number: formData.gst_number || null,
        state: formData.state,
        district: formData.district,
        city: formData.city,
        rto_code: formData.rto_code,
        pincode: formData.pincode,
        service_pincode: formData.service_pincode || null,
        mapping_pincodes: formData.mapping_pincodes.split(',').map(p => p.trim()).filter(p => p),
        address: formData.address,
        short_address: formData.short_address || null,
        location: formData.location || null,
        ro_mumbai: formData.ro_mumbai || null,
        system: formData.system || null,
        category: formData.category || null,
        workshop_area: formData.workshop_area || null,
        landmark: formData.landmark || null,
        distance: formData.distance ? parseFloat(formData.distance) : null,
        near_famous_area: formData.near_famous_area || null,
        near_area_google_map: formData.near_area_google_map || null,
        pickup_drop_km: parseFloat(formData.pickup_drop_km) || 0,
        one_day_capacity: parseInt(formData.one_day_capacity) || 0,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        working_time: formData.working_time,
        working_days: formData.working_days,
        google_place_id: formData.google_place_id || null,
        workshop_type: formData.workshop_type,
        whatsapp_group_id: formData.whatsapp_group_id || null,
        creadit_card_swap: formData.creadit_card_swap || null,
        engine_oil: formData.engine_oil || null,
        insurance_claim: formData.insurance_claim || null,
        service_panel_issue: formData.service_panel_issue || null,
        note: formData.note || null,
        active_date: formData.active_date || null,
        retainer_fee: formData.retainer_fee || null,
        prepaid_postpaid: formData.prepaid_postpaid || null,
        mou: formData.mou,
        board: formData.board,
        gmb: formData.gmb,
        
        contact_person: formData.contact_person,
        designation: formData.designation || null,
        phone: formData.phone,
        is_whatsapp: formData.is_whatsapp,
        email: formData.email || null,
        alt_mobile: formData.alt_mobile || null,
        notification_mobile: formData.notification_mobile || null,
        manager_name: formData.manager_name || null,
        manager_mobile: formData.manager_mobile || null,
        manager_name2: formData.manager_name2 || null,
        manager_mobile2: formData.manager_mobile2 || null,
        manager_name3: formData.manager_name3 || null,
        manager_mobile3: formData.manager_mobile3 || null,
        id_proof: formData.id_proof || null,

        bank_name: formData.bank_name || null,
        account_number: formData.account_number || null,
        ifsc_code: formData.ifsc_code || null,
        upi_id: formData.upi_id || null,
        
        is_verified: true // Auto-verify when added by Super Admin
      };

      const { error } = await supabase
        .from('workshops')
        .insert([workshopData]);

      if (error) throw error;

      toast.success('Workshop added successfully!');
      router.push('/dashboard/super_admin/workshops');
    } catch (error: any) {
      console.error('Error adding workshop:', error);
      toast.error('Failed to add workshop: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="min-h-screen bg-gray-50 pb-8 sm:pb-10 md:pb-12">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            <button 
              onClick={() => router.back()}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Add New Workshop</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Enter workshop details, contact info, and banking details</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 md:space-y-8">
          
          {/* Workshop Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-b border-gray-200 flex items-center gap-1.5 sm:gap-2">
              <Store className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
              <h2 className="font-semibold text-sm sm:text-base text-gray-800">Workshop Details</h2>
            </div>
            <div className="p-4 sm:p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Service Centre Name *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Alternate Workshop Name</label>
                <input type="text" name="workshop_name" value={formData.workshop_name} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Type</label>
                <select name="workshop_type" value={formData.workshop_type} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                  <option>Car Service Center</option>
                  <option>Bike Service Center</option>
                  <option>Tyre Shop</option>
                  <option>Detailing Studio</option>
                </select>
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">GST No</label>
                <input type="text" name="gst_number" value={formData.gst_number} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Map Link</label>
                <input type="text" name="map_link" value={formData.map_link} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" placeholder="https://maps.google.com/..." />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Google Place ID</label>
                <input type="text" name="google_place_id" value={formData.google_place_id} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">RTO Code *</label>
                <input type="text" name="rto_code" value={formData.rto_code} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Address *</label>
                <textarea name="address" value={formData.address} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" rows={2} required />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Short Address</label>
                <input type="text" name="short_address" value={formData.short_address} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" name="state" value={formData.state} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">District *</label>
                <input type="text" name="district" value={formData.district} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input type="text" name="pincode" value={formData.pincode} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Service Pincode</label>
                <input type="text" name="service_pincode" value={formData.service_pincode} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Mapping Pincodes (Comma Separated) *</label>
                <input type="text" name="mapping_pincodes" value={formData.mapping_pincodes} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" placeholder="400601, 400602, 400603" />
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pickup & Drop Range (Km) *</label>
                <input type="number" name="pickup_drop_km" value={formData.pickup_drop_km} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">One Day Capacity (Cars) *</label>
                <input type="number" name="one_day_capacity" value={formData.one_day_capacity} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Working Time *</label>
                <input type="text" name="working_time" value={formData.working_time} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" required />
              </div>

              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input type="text" name="latitude" value={formData.latitude} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>
              <div className="sm:col-span-1 lg:col-span-1">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input type="text" name="longitude" value={formData.longitude} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
              </div>
              
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Working Days *</label>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {daysOfWeek.map(day => (
                    <label key={day} className="flex items-center gap-1.5 sm:gap-2 cursor-pointer bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded border hover:bg-gray-100">
                      <input 
                        type="checkbox" 
                        checked={formData.working_days.includes(day)} 
                        onChange={() => handleDayChange(day)}
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-xs sm:text-sm text-gray-700">{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 sm:p-4">
                  <summary className="cursor-pointer text-xs sm:text-sm font-semibold text-gray-800">
                    Extra Fields (optional)
                  </summary>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Location (sheet)</label>
                      <input type="text" name="location" value={formData.location} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Area</label>
                      <input type="text" name="workshop_area" value={formData.workshop_area} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Landmark</label>
                      <input type="text" name="landmark" value={formData.landmark} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                      <input type="number" step="0.01" name="distance" value={formData.distance} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Near Famous Area</label>
                      <input type="text" name="near_famous_area" value={formData.near_famous_area} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Near Area (Google Map)</label>
                      <input type="text" name="near_area_google_map" value={formData.near_area_google_map} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">RO Mumbai</label>
                      <input type="text" name="ro_mumbai" value={formData.ro_mumbai} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">System</label>
                      <input type="text" name="system" value={formData.system} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
                      <input type="text" name="category" value={formData.category} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">WhatsApp Group ID</label>
                      <input type="text" name="whatsapp_group_id" value={formData.whatsapp_group_id} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Active Date</label>
                      <input type="date" name="active_date" value={formData.active_date} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Retainer Fee</label>
                      <input type="text" name="retainer_fee" value={formData.retainer_fee} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" placeholder="Example: 5000 / 5000+GST / NA" />
                    </div>
                    <div className="lg:col-span-1">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Prepaid/Postpaid</label>
                      <input type="text" name="prepaid_postpaid" value={formData.prepaid_postpaid} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" />
                    </div>
                    <div className="lg:col-span-3">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Note</label>
                      <textarea name="note" value={formData.note} onChange={handleChange} className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2" rows={2} />
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        ['creadit_card_swap', 'Credit Card Swap'],
                        ['engine_oil', 'Engine Oil'],
                        ['insurance_claim', 'Insurance Claim'],
                        ['service_panel_issue', 'Service Panel Issue'],
                      ].map(([key, label]) => (
                        <div key={key}>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">{label}</label>
                          <select
                            name={key}
                            value={(formData as any)[key]}
                            onChange={handleChange}
                            className="input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                          >
                            <option value="">--</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
                        </div>
                      ))}
                    </div>

                    <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        ['mou', 'MOU'],
                        ['board', 'Board'],
                        ['gmb', 'GMB'],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" name={key} checked={(formData as any)[key]} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-xs sm:text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Contact Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <User className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-gray-800">Contact Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name *</label>
                <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className="input w-full" required />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Proof (Aadhar/PAN)</label>
                <input type="text" name="id_proof" value={formData.id_proof} onChange={handleChange} className="input w-full" />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input w-full" required />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Alternate Mobile</label>
                <input type="tel" name="alt_mobile" value={formData.alt_mobile} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notification Mobile</label>
                <input type="tel" name="notification_mobile" value={formData.notification_mobile} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1 flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="is_whatsapp" checked={formData.is_whatsapp} onChange={handleChange} className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-sm font-medium text-gray-700">Is WhatsApp Number?</span>
                </label>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="input w-full" />
              </div>

              <div className="md:col-span-3">
                <details className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                    Manager Details (optional)
                  </summary>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                      <input type="text" name="manager_name" value={formData.manager_name} onChange={handleChange} className="input w-full" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Mobile</label>
                      <input type="tel" name="manager_mobile" value={formData.manager_mobile} onChange={handleChange} className="input w-full" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name 2</label>
                      <input type="text" name="manager_name2" value={formData.manager_name2} onChange={handleChange} className="input w-full" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Mobile 2</label>
                      <input type="tel" name="manager_mobile2" value={formData.manager_mobile2} onChange={handleChange} className="input w-full" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name 3</label>
                      <input type="text" name="manager_name3" value={formData.manager_name3} onChange={handleChange} className="input w-full" />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Manager Mobile 3</label>
                      <input type="tel" name="manager_mobile3" value={formData.manager_mobile3} onChange={handleChange} className="input w-full" />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Bank Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-gray-800">Bank Details</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <input type="text" name="account_number" value={formData.account_number} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                <input type="text" name="ifsc_code" value={formData.ifsc_code} onChange={handleChange} className="input w-full" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                <input type="text" name="upi_id" value={formData.upi_id} onChange={handleChange} className="input w-full" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Workshop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

