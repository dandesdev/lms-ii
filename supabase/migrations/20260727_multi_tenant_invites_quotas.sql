-- Multi-teacher LMS: tenant isolation, invite-only teacher onboarding,
-- per-teacher storage quotas and usage metering.
--
-- Safe to run on an existing single-teacher project: existing students are
-- backfilled to the first teacher/superuser profile found.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Plans (drive per-teacher quotas; paid tiers are inert until billing ships)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id text primary key,
  label text not null,
  quota_bytes bigint not null,
  max_students int,
  max_classes int,
  price_cents int not null default 0,
  sort_order int not null default 0
);

insert into public.plans (id, label, quota_bytes, max_students, max_classes, price_cents, sort_order)
values
  ('free',   'Free',    52428800,   15,   150, 0,    0),
  ('pro',    'Pro',   1073741824,  100,  2000, 2900, 1),
  ('studio', 'Studio', 5368709120, 500, 10000, 7900, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profiles: superuser role, invite delegation, plan
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('superuser', 'teacher', 'student'));

alter table public.profiles
  add column if not exists can_invite_teachers boolean not null default false;
alter table public.profiles
  add column if not exists plan text not null default 'free';
alter table public.profiles
  add column if not exists invited_by uuid references public.profiles (id) on delete set null;

alter table public.profiles drop constraint if exists profiles_plan_fkey;
alter table public.profiles
  add constraint profiles_plan_fkey foreign key (plan) references public.plans (id);

-- ---------------------------------------------------------------------------
-- Students belong to exactly one teacher
-- ---------------------------------------------------------------------------
alter table public.students
  add column if not exists owner_id uuid references public.profiles (id) on delete cascade;

update public.students
set owner_id = (
  select id from public.profiles
  where role in ('superuser', 'teacher')
  order by created_at
  limit 1
)
where owner_id is null;

do $$
begin
  if not exists (select 1 from public.students where owner_id is null) then
    alter table public.students alter column owner_id set not null;
  end if;
end $$;

create index if not exists students_owner_id_idx on public.students (owner_id);

-- ---------------------------------------------------------------------------
-- Teacher invites (superuser, or a teacher the superuser trusted)
-- ---------------------------------------------------------------------------
create table if not exists public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default encode(gen_random_bytes(16), 'hex'),
  email text,
  note text,
  created_by uuid not null references public.profiles (id) on delete cascade,
  can_invite_teachers boolean not null default false,
  plan text not null default 'free' references public.plans (id),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists teacher_invites_code_idx on public.teacher_invites (code);
create index if not exists teacher_invites_created_by_idx on public.teacher_invites (created_by);

-- ---------------------------------------------------------------------------
-- Usage history + alert dedupe
-- ---------------------------------------------------------------------------
create table if not exists public.usage_snapshots (
  id bigserial primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  captured_at timestamptz not null default now(),
  markdown_bytes bigint not null default 0,
  image_bytes bigint not null default 0,
  snapshot_bytes bigint not null default 0,
  total_bytes bigint not null default 0,
  student_count int not null default 0,
  class_count int not null default 0,
  image_count int not null default 0
);

create index if not exists usage_snapshots_owner_idx
  on public.usage_snapshots (owner_id, captured_at desc);

create table if not exists public.usage_alerts (
  id bigserial primary key,
  resource text not null,
  scope_id uuid,
  threshold int not null,
  percent numeric not null default 0,
  triggered_at timestamptz not null default now(),
  cleared_at timestamptz,
  notified_at timestamptz
);

create unique index if not exists usage_alerts_active_idx
  on public.usage_alerts (
    resource,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid),
    threshold
  )
  where cleared_at is null;

-- ---------------------------------------------------------------------------
-- Subscriptions (billing provider writes here through its webhook)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  plan text not null references public.plans (id),
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null default 'inactive'
    check (status in ('inactive', 'trialing', 'active', 'past_due', 'canceled')),
  current_period_end timestamptz,
  grace_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_superuser()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'superuser'
  );
$$;

-- Superusers are teachers too — they own students like anybody else.
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher', 'superuser')
  );
$$;

