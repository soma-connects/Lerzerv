/**
 * Working out which Lezerv area someone is in, from a GPS position.
 *
 * The idea: every service area (Ikeja, Lekki, Port Harcourt, Omoku…) has a
 * centre point in the database (service_areas.lat / lng). Whichever centre is
 * closest to you is your area, and that area's city is your region, as long
 * as it's close enough. Too far from every area means "we're not there yet".
 */

export interface GeoPoint { lat: number; lng: number }

export interface AreaWithCentre {
  slug: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
}

/**
 * The cities Lezerv works in, with a centre each. Used when the area list
 * can't be loaded, so the location picker still works. Keep in step with the
 * service_areas table (migration 0036 adds Port Harcourt and Omoku).
 */
export const KNOWN_CITIES: { city: string; state: string; centre: GeoPoint }[] = [
  { city: 'Lagos', state: 'Lagos State', centre: { lat: 6.5244, lng: 3.3792 } },
  { city: 'Port Harcourt', state: 'Rivers State', centre: { lat: 4.8156, lng: 7.0498 } },
  { city: 'Omoku', state: 'Rivers State', centre: { lat: 5.3426, lng: 6.6572 } },
];

/** How far from the nearest area centre still counts as "in" that area. */
export const MAX_AREA_KM = 35;

/**
 * Straight-line distance between two points on Earth, in kilometres
 * (the "haversine" formula: it accounts for the Earth being round).
 */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371; // Earth's radius in km
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type Detected =
  | { kind: 'inside'; city: string; area: AreaWithCentre | null; km: number }
  | { kind: 'outside'; nearestCity: string; km: number };

/**
 * Which area (and city) a point is in. Uses the areas' own centres when we
 * have them, else the city centres above (area is then null).
 */
export function detectArea(point: GeoPoint, areas: AreaWithCentre[], maxKm = MAX_AREA_KM): Detected {
  const located = areas.filter((a) => a.lat != null && a.lng != null);
  let best: { city: string; area: AreaWithCentre | null; km: number } | null = null;

  if (located.length > 0) {
    for (const a of located) {
      const km = distanceKm(point, { lat: a.lat as number, lng: a.lng as number });
      if (!best || km < best.km) best = { city: a.city, area: a, km };
    }
  } else {
    for (const c of KNOWN_CITIES) {
      const km = distanceKm(point, c.centre);
      if (!best || km < best.km) best = { city: c.city, area: null, km };
    }
  }

  if (!best) return { kind: 'outside', nearestCity: KNOWN_CITIES[0].city, km: Infinity };
  return best.km <= maxKm
    ? { kind: 'inside', city: best.city, area: best.area, km: best.km }
    : { kind: 'outside', nearestCity: best.city, km: best.km };
}

/** Cities in the order their areas are listed (service_areas.sort_order). */
export function citiesOf(areas: AreaWithCentre[]): string[] {
  const seen: string[] = [];
  for (const a of areas) if (a.city && !seen.includes(a.city)) seen.push(a.city);
  return seen.length > 0 ? seen : KNOWN_CITIES.map((c) => c.city);
}

export type GpsError = 'denied' | 'unavailable' | 'timeout' | 'unsupported';

/**
 * Ask the browser for the phone's / computer's position. The browser shows
 * its own "Allow location?" prompt the first time. Rejects with a GpsError.
 */
export function getPosition(timeoutMs = 12000): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { reject('unsupported' as GpsError); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject((err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable') as GpsError),
      // Low accuracy is enough to tell neighbourhoods apart, and much faster
      // (Wi-Fi / mobile network instead of waiting for a satellite fix).
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    );
  });
}
