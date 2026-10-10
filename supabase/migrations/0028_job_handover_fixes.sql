-- ═══════════════════════════════════════════════════════════════════
-- 0028_job_handover_fixes.sql
--
-- Two defects in what happens when an artisan leaves a job - by declining
-- it (0020), by letting an offer run out (0023), or because the team moves
-- it. Found by running the whole migration chain on a real schema; each
-- PR had been checked alone, against a stand-in that hid both.
--
-- 1. The chat could not be detached.
--    decline_assigned_job (0020) hands the conversation over by clearing
--    conversations.artisan_id, because read access to a chat is keyed on it:
--    leaving the artisan on the row would let someone who walked away keep
--    reading what the client writes next and what their replacement writes.
--    But 0007 declared that column NOT NULL, so the UPDATE raised and the
--    whole decline rolled back - "Can't take it" could never succeed.
--    Nothing else needs it to be NOT NULL: the read policy and
--    is_conversation_participant compare it inside exists(...), which is
--    false for NULL; send_message's join simply finds no artisan; and
--    accepting an offer (0023) already re-points the row to the new artisan.
--
-- 2. A site visit outlived the artisan who made it.
--    A visit (0019) belongs to whoever stood in the room. decline_assigned_job
--    reset the quote but not the visit, so the replacement - who has never
--    seen the place - sent a price labelled FIRM (submit_job_quote derives
--    that from visited_at), and a firm price is locked against revision. The
--    call-out fee snapshot was also handed to someone who never made the
--    trip. The same happened when the team simply reassigned the job.
--    The one place that sees every change of artisan is the pairing trigger
--    from 0023, so the visit is cleared there: decline, expiry and
--    reassignment all pass through it. The client's photos stay - they are
--    the client's.
--
-- Idempotent: safe to run again.
-- ═══════════════════════════════════════════════════════════════════

alter table public.conversations alter column artisan_id drop not null;

-- Same body as 0023, plus the visit reset.
create or replace function public.tg_service_job_pairing()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_private public.job_private;
begin
  if new.assigned_artisan_id is distinct from old.assigned_artisan_id then
    new.offer_expires_at := null;
    new.offer_accepted_at := null;
    -- The previous artisan's visit is not the next artisan's visit.
    new.visit_scheduled_for := null;
    new.visited_at := null;
    new.visit_fee := null;
    new.quote_is_firm := null;
    select * into v_private from public.job_private where job_id = new.id;
    if found then
      new.address_text := case when new.assigned_artisan_id is null then v_private.area_label else v_private.full_address end;
    end if;
  end if;
  return new;
end;
$$;
