'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import WorkshopChat from '@/components/chat/WorkshopChat';
import { createClient } from '@/lib/supabase/client';

export default function WorkshopChatWebsitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user || null;
        if (!user) {
          setAllowed(false);
          setLoading(false);
          return;
        }

        const selectProfile = 'id, roles!inner(role_code)';
        const { data: profile } = await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle();
        const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
        const isWorkshop =
          roleCode === 'WORKSHOP_ADMIN' ||
          roleCode === 'WORKSHOP_SUPERVISOR' ||
          roleCode === 'WORKSHOP_MECHANIC' ||
          roleCode === 'WORKSHOP_PICKUP_BOY';

        if (!isWorkshop) {
          router.push('/dashboard');
          return;
        }

        setAllowed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold text-gray-900">Workshop Chat</h1>
        <p className="text-sm text-gray-600 mt-2">Continue karne ke liye login karein (workshop role required).</p>
        <div className="mt-4">
          <Link className="inline-flex px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700" href="/login">
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-grey p-4">
      <WorkshopChat />
    </div>
  );
}

