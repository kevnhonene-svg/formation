-- Exécutez ce script dans Supabase > SQL Editor.
create extension if not exists pgcrypto;
create type public.app_role as enum ('student', 'trainer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'student',
  created_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 90),
  category text not null default 'Général' check (char_length(category) <= 40),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default now()
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(course_id, student_id)
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, role) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'trainer' then 'trainer'::public.app_role else 'student'::public.app_role end
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Rattrape aussi les comptes créés avant l'installation de ce schéma.
insert into public.profiles(id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case when u.raw_user_meta_data ->> 'role' = 'trainer' then 'trainer'::public.app_role else 'student'::public.app_role end
from auth.users as u
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.enrollments enable row level security;

create policy "Profiles visible to signed-in users" on public.profiles for select to authenticated using (true);
create policy "Users update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- Un utilisateur peut modifier son nom, mais pas se promouvoir formateur par l'API.
revoke update on public.profiles from authenticated;
grant update(full_name) on public.profiles to authenticated;
create policy "Anyone browses courses" on public.courses for select to anon, authenticated using (true);
create policy "Trainers publish courses" on public.courses for insert to authenticated with check (
  trainer_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and role = 'trainer')
);
create policy "Trainers update own courses" on public.courses for update to authenticated using (
  trainer_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and role = 'trainer')
) with check (trainer_id = auth.uid());
create policy "Trainers delete own courses" on public.courses for delete to authenticated using (trainer_id = auth.uid());
create policy "Students and course trainers view enrollments" on public.enrollments for select to authenticated using (
  student_id = auth.uid() or exists(select 1 from public.courses where id = course_id and trainer_id = auth.uid())
);
create policy "Students enroll themselves" on public.enrollments for insert to authenticated with check (
  student_id = auth.uid() and exists(select 1 from public.profiles where id = auth.uid() and role = 'student')
);
create policy "Students cancel their enrollment" on public.enrollments for delete to authenticated using (student_id = auth.uid());

alter publication supabase_realtime add table public.courses;
