-- PronoRadar version publique : comptes, abonnements Premium, paiements CinetPay,
-- analyses et coupons du jour calculés une fois pour tous les utilisateurs.
-- Toutes les tables ont la sécurité RLS activée sans politique : seul le serveur (clé secrète) y accède.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,                         -- transaction_id envoyé à CinetPay
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  amount integer not null,
  days integer not null,
  status text not null default 'pending',      -- pending | accepted | refused
  method text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  details jsonb
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);

create table if not exists public.daily_runs (
  day date primary key,
  status text not null default 'planning',     -- planning | analyzing | composing | ready | failed
  heartbeat timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  coupons jsonb,
  notes jsonb not null default '[]'::jsonb
);

create table if not exists public.daily_matches (
  id text primary key,
  day date not null references public.daily_runs(day) on delete cascade,
  position integer not null default 0,
  fixture jsonb not null,
  status text not null default 'pending',      -- pending | running | done | error
  attempts integer not null default 0,
  claimed_at timestamptz,
  result jsonb,
  error text,
  updated_at timestamptz not null default now()
);
create index if not exists daily_matches_day_idx on public.daily_matches (day, status);

create table if not exists public.user_bets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  data jsonb not null
);
create index if not exists user_bets_user_idx on public.user_bets (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.payments enable row level security;
alter table public.daily_runs enable row level security;
alter table public.daily_matches enable row level security;
alter table public.user_bets enable row level security;

-- Réserve le prochain match à analyser (ou un match bloqué depuis trop longtemps), sans conflit entre deux serveurs.
create or replace function public.claim_daily_match(p_day date, p_stale_minutes integer default 8, p_max_attempts integer default 2)
returns setof public.daily_matches
language sql
security definer
set search_path = public
as $$
  update public.daily_matches m
     set status = 'running', attempts = m.attempts + 1, claimed_at = now(), updated_at = now()
   where m.id = (
     select d.id from public.daily_matches d
      where d.day = p_day
        and d.attempts < p_max_attempts
        and (d.status = 'pending' or (d.status = 'running' and d.claimed_at < now() - make_interval(mins => p_stale_minutes)))
      order by d.position
      for update skip locked
      limit 1)
  returning m.*;
$$;

-- Active (ou prolonge) l'abonnement d'un paiement accepté. Appelée plusieurs fois, elle ne compte le paiement qu'une fois.
create or replace function public.activate_payment(p_id text, p_method text, p_details jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  pay public.payments;
  until timestamptz;
begin
  select * into pay from public.payments where id = p_id for update;
  if not found then
    return null;
  end if;
  if pay.status = 'accepted' then
    select premium_until into until from public.profiles where id = pay.user_id;
    return until;
  end if;
  update public.payments set status = 'accepted', paid_at = now(), method = p_method, details = p_details where id = p_id;
  insert into public.profiles (id) values (pay.user_id) on conflict (id) do nothing;
  update public.profiles
     set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => pay.days)
   where id = pay.user_id
  returning premium_until into until;
  return until;
end;
$$;

revoke execute on function public.claim_daily_match(date, integer, integer) from public, anon, authenticated;
revoke execute on function public.activate_payment(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_daily_match(date, integer, integer) to service_role;
grant execute on function public.activate_payment(text, text, jsonb) to service_role;
