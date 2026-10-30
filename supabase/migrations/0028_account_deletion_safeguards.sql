-- ═══════════════════════════════════════════════════════════════════
-- 0028_account_deletion_safeguards.sql
--
-- Account Deletion & Financial Ledger Integrity (Google Play Compliance)
--
-- 1. Ensure public.bookings(user_id) references auth.users(id) with
--    ON DELETE SET NULL. This ensures deleting a user from auth.users
--    never fails due to foreign key constraints, while preserving
--    historical financial records (order numbers, amount due, payment
--    status) for tax and accounting audits.
-- ═══════════════════════════════════════════════════════════════════

do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'bookings_user_id_fkey' and table_name = 'bookings'
  ) then
    alter table public.bookings drop constraint bookings_user_id_fkey;
  end if;

  alter table public.bookings
    add constraint bookings_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null;
exception when others then
  -- Ignore if auth.users or bookings is not present in target environment
  null;
end $$;
