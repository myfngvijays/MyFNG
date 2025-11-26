'use client';

/**
 * Job Card & Parts Section - SIMPLIFIED FOR DEBUGGING
 * Testing without RLS to isolate 406 error
 */

import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface JobCardSectionProps {
  lead: any;
  onUpdate?: () => void;
}

export default function JobCardSection({ lead, onUpdate }: JobCardSectionProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    testConnection();
  }, [lead.id]);

  async function testConnection() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    try {
      console.log('=== DEBUG INFO ===');
      console.log('Lead ID:', lead.id);

      // Test 1: Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Auth User:', user?.id);
      console.log('Auth Error:', authError);

      if (authError || !user) {
        setError('Authentication failed: ' + (authError?.message || 'No user'));
        setLoading(false);
        return;
      }

      // Test 2: Try to query with detailed error logging
      console.log('Attempting query...');
      
      const { data, error: queryError, status, statusText } = await supabase
        .from('job_cards')
        .select('*')
        .eq('lead_id', lead.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid error on no rows

      console.log('Query Status:', status);
      console.log('Query StatusText:', statusText);
      console.log('Query Data:', data);
      console.log('Query Error:', queryError);

      if (queryError) {
        console.error('Full Error Object:', JSON.stringify(queryError, null, 2));
        
        setDebugInfo({
          status,
          statusText,
          errorCode: queryError.code,
          errorMessage: queryError.message,
          errorDetails: queryError.details,
          errorHint: queryError.hint,
          userId: user.id,
          leadId: lead.id,
        });

        setError(`Query failed: ${queryError.message} (Status: ${status})`);
        setLoading(false);
        return;
      }

      if (!data) {
        console.log('No job card found for this lead');
        setError('No job card exists for this lead (this is OK)');
        setLoading(false);
        return;
      }

      console.log('SUCCESS! Job card found:', data);
      setError('SUCCESS! Data loaded: ' + data.job_card_number);
      
    } catch (err: any) {
      console.error('Unexpected error:', err);
      setError('Unexpected error: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Job Card - DEBUG MODE</h3>
      </div>

      {loading && (
        <p className="text-gray-500">Testing connection...</p>
      )}

      {error && (
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <p className={error.includes('SUCCESS') ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
            {error}
          </p>
        </div>
      )}

      {debugInfo && (
        <div className="mt-4 p-4 bg-red-50 rounded">
          <p className="font-semibold text-red-800 mb-2">Debug Information:</p>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 rounded">
        <p className="text-sm text-blue-800">
          <strong>Check browser console for detailed logs</strong>
        </p>
        <p className="text-xs text-blue-600 mt-2">
          • RLS is disabled on job_cards table<br />
          • All permissions are granted<br />
          • If still getting 406, it's a PostgREST API issue
        </p>
      </div>
    </div>
  );
}

