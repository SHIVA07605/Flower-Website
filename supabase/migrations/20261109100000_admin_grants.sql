-- ============================================================================
-- Reelmark — admin access granted by the owner. Safe to run again.
--
-- Owners (the ADMIN_EMAILS server setting) can give any email address access to the
-- admin dashboard, either until a chosen date/time or with no end date, and revoke it at
-- any time. Access only applies to accounts whose email is verified (e.g. Google sign-in).
-- Only the server (service role) reads or writes this table.
-- ============================================================================

create table if not exists public.admin_grants (
  email       text primary key check (email = lower(email) and char_length(email) <= 254),
  expires_at  timestamptz,                     -- null = until the owner removes it
  note        text not null default '' check (char_length(note) <= 200),
  granted_by  text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.admin_grants enable row level security;
-- No policies on purpose: browsers can never read or change who is an admin.
revoke all on table public.admin_grants from anon, authenticated;

drop trigger if exists admin_grants_touch_updated_at on public.admin_grants;
create trigger admin_grants_touch_updated_at
  before update on public.admin_grants
  for each row execute function public.touch_updated_at();
