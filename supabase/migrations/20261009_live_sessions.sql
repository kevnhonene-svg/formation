-- Planification des classes en direct. A executer apres schema.sql et 20261008_lessons_progress.sql.
create table public.live_sessions (
 id uuid primary key default gen_random_uuid(),
 course_id uuid not null references public.courses(id) on delete cascade,
 trainer_id uuid not null references public.profiles(id) on delete cascade,
 title text not null check (char_length(title) between 3 and 120),
 starts_at timestamptz not null,
 duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
 status text not null default 'planned' check (status in ('planned','live','ended')),
 created_at timestamptz not null default now()
);
create index live_sessions_course_start_idx on public.live_sessions(course_id,starts_at);
alter table public.live_sessions enable row level security;
create policy "Course trainers and enrolled students view sessions" on public.live_sessions for select to authenticated using (
 trainer_id=(select auth.uid()) or exists(select 1 from public.enrollments e where e.course_id=live_sessions.course_id and e.student_id=(select auth.uid()))
);
create policy "Trainers schedule sessions for their courses" on public.live_sessions for insert to authenticated with check (
 trainer_id=(select auth.uid()) and exists(select 1 from public.courses c join public.profiles p on p.id=c.trainer_id where c.id=live_sessions.course_id and c.trainer_id=(select auth.uid()) and p.role='trainer')
);
create policy "Trainers update sessions for their courses" on public.live_sessions for update to authenticated using (trainer_id=(select auth.uid())) with check (
 trainer_id=(select auth.uid()) and exists(select 1 from public.courses c where c.id=live_sessions.course_id and c.trainer_id=(select auth.uid()))
);
create policy "Trainers delete their sessions" on public.live_sessions for delete to authenticated using (trainer_id=(select auth.uid()));
grant select,insert,update,delete on public.live_sessions to authenticated;
