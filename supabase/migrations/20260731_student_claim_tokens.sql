-- Per-student claim links: students sign up via /claim/[token] and bind to a
-- student row regardless of which email they use. Teachers can also link an
-- existing account from the dashboard.

alter table public.students
  add column if not exists claim_token text;

alter table public.students
  add column if not exists claimed_at timestamptz;

update public.students
set claim_token = encode(gen_random_bytes(16), 'hex')
where claim_token is null;

alter table public.students
  alter column claim_token set default encode(gen_random_bytes(16), 'hex');

do $$
begin
  if not exists (select 1 from public.students where claim_token is null) then
    alter table public.students alter column claim_token set not null;
  end if;
end $$;

create unique index if not exists students_claim_token_idx
  on public.students (claim_token);

-- Backfill claimed_at for rows already linked to an auth user.
update public.students
set claimed_at = coalesce(claimed_at, created_at)
where user_id is not null and claimed_at is null;
