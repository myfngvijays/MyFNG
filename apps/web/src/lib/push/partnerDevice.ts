/** Staff partner app (com.myfng.partner) vs customer app (com.myfng.app). */

export const PARTNER_IOS_BUNDLE_ID = 'com.myfng.partner';
export const PARTNER_ANDROID_PACKAGE = 'com.myfng.partner';
export const CUSTOMER_IOS_BUNDLE_ID = 'com.myfng.app';

/** Stored in notification_devices.device_name when registering from the partner binary. */
export const PARTNER_DEVICE_APP_MARKER = `app=${PARTNER_ANDROID_PACKAGE}`;

export function appendAppPackageToDeviceName(deviceName: string, appPackage?: string | null): string {
  const base = String(deviceName || '').trim() || 'Mobile';
  const pkg = String(appPackage || '').trim();
  if (!pkg) return base;
  if (base.includes('app=')) return base;
  return `${base} | app=${pkg}`;
}

export function parseDeviceNameBase(deviceName: string | null | undefined): string {
  return String(deviceName || '').split('|')[0].trim();
}

export function isPartnerStaffDevice(deviceName: string | null | undefined): boolean {
  const raw = String(deviceName || '').toLowerCase();
  return (
    raw.includes(PARTNER_DEVICE_APP_MARKER.toLowerCase()) ||
    raw.includes('myfng partner') ||
    raw.includes('com.myfng.partner')
  );
}

export function apnsTopicForStaffDevice(
  deviceName: string | null | undefined,
  defaultIosBundleId: string,
): string {
  return isPartnerStaffDevice(deviceName) ? PARTNER_IOS_BUNDLE_ID : defaultIosBundleId || CUSTOMER_IOS_BUNDLE_ID;
}