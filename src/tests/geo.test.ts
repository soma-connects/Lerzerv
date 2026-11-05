import { describe, expect, it } from 'vitest';
import { citiesOf, detectArea, distanceKm, type AreaWithCentre } from '../lib/geo';

const areas: AreaWithCentre[] = [
  { slug: 'ikeja', name: 'Ikeja', city: 'Lagos', lat: 6.6018, lng: 3.3515 },
  { slug: 'lekki', name: 'Lekki', city: 'Lagos', lat: 6.445, lng: 3.49 },
  { slug: 'port-harcourt', name: 'Port Harcourt', city: 'Port Harcourt', lat: 4.8156, lng: 7.0498 },
  { slug: 'omoku', name: 'Omoku', city: 'Omoku', lat: 5.3426, lng: 6.6572 },
];

describe('distanceKm', () => {
  it('is zero for the same point and about right for a known distance', () => {
    expect(distanceKm({ lat: 6.5, lng: 3.4 }, { lat: 6.5, lng: 3.4 })).toBe(0);
    // Lagos to Port Harcourt is roughly 435 km in a straight line
    const km = distanceKm({ lat: 6.5244, lng: 3.3792 }, { lat: 4.8156, lng: 7.0498 });
    expect(km).toBeGreaterThan(420);
    expect(km).toBeLessThan(450);
  });
});

describe('detectArea', () => {
  it('finds the nearest Lagos neighbourhood', () => {
    const d = detectArea({ lat: 6.44, lng: 3.47 }, areas); // near Lekki Phase 1
    expect(d).toMatchObject({ kind: 'inside', city: 'Lagos', area: { slug: 'lekki' } });
  });

  it('tells Omoku and Port Harcourt apart', () => {
    expect(detectArea({ lat: 5.35, lng: 6.65 }, areas)).toMatchObject({ kind: 'inside', city: 'Omoku' });
    expect(detectArea({ lat: 4.84, lng: 7.01 }, areas)).toMatchObject({ kind: 'inside', city: 'Port Harcourt' });
  });

  it('says outside when every area is far away (Abuja)', () => {
    const d = detectArea({ lat: 9.0765, lng: 7.3986 }, areas);
    expect(d.kind).toBe('outside');
  });

  it('falls back to city centres when areas have no coordinates', () => {
    const bare = areas.map((a) => ({ ...a, lat: null, lng: null }));
    expect(detectArea({ lat: 5.34, lng: 6.66 }, bare)).toMatchObject({ kind: 'inside', city: 'Omoku', area: null });
  });
});

describe('citiesOf', () => {
  it('lists each city once, in order', () => {
    expect(citiesOf(areas)).toEqual(['Lagos', 'Port Harcourt', 'Omoku']);
  });
  it('falls back to the known cities when there are no areas', () => {
    expect(citiesOf([])).toEqual(['Lagos', 'Port Harcourt', 'Omoku']);
  });
});
