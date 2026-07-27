-- Add started_at: set when the teacher manually marks a class as started.
alter table public.classes
  add column if not exists started_at timestamptz;
