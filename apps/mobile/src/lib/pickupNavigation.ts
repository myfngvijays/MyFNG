export type PickupNavParams = {
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  title?: string;
};

export function buildPickupMapsUrl(params: PickupNavParams): string | null {
  const lat = params.latitude != null ? Number(params.latitude) : NaN;
  const lng = params.longitude != null ? Number(params.longitude) : NaN;
  const address = String(params.address || '').trim();

  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  }
  if (address && address !== '-') {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
  }
  return null;
}

export function resolvePickupNavFromLead(lead: any, tracking?: any, deliveryMode = false): PickupNavParams {
  if (deliveryMode) {
    return {
      latitude: tracking?.drop_latitude ?? lead?.drop_latitude,
      longitude: tracking?.drop_longitude ?? lead?.drop_longitude,
      address: tracking?.drop_address ?? lead?.delivery_address ?? lead?.customer_address ?? lead?.address,
      title: lead?.customer_name || 'Delivery',
    };
  }
  return {
    latitude: tracking?.pickup_latitude ?? lead?.pickup_latitude ?? lead?.latitude,
    longitude: tracking?.pickup_longitude ?? lead?.pickup_longitude ?? lead?.longitude,
    address:
      tracking?.pickup_address ?? lead?.pickup_address ?? lead?.customer_address ?? lead?.address,
    title: lead?.customer_name || 'Pickup',
  };
}

export function openInAppPickupNavigation(navigation: any, params: PickupNavParams) {
  const url = buildPickupMapsUrl(params);
  if (!url) return false;
  navigation.navigate('PickupInAppNavigate', { ...params, mapsUrl: url });
  return true;
}
