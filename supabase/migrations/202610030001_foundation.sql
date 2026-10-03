-- Apply only after inspecting the target development project.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'user' check (role in ('user','super_admin')),
 created_at timestamptz not null default now()
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id),
 name text not null, kind text not null check (kind in ('personal','work')), created_at timestamptz not null default now()
);
create table public.workspace_members (
 workspace_id uuid references public.workspaces(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','member')),
 primary key(workspace_id,user_id)
);
create table public.tasks (
 id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
 workspace_id uuid references public.workspaces(id), assigned_by uuid references auth.users(id),
 assigned_to uuid references auth.users(id), source text not null default 'capture',
 title text not null check(length(trim(title))>0), context text not null check(context in ('Personal','Work')),
 state text not null check(state in ('TODO','SCHEDULED','ACTIVE','PAUSED','WAITING','RESCHEDULED','DONE')),
 rank double precision not null, due date, archived boolean not null default false,
 payload jsonb not null check(jsonb_typeof(payload)='object' and jsonb_typeof(payload->'actions')='array' and payload->>'recurrence' in ('none','calendar','completion')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index tasks_owner_rank on public.tasks(owner_id,rank) where not archived;
create index tasks_owner_due on public.tasks(owner_id,due) where state <> 'DONE' and not archived;
create table public.notification_jobs (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid references public.tasks(id) on delete cascade, kind text not null check(kind in ('upcoming','start','checkpoint','follow-up','assignment','conflict')),
 deliver_after timestamptz not null, delivered_at timestamptz, decision jsonb not null default '{}',
 dedupe_key text not null, unique(owner_id,dedupe_key)
);
create index notification_jobs_pending on public.notification_jobs(deliver_after) where delivered_at is null;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tasks enable row level security;
alter table public.notification_jobs enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid());
-- Role changes stay server-only. Users may update only display_name.
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy workspace_owner on public.workspaces for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy membership_read on public.workspace_members for select to authenticated using(user_id=auth.uid());
create policy membership_owner on public.workspace_members for all to authenticated using(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())) with check(exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
create policy task_owner on public.tasks for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid() and (workspace_id is null or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=auth.uid())));
create policy notification_owner_read on public.notification_jobs for select to authenticated using(owner_id=auth.uid());
create function public.touch_updated_at() returns trigger language plpgsql set search_path=public as $$begin new.updated_at=now(); return new; end;$$;
create trigger tasks_updated before update on public.tasks for each row execute function public.touch_updated_at();
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id) values(new.id); return new; end;$$;
create trigger auth_profile after insert on auth.users for each row execute function public.create_profile();
-- Lock down privileges granted by provider defaults.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select,insert,update,delete on public.tasks,public.workspaces,public.workspace_members to authenticated;
grant select on public.notification_jobs to authenticated;
