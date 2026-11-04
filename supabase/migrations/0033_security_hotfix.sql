-- 0033: emergency security fixes for 0030 (job tracking) and 0032 (payments and escrow).
--
-- Review found that, with 0030 and 0032 applied:
--   1. anyone, even signed out, could call release_escrow() and release a job's held
--      payment to the artisan, before the job was done;
--   2. the escrow_ledger view showed every payment (payer, client, artisan, amounts)
--      to anyone, because a view runs with its owner's rights and skips RLS;
--   3. compute_cancellation_refund() showed any job's payment to anyone, and counted
--      payments that were never paid ('initialized');
--   4. clients could read the artisan's exact GPS trail in job_locations, and a newly
--      assigned artisan could read the previous artisan's trail. The privacy policy
--      promises clients never see an artisan's exact location;
--   5. artisans could write their own artisan_private row directly, so they could set
--      their payout recipient and bank name, or mark their own NIN as verified.
--      Every legitimate write already goes through SECURITY DEFINER functions.
--
-- Safe to run more than once, and on a database where some of 0028–0032 were never
-- applied: each part checks that what it changes exists. It changes no app behaviour
-- that is in use; live tracking stays off until it is redesigned.

begin;

-- 1. release_escrow: only the signed-in client of a completed job, or an admin.
do $do$
begin
  if to_regclass('public.payments') is null then return; end if;
  execute $f$
    create or replace function public.release_escrow(p_job_id uuid)
    returns public.payments
    language plpgsql
    volatile
    security definer
    set search_path = public
    as $$
    declare
      v_uid uuid := auth.uid();
      v_payment public.payments%rowtype;
      v_job public.service_jobs%rowtype;
    begin
      if v_uid is null then
        raise exception 'sign in to release a payment';
      end if;

      select * into v_job from public.service_jobs where id = p_job_id for update;
      if v_job.id is null then
        raise exception 'job not found';
      end if;
      if v_job.client_id is distinct from v_uid and not public.is_admin() then
        raise exception 'only the client or admin can release escrow for this job';
      end if;
      if v_job.status is distinct from 'completed' then
        raise exception 'payment is released only once the job is completed';
      end if;

      select * into v_payment
      from public.payments
      where job_id = p_job_id and status = 'held'
      order by created_at desc
      limit 1
      for update;
      if v_payment.id is null then
        raise exception 'no payment currently held in escrow for job %', p_job_id;
      end if;

      update public.payments
      set status = 'released', updated_at = now()
      where id = v_payment.id
      returning * into v_payment;

      insert into public.payment_events (payment_id, paystack_reference, event_type, payload)
      values (
        v_payment.id,
        v_payment.paystack_reference,
        'escrow.released',
        jsonb_build_object('released_by', v_uid, 'job_id', p_job_id, 'released_at', now())
      );

      return v_payment;
    end;
    $$
  $f$;
  revoke execute on function public.release_escrow(uuid) from public, anon;
  grant execute on function public.release_escrow(uuid) to authenticated;
end
$do$;

-- 2. escrow_ledger: run with the caller's rights, so the RLS on payments applies.
do $do$
begin
  if to_regclass('public.escrow_ledger') is null then return; end if;
  alter view public.escrow_ledger set (security_invoker = true);
  revoke all on public.escrow_ledger from public, anon;
end
$do$;

-- 3. compute_cancellation_refund: only the job's client, its artisan, or an admin; only
--    money that was actually taken ('held' or 'pending').
do $do$
begin
  if to_regclass('public.payments') is null
     or to_regprocedure('public.compute_cancellation_refund(uuid)') is null then
    return;
  end if;
  execute $f$
    create or replace function public.compute_cancellation_refund(p_job_id uuid)
    returns table (
      refundable_amount_kobo integer,
      cancellation_fee_kobo integer,
      policy_reason text
    )
    language plpgsql
    stable
    security definer
    set search_path = public
    as $$
    declare
      v_uid uuid := auth.uid();
      v_payment public.payments%rowtype;
      v_job public.service_jobs%rowtype;
      v_cancel_fee integer;
    begin
      select * into v_job from public.service_jobs where id = p_job_id;
      if v_job.id is null then
        raise exception 'job not found';
      end if;
      if v_uid is null
         or (v_job.client_id is distinct from v_uid
             and not exists (select 1 from public.artisans a
                             where a.id = v_job.assigned_artisan_id and a.user_id = v_uid)
             and not public.is_admin()) then
        raise exception 'only the job''s client, its artisan or an admin can see this';
      end if;

      select * into v_payment
      from public.payments
      where job_id = p_job_id and status in ('held', 'pending')
      order by created_at desc
      limit 1;

      if v_payment.id is null then
        return query select 0, 0, 'no active or held payment found for this job'::text;
        return;
      end if;

      select coalesce((nullif(value #>> '{}', '')::integer), 100000)
      into v_cancel_fee
      from public.settings
      where key = 'cancellation_fee_kobo';
      v_cancel_fee := coalesce(v_cancel_fee, 100000);

      if v_job.arrived_at is not null then
        return query select 0, v_payment.amount_kobo,
          'artisan has already arrived at site: no refund applies'::text;
        return;
      end if;

      if v_job.en_route_at is not null then
        return query select
          greatest(0, v_payment.amount_kobo - v_cancel_fee),
          least(v_payment.amount_kobo, v_cancel_fee),
          'artisan was already en route: ₦1,000 call-out fee applies'::text;
        return;
      end if;

      return query select v_payment.amount_kobo, 0,
        'cancelled before artisan departed: 100% full refund'::text;
    end;
    $$
  $f$;
  revoke execute on function public.compute_cancellation_refund(uuid) from public, anon;
  grant execute on function public.compute_cancellation_refund(uuid) to authenticated;
end
$do$;

-- 4. Live tracking off: nobody reads or records exact positions until it is redesigned
--    (rounded or delayed for clients, cleared when the job changes hands). The points
--    already stored are exact coordinates the privacy policy says we don't keep.
do $do$
declare
  r record;
begin
  if to_regclass('public.job_locations') is not null then
    revoke all on public.job_locations from public, anon, authenticated;
    drop policy if exists "job_locations_select" on public.job_locations;
    drop policy if exists "job_locations_insert" on public.job_locations;
    delete from public.job_locations;
  end if;
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'record_job_location'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.fn);
  end loop;
end
$do$;

-- 5. artisan_private: reads stay (RLS: your own row); writes only through the
--    SECURITY DEFINER functions (upsert_artisan_profile, update_my_location, admin tools).
revoke insert, update, delete on public.artisan_private from anon, authenticated;

commit;
