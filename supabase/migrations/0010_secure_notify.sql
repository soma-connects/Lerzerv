-- ═══════════════════════════════════════════════════════════════════
-- 0010_secure_notify.sql
-- notify() is a SECURITY DEFINER helper that writes notification rows.
-- It must NOT be callable directly by clients (that would let anyone
-- push arbitrary notifications to any user). Internal `perform notify()`
-- calls inside other SECURITY DEFINER functions still work, because they
-- run as the function owner — the revoke only blocks direct RPC calls.
-- ═══════════════════════════════════════════════════════════════════

revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;
