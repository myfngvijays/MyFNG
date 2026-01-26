'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';

export default function CompanyVanDriverProfilePage() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('users_login')
        .select('full_name, email, phone, created_at')
        .eq('id', user.id)
        .single();
      setProfile(data || null);
    } catch (e) {
      console.error('Failed to load profile', e);
    }
  }

  return (
    <DashboardLayout role="company_van_driver">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-text-heading">My Profile</h1>
        <div className="card p-4 space-y-2">
          <div><span className="text-xs text-gray-500">Name</span><div>{profile?.full_name || '—'}</div></div>
          <div><span className="text-xs text-gray-500">Email</span><div>{profile?.email || '—'}</div></div>
          <div><span className="text-xs text-gray-500">Phone</span><div>{profile?.phone || '—'}</div></div>
        </div>
      </div>
    </DashboardLayout>
  );
}