create or replace function public.owns_student(target_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.students
    where id = target_student and owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Usage metering
-- ---------------------------------------------------------------------------

-- Bytes and counts owned by one teacher. Images live at
-- class-images/{classId}/... and snapshots at lms-data/{ownerId}/...
create or replace function public.teacher_usage(owner uuid)
returns table (
  markdown_bytes bigint,
  image_bytes bigint,
  snapshot_bytes bigint,
  total_bytes bigint,
  student_count int,
  class_count int,
  image_count int
)
language sql
stable
security definer
set search_path = public
as $$
  with owned_students as (
    select id from public.students where owner_id = owner
  ),
  owned_classes as (
    select c.id, coalesce(octet_length(c.markdown_source), 0) as bytes
    from public.classes c
    join owned_students s on s.id = c.student_id
  ),
  images as (
    select
      coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes,
      count(*)::int as cnt
    from storage.objects o
    join owned_classes oc on oc.id::text = split_part(o.name, '/', 1)
    where o.bucket_id = 'class-images'
  ),
  snap as (
    select coalesce(sum((o.metadata->>'size')::bigint), 0) as bytes
    from storage.objects o
    where o.bucket_id = 'lms-data'
      and o.name like owner::text || '/%'
  )
  select
    (select coalesce(sum(bytes), 0) from owned_classes)::bigint,
    (select bytes from images)::bigint,
    (select bytes from snap)::bigint,
    (
      (select coalesce(sum(bytes), 0) from owned_classes)
      + (select bytes from images)
      + (select bytes from snap)
    )::bigint,
    (select count(*)::int from owned_students),
    (select count(*)::int from owned_classes),
    (select cnt from images);
$$;

-- Largest classes for a teacher, so the usage card can suggest cleanup.
create or replace function public.teacher_top_classes(owner uuid, limit_count int default 8)
returns table (
  class_id uuid,
  title text,
  student_id uuid,
  student_name text,
  status text,
  markdown_bytes bigint,
  image_bytes bigint,
  total_bytes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with owned as (
    select c.id, c.title, c.student_id, s.name as student_name, c.status,
           coalesce(octet_length(c.markdown_source), 0)::bigint as md
    from public.classes c
    join public.students s on s.id = c.student_id
    where s.owner_id = owner
  ),
  imgs as (
    select oc.id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint as bytes
    from owned oc
    join storage.objects o
      on o.bucket_id = 'class-images'
     and split_part(o.name, '/', 1) = oc.id::text
    group by oc.id
  )
  select
    owned.id,
    owned.title,
    owned.student_id,
    owned.student_name,
    owned.status,
    owned.md,
    coalesce(imgs.bytes, 0),
    owned.md + coalesce(imgs.bytes, 0)
  from owned
  left join imgs on imgs.id = owned.id
  order by (owned.md + coalesce(imgs.bytes, 0)) desc
  limit greatest(limit_count, 1);
$$;

-- Whole-backend totals for the superuser alert page.
create or replace function public.backend_usage()
returns table (
  db_bytes bigint,
  storage_bytes bigint,
  teacher_count int,
  student_count int,
  class_count int,
  room_count int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pg_database_size(current_database())::bigint,
    (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects)::bigint,
    (select count(*)::int from public.profiles where role in ('teacher', 'superuser')),
    (select count(*)::int from public.students),
    (select count(*)::int from public.classes),
    (select count(distinct liveblocks_room_id)::int from public.classes);
$$;

grant execute on function public.teacher_usage(uuid) to authenticated, service_role;
grant execute on function public.teacher_top_classes(uuid, int) to authenticated, service_role;
grant execute on function public.backend_usage() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.teacher_invites enable row level security;
alter table public.usage_snapshots enable row level security;
alter table public.usage_alerts enable row level security;
alter table public.subscriptions enable row level security;

-- Profiles: roles and plans are assigned server-side (service role) only, so
-- the old self-insert / self-update policies are dropped — they allowed a user
-- to grant themselves role='superuser'.
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Teachers can read all profiles" on public.profiles;

drop policy if exists "Superuser reads all profiles" on public.profiles;
create policy "Superuser reads all profiles"
  on public.profiles for select
  using (public.is_superuser());

drop policy if exists "Superuser updates profiles" on public.profiles;
create policy "Superuser updates profiles"
  on public.profiles for update
  using (public.is_superuser())
  with check (public.is_superuser());

-- Students: strict per-owner isolation
drop policy if exists "Teachers manage students" on public.students;
drop policy if exists "Teachers manage own students" on public.students;
create policy "Teachers manage own students"
  on public.students for all
  using (public.is_teacher() and owner_id = auth.uid())
  with check (public.is_teacher() and owner_id = auth.uid());

-- Classes: owned through the student
drop policy if exists "Teachers manage all classes" on public.classes;
drop policy if exists "Teachers manage own classes" on public.classes;
create policy "Teachers manage own classes"
  on public.classes for all
  using (public.is_teacher() and public.owns_student(student_id))
  with check (public.is_teacher() and public.owns_student(student_id));

-- Plans are public reference data
drop policy if exists "Anyone can read plans" on public.plans;
create policy "Anyone can read plans"
  on public.plans for select
  using (true);

-- Invites: creators and the superuser
drop policy if exists "Inviters manage own invites" on public.teacher_invites;
create policy "Inviters manage own invites"
  on public.teacher_invites for all
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Superuser manages all invites" on public.teacher_invites;
create policy "Superuser manages all invites"
  on public.teacher_invites for all
  using (public.is_superuser())
  with check (public.is_superuser());

-- Usage: owners see their own numbers, superuser sees everything
drop policy if exists "Owners read own usage" on public.usage_snapshots;
create policy "Owners read own usage"
  on public.usage_snapshots for select
  using (owner_id = auth.uid() or public.is_superuser());

drop policy if exists "Superuser reads alerts" on public.usage_alerts;
create policy "Superuser reads alerts"
  on public.usage_alerts for select
  using (public.is_superuser());

drop policy if exists "Owners read own subscription" on public.subscriptions;
create policy "Owners read own subscription"
  on public.subscriptions for select
  using (owner_id = auth.uid() or public.is_superuser());

-- ---------------------------------------------------------------------------
-- Storage buckets used by the app
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('class-images', 'class-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lms-data', 'lms-data', false)
on conflict (id) do nothing;
