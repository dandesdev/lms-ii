-- Per-class editor theme (heading style definitions, etc.)
alter table public.classes
  add column if not exists editor_theme jsonb;

comment on column public.classes.editor_theme is
  'Optional editor chrome theme, e.g. { "headings": { "h2": { "align": "center", "fontFamily": "..." } } }';
