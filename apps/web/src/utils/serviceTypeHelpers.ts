// Utility function to fetch service type names from Supabase
export async function getServiceTypeNames(serviceTypeIds: string | string[] | null): Promise<string> {
  if (!serviceTypeIds) return 'N/A';
  
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  try {
    // Parse if it's a JSON string
    let ids: string[] = [];
    if (typeof serviceTypeIds === 'string') {
      try {
        ids = JSON.parse(serviceTypeIds);
      } catch {
        ids = [serviceTypeIds];
      }
    } else {
      ids = serviceTypeIds;
    }

    if (ids.length === 0) return 'N/A';

    // Fetch service type names
    const { data, error } = await supabase
      .from('service_types')
      .select('id, name')
      .in('id', ids);

    if (error || !data) {
      console.error('Error fetching service types:', error);
      return 'N/A';
    }

    return data.map(st => st.name).join(', ') || 'N/A';
  } catch (error) {
    console.error('Error parsing service type IDs:', error);
    return 'N/A';
  }
}

// Utility function to fetch subservice names from Supabase
export async function getSubserviceNames(subserviceIds: string | string[] | null): Promise<string> {
  if (!subserviceIds) return '';
  
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  try {
    // Parse if it's a JSON string
    let ids: string[] = [];
    if (typeof subserviceIds === 'string') {
      try {
        ids = JSON.parse(subserviceIds);
      } catch {
        ids = [subserviceIds];
      }
    } else {
      ids = subserviceIds;
    }

    if (ids.length === 0) return '';

    // Fetch subservice names
    const { data, error } = await supabase
      .from('subservices')
      .select('id, name')
      .in('id', ids);

    if (error || !data) {
      console.error('Error fetching subservices:', error);
      return '';
    }

    return data.map(ss => ss.name).join(', ') || '';
  } catch (error) {
    console.error('Error parsing subservice IDs:', error);
    return '';
  }
}

// Hook to use service type names in React components
export function useServiceTypeNames(serviceTypeIds: string | string[] | null) {
  const [names, setNames] = React.useState<string>('Loading...');

  React.useEffect(() => {
    getServiceTypeNames(serviceTypeIds).then(setNames);
  }, [serviceTypeIds]);

  return names;
}

// Hook to use subservice names in React components
export function useSubserviceNames(subserviceIds: string | string[] | null) {
  const [names, setNames] = React.useState<string>('');

  React.useEffect(() => {
    getSubserviceNames(subserviceIds).then(setNames);
  }, [subserviceIds]);

  return names;
}

import React from 'react';

