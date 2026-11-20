-- Jardín compartido · esquema para Supabase.
-- Ejecuta este archivo en el SQL Editor de tu proyecto.
--
-- Modelo de acceso: no hay cuentas. Cada jardín tiene un código privado
-- (guárdalo como una contraseña; usa algo largo, p. ej. 4 palabras).
-- Las tablas tienen RLS activado y SIN políticas, así que la anon key no puede
-- leerlas ni escribirlas directamente. Solo las funciones de abajo, que
-- comprueban el código, pueden hacerlo.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gardens (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.memories (
  id text primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  date date not null,
  title text not null check (char_length(title) between 1 and 120),
  notes text not null default '' check (char_length(notes) <= 2000),
  author text check (author in ('el', 'ella')),
  is_milestone boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.letters (
  id text primary key,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  date date not null,
  title text not null check (char_length(title) between 1 and 120),
  from_author text check (from_author in ('el', 'ella')),
  to_author text check (to_author in ('el', 'ella')),
  intro text not null default '',
  body jsonb not null default '[]'::jsonb,
  signature text not null default '',
  flower jsonb not null default '{}'::jsonb,
  seal_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists memories_garden_date on public.memories (garden_id, date);
create index if not exists letters_garden_date on public.letters (garden_id, date);

alter table public.gardens enable row level security;
alter table public.memories enable row level security;
alter table public.letters enable row level security;
revoke all on public.gardens, public.memories, public.letters from anon, authenticated;

-- Resuelve el código → id del jardín (o error).
create or replace function public._garden_id(p_code text)
returns uuid language plpgsql stable security definer set search_path = public, extensions as $$
declare gid uuid;
begin
  select id into gid from public.gardens
  where code_hash = encode(extensions.digest(p_code, 'sha256'), 'hex');
  if gid is null then
    perform pg_sleep(0.4); -- frena intentos de adivinar
    raise exception 'invalid_code';
  end if;
  return gid;
end $$;

create or replace function public.garden_check(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
begin perform public._garden_id(p_code); return true; end $$;

create or replace function public.list_memories(p_code text)
returns setof public.memories language sql security definer set search_path = public as $$
  select * from public.memories where garden_id = public._garden_id(p_code) order by date, created_at;
$$;

create or replace function public.save_memory(p_code text, p_memory jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid := public._garden_id(p_code);
begin
  insert into public.memories (id, garden_id, date, title, notes, author, is_milestone, created_at)
  values (
    p_memory->>'id', gid, (p_memory->>'date')::date, p_memory->>'title',
    coalesce(p_memory->>'notes', ''), nullif(p_memory->>'author', ''),
    coalesce((p_memory->>'is_milestone')::boolean, false),
    coalesce((p_memory->>'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    date = excluded.date, title = excluded.title, notes = excluded.notes,
    author = excluded.author, is_milestone = excluded.is_milestone, updated_at = now()
  where public.memories.garden_id = gid;
end $$;

create or replace function public.delete_memory(p_code text, p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.memories where id = p_id and garden_id = public._garden_id(p_code);
$$;

create or replace function public.list_letters(p_code text)
returns setof public.letters language sql security definer set search_path = public as $$
  select * from public.letters where garden_id = public._garden_id(p_code) order by date, created_at;
$$;

create or replace function public.save_letter(p_code text, p_letter jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid := public._garden_id(p_code);
begin
  insert into public.letters (id, garden_id, date, title, from_author, to_author, intro, body, signature, flower, seal_color, created_at)
  values (
    p_letter->>'id', gid, (p_letter->>'date')::date, p_letter->>'title',
    nullif(p_letter->>'from_author', ''), nullif(p_letter->>'to_author', ''),
    coalesce(p_letter->>'intro', ''), coalesce(p_letter->'body', '[]'::jsonb),
    coalesce(p_letter->>'signature', ''), coalesce(p_letter->'flower', '{}'::jsonb),
    p_letter->>'seal_color', coalesce((p_letter->>'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    date = excluded.date, title = excluded.title, from_author = excluded.from_author,
    to_author = excluded.to_author, intro = excluded.intro, body = excluded.body,
    signature = excluded.signature, flower = excluded.flower, seal_color = excluded.seal_color,
    updated_at = now()
  where public.letters.garden_id = gid;
end $$;

create or replace function public.delete_letter(p_code text, p_id text)
returns void language sql security definer set search_path = public as $$
  delete from public.letters where id = p_id and garden_id = public._garden_id(p_code);
$$;

create or replace function public.get_settings(p_code text)
returns jsonb language sql security definer set search_path = public as $$
  select settings from public.gardens where id = public._garden_id(p_code);
$$;

create or replace function public.save_settings(p_code text, p_settings jsonb)
returns void language sql security definer set search_path = public as $$
  update public.gardens set settings = p_settings where id = public._garden_id(p_code);
$$;

revoke execute on function public._garden_id(text) from public, anon, authenticated;
grant execute on function
  public.garden_check(text), public.list_memories(text), public.save_memory(text, jsonb),
  public.delete_memory(text, text), public.list_letters(text), public.save_letter(text, jsonb),
  public.delete_letter(text, text), public.get_settings(text), public.save_settings(text, jsonb)
to anon;

-- Crea vuestro jardín (cambia el código por uno largo y privado):
-- insert into public.gardens (code_hash)
-- values (encode(extensions.digest('margaritas-moradas-para-siempre', 'sha256'), 'hex'));
