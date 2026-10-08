-- Migration 002: contenu des cours et progression étudiant.
-- À exécuter après supabase/schema.sql dans Supabase > SQL Editor.

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  content_type text not null default 'video' check (content_type in ('video', 'document', 'link')),
  content_url text not null check (char_length(content_url) <= 2000),
  position integer not null check (position > 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lesson_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_id),
  check ((completed = false and completed_at is null) or (completed = true and completed_at is not null))
);

create index lessons_course_position_idx on public.lessons(course_id, position);
create index lesson_progress_lesson_idx on public.lesson_progress(lesson_id);

alter table public.lessons enable row level security;
alter table public.lesson_progress enable row level security;

-- Les cours sont accessibles à leur formateur et aux étudiants inscrits.
create policy "Enrolled students and course trainers view lessons"
on public.lessons for select to authenticated using (
  exists (
    select 1 from public.courses c
    where c.id = lessons.course_id and (
      c.trainer_id = (select auth.uid()) or exists (
        select 1 from public.enrollments e
        where e.course_id = c.id and e.student_id = (select auth.uid())
      )
    )
  )
);
create policy "Trainers add lessons to their courses"
on public.lessons for insert to authenticated with check (
  exists (select 1 from public.courses c where c.id = lessons.course_id and c.trainer_id = (select auth.uid()))
  and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'trainer')
);
create policy "Trainers edit lessons in their courses"
on public.lessons for update to authenticated using (
  exists (select 1 from public.courses c where c.id = lessons.course_id and c.trainer_id = (select auth.uid()))
) with check (
  exists (select 1 from public.courses c where c.id = lessons.course_id and c.trainer_id = (select auth.uid()))
);
create policy "Trainers delete lessons in their courses"
on public.lessons for delete to authenticated using (
  exists (select 1 from public.courses c where c.id = lessons.course_id and c.trainer_id = (select auth.uid()))
);

create policy "Students and course trainers view lesson progress"
on public.lesson_progress for select to authenticated using (
  student_id = (select auth.uid()) or exists (
    select 1 from public.lessons l join public.courses c on c.id = l.course_id
    where l.id = lesson_progress.lesson_id and c.trainer_id = (select auth.uid())
  )
);
create policy "Enrolled students record their lesson progress"
on public.lesson_progress for insert to authenticated with check (
  student_id = (select auth.uid()) and exists (
    select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_progress.lesson_id and e.student_id = (select auth.uid())
  )
);
create policy "Enrolled students update their lesson progress"
on public.lesson_progress for update to authenticated using (
  student_id = (select auth.uid()) and exists (
    select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_progress.lesson_id and e.student_id = (select auth.uid())
  )
) with check (
  student_id = (select auth.uid()) and exists (
    select 1 from public.lessons l join public.enrollments e on e.course_id = l.course_id
    where l.id = lesson_progress.lesson_id and e.student_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.lessons to authenticated;
grant select, insert, update on public.lesson_progress to authenticated;
