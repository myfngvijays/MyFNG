'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Building2, Save, Phone, Mail, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function WorkshopSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshop, setWorkshop] = useState<any>({
    name: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_person: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchWorkshopSettings();
  }, []);

  async function fetchWorkshopSettings() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) {
        setLoading(false);
        return;
      }

      const { data: workshopData } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single();

      if (workshopData) {
        setWorkshop(workshopData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching workshop settings:', error);
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          ...workshop,
          updated_at: new Date().toISOString()
        })
        .eq('id', workshop.id);

      if (!error) {
        alert('Settings saved successfully!');
      } else {
        alert('Error saving settings');
      }
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-text-heading flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Workshop Settings
          </h1>
          <p className="text-text-body mt-2">Manage your workshop information and preferences</p>
        </div>

        {/* Workshop Info Card */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-6">Workshop Information</h2>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Workshop Name
              </label>
              <input
                type="text"
                value={workshop.name}
                onChange={(e) => setWorkshop({ ...workshop, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Full Address
              </label>
              <textarea
                value={workshop.address}
                onChange={(e) => setWorkshop({ ...workshop, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* City, State, Pincode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={workshop.city}
                  onChange={(e) => setWorkshop({ ...workshop, city: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={workshop.state}
                  onChange={(e) => setWorkshop({ ...workshop, state: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pincode
                </label>
                <input
                  type="text"
                  value={workshop.pincode}
                  onChange={(e) => setWorkshop({ ...workshop, pincode: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={workshop.contact_person}
                    onChange={(e) => setWorkshop({ ...workshop, contact_person: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={workshop.phone}
                    onChange={(e) => setWorkshop({ ...workshop, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={workshop.email}
                  onChange={(e) => setWorkshop({ ...workshop, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Verification Status */}
            {workshop.is_verified !== undefined && (
              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Verification Status</h3>
                <div className={`p-4 rounded-lg ${
                  workshop.is_verified 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}>
                  <p className="font-semibold">
                    {workshop.is_verified ? '✓ Verified Workshop' : '⏳ Pending Verification'}
                  </p>
                  <p className="text-sm mt-1">
                    {workshop.is_verified 
                      ? 'Your workshop is verified and can receive leads.'
                      : 'Your workshop is pending verification. You will receive leads once verified.'}
                  </p>
                  {workshop.audit_score && (
                    <p className="text-sm mt-2">
                      Audit Score: <span className="font-bold">{workshop.audit_score}/5</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="border-t pt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary w-full md:w-auto"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

