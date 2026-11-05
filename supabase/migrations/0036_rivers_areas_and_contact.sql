-- ═══════════════════════════════════════════════════════════════════
-- 0036_rivers_areas_and_contact.sql
--
-- Lezerv operates in Lagos and in Rivers State (Port Harcourt, and Omoku
-- in particular). Until now the database only knew Lagos neighbourhoods
-- (0008), so nobody in Port Harcourt or Omoku could pick their area when
-- posting a job, and no artisan could say they work there.
--
--   1. service_areas: adds Port Harcourt and Omoku, with a map centre each
--      (0025's lat / lng). One area per town to start; split Port Harcourt
--      into neighbourhoods later in the Table Editor if it helps matching
--      (new rows need a unique slug, a name, the city and a sort_order).
--   2. customer_email_html (0026): customers are told to write to
--      lezervlimited@gmail.com, the address the team reads, instead of
--      support@lezerv.com. Also uses Lezerv green instead of the old navy.
--      Same parameters as 0026, so every email trigger keeps working.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Rivers State service areas ───────────────────────────────────
insert into public.service_areas (slug, name, city, sort_order) values
  ('port-harcourt', 'Port Harcourt', 'Port Harcourt', 300),
  ('omoku', 'Omoku', 'Omoku', 310)
on conflict (slug) do nothing;

-- Town centres, good to a kilometre or so (adjust freely, like 0025's).
-- Only fills areas that have none, so later corrections survive a re-run.
update public.service_areas s
set lat = v.lat, lng = v.lng
from (values
  ('port-harcourt', 4.8156, 7.0498),
  ('omoku', 5.3426, 6.6572)
) as v(slug, lat, lng)
where s.slug = v.slug and s.lat is null;

-- ── 2. Customer emails: contact address and colours ─────────────────
create or replace function public.customer_email_html(
  p_heading text,
  p_paragraphs text[],
  p_rows jsonb default null,
  p_highlight_label text default null,
  p_highlight text default null,
  p_steps text[] default null,
  p_cta_label text default null,
  p_cta_url text default null
)
returns text
language sql stable set search_path = public
as $$
  select
    '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;'
    || 'border:1px solid #e3ddd2;border-radius:16px;">'
    || '<h2 style="color:#13261a;margin-top:0;">' || public.admin_alert_escape(p_heading) || '</h2>'
    || coalesce((
         select string_agg('<p style="color:#374151;line-height:1.6;">'
                           || public.admin_alert_escape(p) || '</p>', '' order by i)
         from unnest(p_paragraphs) with ordinality as t(p, i)
       ), '')
    || case when coalesce(trim(p_highlight), '') = '' then '' else
         '<div style="margin:24px 0;padding:20px;background:#0e6e2f;border-radius:12px;'
         || 'color:#fff;text-align:center;">'
         || '<p style="margin:0 0 8px;font-size:0.95rem;opacity:0.85;">'
         || public.admin_alert_escape(coalesce(p_highlight_label, '')) || '</p>'
         || '<p style="margin:0;font-size:2rem;letter-spacing:2px;font-weight:bold;">'
         || public.admin_alert_escape(p_highlight) || '</p></div>'
       end
    || coalesce(
         '<table style="width:100%;border-collapse:collapse;font-size:0.95rem;margin-top:16px;">'
         || (select string_agg(
               '<tr><td style="padding:8px 0;color:#4b5563;font-weight:bold;width:140px;'
               || 'vertical-align:top;">' || public.admin_alert_escape(r->>'label') || '</td>'
               || '<td style="padding:8px 0;color:#111827;">'
               || public.admin_alert_escape(r->>'value') || '</td></tr>', '')
             from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
             where coalesce(trim(r->>'value'), '') <> '')
         || '</table>', '')
    || coalesce(
         '<ol style="color:#4b5563;line-height:1.6;">'
         || (select string_agg('<li>' || public.admin_alert_escape(s) || '</li>', '' order by i)
             from unnest(p_steps) with ordinality as t(s, i))
         || '</ol>', '')
    || case when coalesce(p_cta_url, '') = '' then '' else
         '<div style="text-align:center;margin:28px 0 8px;">'
         || '<a href="' || public.admin_alert_escape(p_cta_url) || '" '
         || 'style="display:inline-block;background:#0e6e2f;color:#fff;text-decoration:none;'
         || 'padding:12px 28px;border-radius:9999px;font-weight:bold;">'
         || public.admin_alert_escape(coalesce(p_cta_label, 'Open Lezerv')) || '</a></div>'
       end
    || '<p style="color:#9ca3af;font-size:0.8rem;text-align:center;margin-top:24px;">'
    || 'Questions? Reply to this email or write to '
    || '<a href="mailto:lezervlimited@gmail.com" style="color:#0e6e2f;">lezervlimited@gmail.com</a>.</p>'
    || '</div>';
$$;
