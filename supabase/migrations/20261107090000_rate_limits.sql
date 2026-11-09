-- ============================================================================
-- Reelmark — rate limits for public actions (orders, order tracking, newsletter,
-- reviews, the bouquet finder). Safe to run again.
--
-- The server calls hit_rate_limit() with the service-role key before each action.
-- Keys are hashes (action + caller IP or account), never raw IP addresses.
-- Browsers can neither read the table nor call the function.
-- ============================================================================

create table if not exists public.rate_limits (
  key          text primary key check (char_length(key) <= 120),
  window_start timestamptz not null default now(),
  hits         integer not null default 0
);
alter table public.rate_limits enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) touches this table.
revoke all on table public.rate_limits from anon, authenticated;

-- Counts one hit for `p_key` and returns true while the caller is within `p_limit` hits
-- per `p_window_seconds`. Atomic, so parallel requests can't slip past the limit.
create or replace function public.hit_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_hits integer;
  window_length interval := make_interval(secs => greatest(p_window_seconds, 1));
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when r.window_start < now() - window_length then now() else r.window_start end,
        hits         = case when r.window_start < now() - window_length then 1 else r.hits + 1 end
  returning hits into current_hits;

  -- Occasionally clear out windows that ended long ago so the table stays small.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return current_hits <= p_limit;
end;
$$;

-- Functions are executable by PUBLIC by default; keep this one server-only.
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
