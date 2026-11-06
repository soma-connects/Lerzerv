import React, { useEffect, useRef, useState } from 'react';
import { useLocation as useRoute } from 'react-router-dom';
import { Check, ChevronDown, LocateFixed, Loader2, MapPin, X } from 'lucide-react';
import { useRegion } from '../../contexts/LocationContext';
import { KNOWN_CITIES } from '../../lib/geo';
import './LocationPicker.css';

// Pages where a first-time visitor is asked where they are (once).
const ASK_ON = ['/', '/find-artisans', '/post-job', '/services'];

const stateOf = (city: string) => KNOWN_CITIES.find((c) => c.city === city)?.state ?? '';

/** "📍 Lagos ▾" in the header. Opens a card to use GPS or pick a city. */
export const LocationPicker: React.FC = () => {
  const { city, areaSlug, areas, cities, decided, detecting, detect, chooseCity, dismiss } = useRegion();
  const { pathname } = useRoute();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  const areaName = areas.find((a) => a.slug === areaSlug)?.name;
  const label = city ? (areaName && areaName !== city ? `${areaName}, ${city}` : city) : 'Your location';

  const close = () => {
    setOpen(false);
    setNote(null);
    if (!decided) dismiss(); // closing the first-visit card counts as "not now"
  };

  // First visit: open the card by itself after a moment, once.
  useEffect(() => {
    if (decided || askedRef.current || !ASK_ON.includes(pathname)) return;
    const t = setTimeout(() => { askedRef.current = true; setOpen(true); }, 1200);
    return () => clearTimeout(t);
  }, [decided, pathname]);

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const useGps = async () => {
    setNote(null);
    const r = await detect();
    if (r.ok) {
      setNote({ tone: 'ok', text: `Found you in ${r.areaName ? `${r.areaName}, ` : ''}${r.city}.` });
      setTimeout(() => { setOpen(false); setNote(null); }, 1400);
      return;
    }
    const text =
      r.reason === 'denied' ? 'Location is switched off for this site. Allow it in your browser settings, or pick your city below.'
      : r.reason === 'outside' ? `You seem to be outside our areas for now. We work in ${cities.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
      : 'We couldn’t get your location. Please pick your city below.';
    setNote({ tone: 'warn', text });
  };

  const pick = (c: string) => { chooseCity(c); setOpen(false); setNote(null); };

  return (
    <div className="loc" ref={wrapRef}>
      <button
        className={`loc-chip ${city ? '' : 'loc-chip-empty'} ${open ? 'is-open' : ''}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={city ? `Your location: ${label}. Change` : 'Choose your location'}
      >
        <MapPin size={16} />
        <span className="loc-chip-text">{label}</span>
        <ChevronDown size={14} className="loc-chev" />
      </button>

      {open && (
        <div className="loc-card" role="dialog" aria-label="Choose your location">
          <button className="loc-x" onClick={close} aria-label="Close"><X size={18} /></button>
          <h2 className="loc-title">Where do you need help?</h2>
          <p className="loc-sub">We’ll show you artisans and areas near you.</p>

          <button className="btn btn-primary btn-md btn-full-width" onClick={useGps} disabled={detecting}>
            {detecting ? <Loader2 size={18} className="loc-spin" /> : <LocateFixed size={18} />}
            <span>{detecting ? 'Finding you…' : 'Use my location'}</span>
          </button>

          {note && <p className={`loc-note loc-note-${note.tone}`} role="status">{note.text}</p>}

          <div className="loc-or"><span>or choose</span></div>

          <div className="loc-cities">
            {cities.map((c) => (
              <button key={c} className={`loc-city ${city === c ? 'selected' : ''}`} onClick={() => pick(c)}>
                <span className="loc-city-name">{c}</span>
                <span className="loc-city-state">{stateOf(c)}</span>
                {city === c && <Check size={16} className="loc-city-check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
