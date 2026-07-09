-- English LMS schema (run in Supabase SQL editor)

create extension if not exists "pgcrypto";

-- Profiles linked to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('teacher', 'student')),
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

-- Teacher-managed student records
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level text,
  email text,
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Class documents
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  title text not null,
  source_filename text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  share_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  markdown_source text,
  liveblocks_room_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists classes_student_id_idx on public.classes (student_id);
create index if not exists classes_share_token_idx on public.classes (share_token);
create index if not exists classes_status_idx on public.classes (status);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists classes_updated_at on public.classes;
create trigger classes_updated_at
  before update on public.classes
  for each row execute function public.set_updated_at();

-- Helper: is current user a teacher?
create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

-- Helper: student linked to current user
create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.students where user_id = auth.uid() limit 1;
$$;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;

-- Profiles policies
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Teachers can read all profiles"
  on public.profiles for select
  using (public.is_teacher());

-- Students policies
create policy "Teachers manage students"
  on public.students for all
  using (public.is_teacher())
  with check (public.is_teacher());

create policy "Students read own record"
  on public.students for select
  using (user_id = auth.uid());

-- Classes policies
create policy "Teachers manage all classes"
  on public.classes for all
  using (public.is_teacher())
  with check (public.is_teacher());

create policy "Students read published classes"
  on public.classes for select
  using (
    status = 'published'
    and student_id = public.current_student_id()
  );

-- Storage bucket for class images (create in dashboard or via API)
-- insert into storage.buckets (id, name, public) values ('class-images', 'class-images', true);
