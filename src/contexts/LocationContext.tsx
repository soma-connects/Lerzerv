import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { artisanService } from '../services/artisanService';
import type { IServiceArea } from '../types/marketplace';
import { citiesOf, detectArea, getPosition, type AreaWithCentre, type GpsError } from '../lib/geo';

/**
 * Where the visitor is: their city (Lagos, Port Harcourt, Omoku) and, when
 * GPS found it, their neighbourhood. Every page that shows areas reads this,
 * so the forms and lists match where the person actually is.
 *
 * It's remembered on this device (localStorage), so we only ask once.
 */

export type DetectResult =
  | { ok: true; city: string; areaName: string | null }
  | { ok: false; reason: GpsError | 'outside'; nearestCity?: string };

interface Saved { city: string; areaSlug: string | null; source: 'gps' | 'manual' }

interface LocationValue {
  /** Every active area, in the database's order. */
  areas: IServiceArea[];
  /** Cities we serve, e.g. ['Lagos', 'Port Harcourt', 'Omoku']. */
  cities: string[];
  /** The visitor's city, or null if we don't know yet. */
  city: string | null;
  /** Their neighbourhood (an area slug) if GPS found one. */
  areaSlug: string | null;
  /** The areas in their city (all areas if the city is unknown). */
  cityAreas: IServiceArea[];
  /** True once we've asked (or they've chosen), so we stop prompting. */
  decided: boolean;
  detecting: boolean;
  chooseCity: (city: string) => void;
  chooseArea: (slug: string) => void;
  /** Ask the browser for GPS and pick the nearest area. */
  detect: () => Promise<DetectResult>;
  /** Hide the first-visit prompt without choosing. */
  dismiss: () => void;
}

const KEY = 'lezerv.location';
const DISMISS_KEY = 'lezerv.location.dismissed';

// Browser storage can be blocked (private mode, strict settings): never let that break the page.
function load(): Saved | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Saved) : null; } catch { return null; }
}
function save(v: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}
function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

const LocationContext = createContext<LocationValue | null>(null);

const asCentres = (list: IServiceArea[]): AreaWithCentre[] =>
  list.map((a) => ({ slug: a.slug, name: a.name, city: a.city || 'Lagos', lat: a.lat ?? null, lng: a.lng ?? null }));

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [areas, setAreas] = useState<IServiceArea[]>([]);
  const [saved, setSaved] = useState<Saved | null>(load);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [detecting, setDetecting] = useState(false);
  const areasRef = useRef<IServiceArea[]>([]);

  useEffect(() => {
    let alive = true;
    artisanService.fetchAreas().then((a) => {
      if (!alive) return;
      areasRef.current = a;
      setAreas(a);
    });
    return () => { alive = false; };
  }, []);

  const update = useCallback((v: Saved) => { setSaved(v); save(v); }, []);

  const chooseCity = useCallback((city: string) => {
    update({ city, areaSlug: null, source: 'manual' });
  }, [update]);

  const chooseArea = useCallback((slug: string) => {
    const a = areasRef.current.find((x) => x.slug === slug);
    update({ city: a?.city || saved?.city || 'Lagos', areaSlug: slug, source: 'manual' });
  }, [update, saved]);

  const detect = useCallback(async (): Promise<DetectResult> => {
    setDetecting(true);
    try {
      const point = await getPosition();
      const d = detectArea(point, asCentres(areasRef.current));
      if (d.kind === 'outside') return { ok: false, reason: 'outside', nearestCity: d.nearestCity };
      update({ city: d.city, areaSlug: d.area?.slug ?? null, source: 'gps' });
      return { ok: true, city: d.city, areaName: d.area && d.area.name !== d.city ? d.area.name : null };
    } catch (e) {
      return { ok: false, reason: (typeof e === 'string' ? e : 'unavailable') as GpsError };
    } finally {
      setDetecting(false);
    }
  }, [update]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
  }, []);

  // If this person already allowed location before (and didn't pick a city
  // by hand), quietly refresh it: no prompt appears when permission is granted.
  useEffect(() => {
    if (saved?.source === 'manual' || !navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
      if (!cancelled && p.state === 'granted' && areas.length > 0) void detect();
    }).catch(() => { /* not supported */ });
    return () => { cancelled = true; };
    // Run once the areas have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areas.length]);

  const value = useMemo<LocationValue>(() => {
    const cities = citiesOf(asCentres(areas));
    const city = saved?.city ?? null;
    const cityAreas = city ? areas.filter((a) => (a.city || 'Lagos') === city) : areas;
    const areaSlug = saved?.areaSlug && areas.some((a) => a.slug === saved.areaSlug) ? saved.areaSlug : null;
    return {
      areas, cities, city, areaSlug,
      cityAreas: cityAreas.length > 0 ? cityAreas : areas,
      decided: !!saved || dismissed,
      detecting, chooseCity, chooseArea, detect, dismiss,
    };
  }, [areas, saved, dismissed, detecting, chooseCity, chooseArea, detect, dismiss]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

/** The visitor's location. (Named useRegion so it doesn't clash with react-router's useLocation.) */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegion(): LocationValue {
  const v = useContext(LocationContext);
  if (!v) throw new Error('useRegion must be used inside <LocationProvider>');
  return v;
}

/** Same as useRegion, but returns null outside the provider (for components also used on their own). */
// eslint-disable-next-line react-refresh/only-export-components
export function useRegionMaybe(): LocationValue | null {
  return useContext(LocationContext);
}
