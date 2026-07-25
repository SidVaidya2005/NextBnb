-- =============================================================================
-- 0002 — Definer functions and triggers
--
-- Every function here pins `search_path = ''` and fully qualifies each relation.
-- An unpinned search_path on a SECURITY DEFINER function is a privilege
-- escalation vector: the caller controls name resolution and can point the body
-- at objects they own. Pinning it to empty forces explicit schema qualification.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin() — the admin gate used by RLS policies in 0003.
--
-- SECURITY DEFINER so that policies on listings/bookings can consult profiles
-- without re-entering the profiles policies (recursive policy evaluation).
-- -----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

comment on function public.is_admin() is
  'True when the current user has profiles.is_admin. Definer to avoid recursive policy evaluation.';

-- -----------------------------------------------------------------------------
-- admin_list_users() — the ONLY path to other users' email addresses.
--
-- profiles has no email column by design, so the admin dashboard reads
-- auth.users through here. Because a definer function bypasses RLS entirely,
-- the is_admin() check INSIDE the body is the real gate — the grant below is
-- only a second lock. Returns id + email and nothing else: names, join dates
-- and counts are already visible to an admin through ordinary RLS reads.
-- -----------------------------------------------------------------------------

create or replace function public.admin_list_users()
returns table (id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin privileges required'
      using errcode = '42501';
  end if;

  return query
    select u.id, u.email::text
    from auth.users u
    order by u.created_at;
end;
$$;

revoke execute on function public.admin_list_users() from public;
revoke execute on function public.admin_list_users() from anon;
grant execute on function public.admin_list_users() to authenticated;

comment on function public.admin_list_users() is
  'Admin-only listing of auth.users emails. Self-guarded with is_admin(); never call with the service-role key in a request path.';

-- -----------------------------------------------------------------------------
-- handle_new_user() — guarantees a profiles row exists after first sign-in.
--
-- Google populates the metadata keys inconsistently depending on the flow
-- (full_name/name, avatar_url/picture), so both spellings are checked.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- set_updated_at() — listings.updated_at is maintained by the database, not by
-- application code, so it cannot be forgotten in an update path.
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_set_updated_at
  before update on public.listings
  for each row
  execute function public.set_updated_at();
