-- Google Drive OAuth foundation for one connection per school.
-- OAuth states and encrypted token payloads are server-only.

create table if not exists public.lao_drive_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  school_id uuid not null references public.lao_schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lao_drive_credentials (
  school_id uuid primary key references public.lao_schools(id) on delete cascade,
  token_ciphertext text not null,
  token_iv text not null,
  updated_at timestamptz not null default now()
);

alter table public.lao_drive_oauth_states enable row level security;
alter table public.lao_drive_credentials enable row level security;

revoke all on public.lao_drive_oauth_states from public,anon,authenticated;
revoke all on public.lao_drive_credentials from public,anon,authenticated;

create index if not exists lao_drive_oauth_states_expiry_idx
  on public.lao_drive_oauth_states(expires_at)
  where used_at is null;
