'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function HomeServiceTechniciansPage() {
  const [loading, setLoading] = useState(true);
  const [techs, setTechs] = useState<any[]>([]);

  useEffect(() => {
    fetchTechs();
  }, []);

  async function fetchTechs() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: role } = await supabase.from('roles').select('id').eq('role_code', 'COMPANY_VAN_TECHNICIAN').single();
      const roleId = role?.id;
      if (!roleId) {
        setTechs([]);
        return;
      }
      const { data, error } = await supabase
        .from('users_login')
        .select('id, full_name, email, phone, is_active')
        .eq('role_id', roleId)
        .order('full_name', { ascending: true });
      if (error) throw error;
      setTechs(data || []);
    } catch (e) {
      console.error('Failed to load technicians', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="home_service_manager">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-text-heading">Technicians</h1>
          <p className="text-sm text-gray-600 mt-1">Company van technicians list</p>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              )}
              {!loading && techs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">No technicians found</td>
                </tr>
              )}
              {techs.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{t.full_name || '—'}</td>
                  <td className="px-4 py-3">{t.phone || '—'}</td>
                  <td className="px-4 py-3">{t.email || '—'}</td>
                  <td className="px-4 py-3">{t.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
