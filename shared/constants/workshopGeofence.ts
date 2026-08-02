/** Default geofence radius around MyFNG service centers (meters). */
export const DEFAULT_WORKSHOP_GEOFENCE_RADIUS_M = 750;

/** Allowed range when editing radius in system settings (meters). */
export const MIN_WORKSHOP_GEOFENCE_RADIUS_M = 200;
export const MAX_WORKSHOP_GEOFENCE_RADIUS_M = 2000;

/** iOS allows max 20 monitored regions per app. */
export const MAX_WORKSHOP_GEOFENCE_REGIONS = 20;

/** Minimum hours between repeat alerts for same customer + workshop. */
export const WORKSHOP_PROXIMITY_DEDUP_HOURS = 24;

export const WORKSHOP_GEOFENCE_TASK_NAME = 'MYFNG_WORKSHOP_GEOFENCE';
