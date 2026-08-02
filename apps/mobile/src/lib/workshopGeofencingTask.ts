import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import { WORKSHOP_GEOFENCE_TASK_NAME } from '../constants/workshopGeofence';
import { getTaskManager } from './taskManagerSafe';

const CUSTOMER_SESSION_KEY = 'customer_session_token';

export function registerWorkshopGeofencingTask(): boolean {
  const TaskManager = getTaskManager();
  if (!TaskManager) return false;
  if (TaskManager.isTaskDefined(WORKSHOP_GEOFENCE_TASK_NAME)) return true;

  TaskManager.defineTask(WORKSHOP_GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('[workshop-geofence task]', error.message);
      return;
    }

    const event = data as Location.LocationGeofencingEvent | undefined;
    if (!event || event.eventType !== Location.GeofencingEventType.Enter) return;

    const workshopId = String(event.region?.identifier || '').trim();
    if (!workshopId) return;

    try {
      const token = await AsyncStorage.getItem(CUSTOMER_SESSION_KEY);
      if (!token) return;

      await fetch(`${ENV.API_URL}/api/customer/workshop-proximity/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-customer-session': token,
          'x-mobile-client': 'true',
          'X-App-Platform': Platform.OS,
        },
        body: JSON.stringify({
          workshop_id: workshopId,
          source: 'geofence',
          event_type: 'enter',
        }),
      });
    } catch (taskErr) {
      console.warn('[workshop-geofence task] report failed:', taskErr);
    }
  });

  return true;
}
