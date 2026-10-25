-- Paiement manuel par Mobile Money : le client envoie l'argent sur le numéro de PronoRadar puis saisit
-- la référence de la transaction ; l'administrateur valide (status 'review' → 'accepted') ou refuse.
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists payer_phone text;
-- Une même référence de transaction ne peut servir qu'une fois.
create unique index if not exists payments_reference_uidx on public.payments (upper(reference)) where reference is not null;
create index if not exists payments_status_idx on public.payments (status, created_at desc);

-- La validation manuelle garde le moyen de paiement saisi et complète les détails au lieu de les remplacer.
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
  update public.payments
     set status = 'accepted', paid_at = now(),
         method = coalesce(p_method, method),
         details = coalesce(details, '{}'::jsonb) || coalesce(p_details, '{}'::jsonb)
   where id = p_id;
  insert into public.profiles (id) values (pay.user_id) on conflict (id) do nothing;
  update public.profiles
     set premium_until = greatest(coalesce(premium_until, now()), now()) + make_interval(days => pay.days)
   where id = pay.user_id
  returning premium_until into until;
  return until;
end;
$$;
revoke execute on function public.activate_payment(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.activate_payment(text, text, jsonb) to service_role;

-- Comptes par numéro de téléphone (sans SMS) : le numéro est gardé dans le profil pour l'administration.
alter table public.profiles add column if not exists phone text;
create unique index if not exists profiles_phone_uidx on public.profiles (phone) where phone is not null;
