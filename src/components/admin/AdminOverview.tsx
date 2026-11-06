import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { useRegionMaybe } from '../../contexts/LocationContext';
import './AdminShell.css';

/**
 * The admin's first screen: what's happening and what needs doing, worked
 * out from data the admin page has already loaded. Nothing here is sample
 * data: an empty database shows zeros and "All caught up".
 */

export type AdminTab =
  | 'overview' | 'dispatch' | 'bookings' | 'support' | 'artisans' | 'users' | 'ambassadors'
  | 'jobs' | 'applications' | 'services' | 'settings' | 'blog';

interface DispatchJob {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  area_name?: string | null;
  category_name?: string | null;
  assigned_name?: string | null;
  job_number?: string | null;
}

interface Props {
  dispatchJobs: DispatchJob[];
  artisans: { id: string; status: string; display_name?: string | null; city?: string | null; created_at?: string }[];
  bookings: { id: string; status: string; order_number?: string; service_name?: string; customer?: { name?: string } }[];
  unreadApplications: number;
  onGo: (tab: AdminTab) => void;
}

const HOUR = 3600e3;
const ago = (iso: string, now: number) => {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.round(mins / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} days`;
};
const STATUS: Record<string, string> = { open: 'Open', assigned: 'Assigned', in_progress: 'In progress', completed: 'Done', cancelled: 'Cancelled' };

export const AdminOverview: React.FC<Props> = ({ dispatchJobs, artisans, bookings, unreadApplications, onGo }) => {
  const region = useRegionMaybe();

  // Area name → city, from the service areas (Lagos neighbourhoods, Port Harcourt, Omoku).
  const cityOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of region?.areas ?? []) map.set(a.name, a.city || 'Lagos');
    return (area?: string | null) => (area ? map.get(area) ?? 'Other' : 'No area');
  }, [region?.areas]);

  // "Now", read once when the dashboard opens (reading the clock while
  // drawing would give a different answer on every redraw).
  const [now] = useState(() => Date.now());
  const open = dispatchJobs.filter((j) => j.status === 'open');
  const active = dispatchJobs.filter((j) => ['assigned', 'in_progress'].includes(j.status));
  const doneWeek = dispatchJobs.filter((j) => j.status === 'completed' && now - new Date(j.updated_at || j.created_at).getTime() < 7 * 24 * HOUR);
  const waitingLong = open.filter((j) => now - new Date(j.created_at).getTime() > HOUR);
  const pendingArtisans = artisans.filter((a) => a.status === 'pending');
  const payments = bookings.filter((b) => b.status === 'awaiting_confirmation');
  const newBookings = bookings.filter((b) => b.status === 'pending');

  const perCity = (rows: DispatchJob[]) => {
    const counts = new Map<string, number>();
    for (const j of rows) counts.set(cityOf(j.area_name), (counts.get(cityOf(j.area_name)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  };
  const activeCities = perCity(active).length;
  const doneByCity = perCity(doneWeek).map(([c, n]) => `${c} ${n}`).join(' · ');

  // Jobs posted in the last 30 days, by city
  const recentMonth = dispatchJobs.filter((j) => now - new Date(j.created_at).getTime() < 30 * 24 * HOUR);
  const byCity = perCity(recentMonth);
  const maxCity = Math.max(1, ...byCity.map(([, n]) => n));

  // The to-do list, most urgent first
  const todo = [
    ...[...open].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).slice(0, 4).map((j) => ({
      key: `job-${j.id}`, tag: 'Job', tone: 'amber',
      text: `${j.job_number ? `${j.job_number} ` : ''}${j.title}${j.area_name ? `, ${j.area_name}` : ''}: waiting ${ago(j.created_at, now)} for an artisan`,
      action: 'Assign', tab: 'dispatch' as AdminTab,
    })),
    ...pendingArtisans.slice(0, 3).map((a) => ({
      key: `art-${a.id}`, tag: 'Artisan', tone: 'green',
      text: `New artisan to review${a.display_name ? `: ${a.display_name}` : ''}${a.city ? ` (${a.city})` : ''}`,
      action: 'Review', tab: 'artisans' as AdminTab,
    })),
    ...payments.slice(0, 3).map((b) => ({
      key: `pay-${b.id}`, tag: 'Payment', tone: 'red',
      text: `Payment to confirm for ${b.order_number || 'a booking'}${b.service_name ? ` (${b.service_name})` : ''}`,
      action: 'Check', tab: 'bookings' as AdminTab,
    })),
    ...newBookings.slice(0, 2).map((b) => ({
      key: `bk-${b.id}`, tag: 'Booking', tone: 'amber',
      text: `New booking ${b.order_number || ''}${b.customer?.name ? ` from ${b.customer.name}` : ''}`.trim(),
      action: 'Review', tab: 'bookings' as AdminTab,
    })),
    ...(unreadApplications > 0 ? [{
      key: 'careers', tag: 'Careers', tone: 'green',
      text: `${unreadApplications} new career application${unreadApplications === 1 ? '' : 's'}`,
      action: 'Open', tab: 'applications' as AdminTab,
    }] : []),
  ];

  const recent = [...dispatchJobs].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 6);

  const stats = [
    { label: 'Open jobs', value: open.length, sub: waitingLong.length ? `${waitingLong.length} waiting over an hour` : 'None waiting long', tab: 'dispatch' as AdminTab },
    { label: 'In progress', value: active.length, sub: active.length ? `Across ${activeCities} ${activeCities === 1 ? 'city' : 'cities'}` : 'Nothing under way', tab: 'dispatch' as AdminTab },
    { label: 'Done in the last 7 days', value: doneWeek.length, sub: doneByCity || 'None yet this week', tab: 'dispatch' as AdminTab },
    { label: 'Artisans to review', value: pendingArtisans.length, sub: pendingArtisans.length ? 'ID checks waiting' : 'All reviewed', tab: 'artisans' as AdminTab },
  ];

  return (
    <div className="adm-ov">
      <div className="adm-stats">
        {stats.map((s) => (
          <button key={s.label} type="button" className="adm-stat" onClick={() => onGo(s.tab)}>
            <span className="adm-stat-label">{s.label}</span>
            <span className="adm-stat-value">{s.value}</span>
            <span className="adm-stat-sub">{s.sub}</span>
          </button>
        ))}
      </div>

      <div className="adm-ov-row">
        <section className="adm-panel adm-todo">
          <h2>Needs your attention</h2>
          {todo.length === 0 ? (
            <p className="adm-empty"><CheckCircle2 size={20} /> All caught up.</p>
          ) : (
            <ul>
              {todo.map((t) => (
                <li key={t.key}>
                  <span className={`adm-tag ${t.tone}`}>{t.tag}</span>
                  <span className="adm-todo-text">{t.text}</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onGo(t.tab)}>{t.action}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-panel adm-cities">
          <h2>Jobs by city <small>last 30 days</small></h2>
          {byCity.length === 0 ? (
            <p className="adm-empty">No jobs posted in the last 30 days.</p>
          ) : (
            byCity.map(([city, n]) => (
              <div key={city} className="adm-city">
                <div className="adm-city-row"><span>{city}</span><span>{n}</span></div>
                <div className="adm-bar"><motion.div initial={{ width: 0 }} animate={{ width: `${(n / maxCity) * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} /></div>
              </div>
            ))
          )}
        </section>
      </div>

      <section className="adm-panel">
        <div className="adm-panel-head">
          <h2>Recent jobs</h2>
          <button type="button" className="adm-link" onClick={() => onGo('dispatch')}>See all jobs</button>
        </div>
        {recent.length === 0 ? (
          <p className="adm-empty">No service jobs yet.</p>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th>Job</th><th>Service</th><th>Area</th><th>Artisan</th><th>Status</th><th>Posted</th></tr>
              </thead>
              <tbody>
                {recent.map((j) => (
                  <tr key={j.id}>
                    <td className="adm-ref">{j.job_number || `#${j.id.slice(0, 6)}`}</td>
                    <td>{j.category_name || j.title}</td>
                    <td>{j.area_name || '—'}</td>
                    <td>{j.assigned_name || <span className="adm-muted">Not yet assigned</span>}</td>
                    <td><span className={`adm-pill s-${j.status}`}>{STATUS[j.status] || j.status}</span></td>
                    <td className="adm-muted">{ago(j.created_at, now)} ago</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
