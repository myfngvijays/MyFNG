/**
 * Offline Service for Mobile App
 * Phase 4 - Task WA-701
 * 
 * Features:
 * - Cache leads for offline viewing
 * - Queue actions when offline
 * - Sync when connection restored
 * - Conflict resolution
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const CACHE_KEYS = {
  LEADS: 'offline_leads',
  PENDING_ACTIONS: 'pending_actions',
  LAST_SYNC: 'last_sync_time',
};

export interface PendingAction {
  id: string;
  type: 'UPDATE_STATUS' | 'ADD_NOTE' | 'UPLOAD_PHOTO' | 'ACCEPT_LEAD' | 'REJECT_LEAD';
  leadId: string;
  data: any;
  timestamp: number;
}

/**
 * Check network status
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

/**
 * Cache leads for offline access
 */
export async function cacheLeads(leads: any[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.LEADS, JSON.stringify(leads));
    await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Error caching leads:', error);
    return false;
  }
}

/**
 * Get cached leads
 */
export async function getCachedLeads(): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.LEADS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting cached leads:', error);
    return [];
  }
}

/**
 * Queue action for later sync
 */
export async function queueAction(action: Omit<PendingAction, 'id' | 'timestamp'>): Promise<boolean> {
  try {
    const pending = await getPendingActions();
    const newAction: PendingAction = {
      ...action,
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    pending.push(newAction);
    await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(pending));
    
    console.log('[OFFLINE] Action queued:', newAction.type);
    return true;
  } catch (error) {
    console.error('Error queuing action:', error);
    return false;
  }
}

/**
 * Get pending actions
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.PENDING_ACTIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting pending actions:', error);
    return [];
  }
}

/**
 * Sync pending actions
 */
export async function syncPendingActions(): Promise<{ success: number; failed: number }> {
  const online = await isOnline();
  if (!online) {
    console.log('[OFFLINE] Cannot sync - no connection');
    return { success: 0, failed: 0 };
  }

  const pending = await getPendingActions();
  if (pending.length === 0) {
    return { success: 0, failed: 0 };
  }

  console.log(`[OFFLINE] Syncing ${pending.length} pending actions...`);

  let success = 0;
  let failed = 0;
  const remaining: PendingAction[] = [];

  for (const action of pending) {
    try {
      const synced = await syncAction(action);
      if (synced) {
        success++;
      } else {
        failed++;
        remaining.push(action);
      }
    } catch (error) {
      console.error('Error syncing action:', error);
      failed++;
      remaining.push(action);
    }
  }

  // Update pending actions
  await AsyncStorage.setItem(CACHE_KEYS.PENDING_ACTIONS, JSON.stringify(remaining));

  console.log(`[OFFLINE] Sync complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

/**
 * Sync single action
 */
async function syncAction(action: PendingAction): Promise<boolean> {
  try {
    // Import supabase dynamically to avoid circular dependencies
    const { supabase } = require('../lib/supabase');

    switch (action.type) {
      case 'UPDATE_STATUS':
        const { error: statusError } = await supabase
          .from('service_leads')
          .update({ status: action.data.status })
          .eq('id', action.leadId);
        return !statusError;

      case 'ADD_NOTE':
        const { error: noteError } = await supabase
          .from('lead_events')
          .insert({
            lead_id: action.leadId,
            event_type: 'NOTE_ADDED',
            event_description: action.data.note,
          });
        return !noteError;

      case 'ACCEPT_LEAD':
        // Call accept API
        const acceptResponse = await fetch(`http://localhost:3000/api/leads/${action.leadId}/accept`, {
          method: 'POST',
        });
        return acceptResponse.ok;

      case 'REJECT_LEAD':
        // Call reject API
        const rejectResponse = await fetch(`http://localhost:3000/api/leads/${action.leadId}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: action.data.reason }),
        });
        return rejectResponse.ok;

      default:
        console.warn('Unknown action type:', action.type);
        return false;
    }
  } catch (error) {
    console.error('Error syncing action:', error);
    return false;
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.LEADS,
      CACHE_KEYS.PENDING_ACTIONS,
      CACHE_KEYS.LAST_SYNC,
    ]);
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
}

/**
 * Get last sync time
 */
export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const time = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
    return time ? new Date(time) : null;
  } catch (error) {
    console.error('Error getting last sync time:', error);
    return null;
  }
}

/**
 * Setup network listener
 */
export function setupNetworkListener(onOnline: () => void, onOffline: () => void) {
  return NetInfo.addEventListener((state: any) => {
    if (state.isConnected) {
      console.log('[OFFLINE] Connection restored');
      onOnline();
    } else {
      console.log('[OFFLINE] Connection lost');
      onOffline();
    }
  });
}

/**
 * Get offline status
 */
export async function getOfflineStatus(): Promise<{
  isOnline: boolean;
  cachedLeadsCount: number;
  pendingActionsCount: number;
  lastSync: Date | null;
}> {
  const online = await isOnline();
  const cachedLeads = await getCachedLeads();
  const pendingActions = await getPendingActions();
  const lastSync = await getLastSyncTime();

  return {
    isOnline: online,
    cachedLeadsCount: cachedLeads.length,
    pendingActionsCount: pendingActions.length,
    lastSync,
  };
}

