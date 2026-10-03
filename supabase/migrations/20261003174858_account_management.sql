-- Reviewed initial schema for the new to-do project. No existing data is changed.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z0-9_]{3,32}$'),
 display_name text not null check(length(display_name) between 1 and 80),
 job_title text not null default '' check(length(job_title)<=100),
 role text not null default 'user' check(role in ('user','super_admin')),
 theme text not null default 'blue' check(theme in ('blue','mint','violet','amber','rose')),
 onboarded boolean not null default false,
 enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(trim(title))>0),
 context text not null check(context in ('Personal','Work')),
 state text not null check(state in ('TODO','SCHEDULED','ACTIVE','PAUSED','WAITING','RESCHEDULED','DONE')),
 rank double precision not null,
 due date,
 archived boolean not null default false,
 payload jsonb not null check(jsonb_typeof(payload)='object' and jsonb_typeof(payload->'actions')='array' and payload->>'recurrence' in ('none','calendar','completion')),
 created_at timestamptz not null default now()
);
create index tasks_owner_rank on public.tasks(owner_id,rank);
create table public.account_bootstrap (
 id boolean primary key default true check(id), token_hash text not null
);
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.account_bootstrap enable row level security;
revoke all on public.profiles,public.tasks,public.account_bootstrap from public,anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,job_title,theme,onboarded) on public.profiles to authenticated;
grant select,insert,update,delete on public.tasks to authenticated;
grant all on public.profiles,public.tasks,public.account_bootstrap to service_role;
create policy team_read on public.profiles for select to authenticated
 using(enabled and (select auth.jwt()->'app_metadata'->>'managed_account')='true');
create policy account_edit on public.profiles for update to authenticated
 using(id=(select auth.uid()) and enabled and (select auth.jwt()->'app_metadata'->>'managed_account')='true')
 with check(id=(select auth.uid()) and enabled);
create policy private_tasks on public.tasks for all to authenticated
 using(owner_id=(select auth.uid()) and (select auth.jwt()->'app_metadata'->>'managed_account')='true')
 with check(owner_id=(select auth.uid()) and (select auth.jwt()->'app_metadata'->>'managed_account')='true');
-- No public registration, role changes, or bootstrap access are granted to clients.
-- The Edge Function uses server credentials and checks the caller's live admin role.
