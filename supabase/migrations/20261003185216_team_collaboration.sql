-- Explicit sharing only; existing private tasks are not exposed.
create table public.shared_tasks (
 id uuid primary key,
 owner_id uuid not null references public.profiles(id),
 viewers uuid[] not null default '{}',
 assignee uuid references public.profiles(id),
 assignment_status text not null default 'unassigned' check(assignment_status in ('unassigned','pending','accepted','declined')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'context'='Work'),
 comments jsonb not null default '[]' check(jsonb_typeof(comments)='array'),
 handoff text not null default '' check(length(handoff)<=4000),
 due_request jsonb,
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 check(assignee is null or assignee=owner_id or assignee=any(viewers))
);
create index shared_tasks_viewers on public.shared_tasks using gin(viewers);
create index shared_tasks_owner on public.shared_tasks(owner_id);
create table public.team_groups (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 1 and 60),
 members uuid[] not null default '{}'
);
alter table public.shared_tasks enable row level security;
alter table public.team_groups enable row level security;
revoke all on public.shared_tasks,public.team_groups from public,anon,authenticated;
grant select on public.shared_tasks,public.team_groups to authenticated;
grant all on public.shared_tasks,public.team_groups to service_role;
create policy shared_read on public.shared_tasks for select to authenticated
 using((owner_id=(select auth.uid()) or (select auth.uid())=any(viewers))
 and exists(select 1 from public.profiles where id=(select auth.uid()) and enabled)
 and (select auth.jwt()->'app_metadata'->>'managed_account')='true');
create policy group_read on public.team_groups for select to authenticated
 using(exists(select 1 from public.profiles where id=(select auth.uid()) and enabled)
 and (select auth.jwt()->'app_metadata'->>'managed_account')='true');
-- Disabled accounts lose private task access immediately, including existing JWTs.
drop policy private_tasks on public.tasks;
create policy private_tasks on public.tasks for all to authenticated
 using(owner_id=(select auth.uid()) and (select auth.jwt()->'app_metadata'->>'managed_account')='true'
 and exists(select 1 from public.profiles where id=(select auth.uid()) and enabled))
 with check(owner_id=(select auth.uid()) and (select auth.jwt()->'app_metadata'->>'managed_account')='true'
 and exists(select 1 from public.profiles where id=(select auth.uid()) and enabled));
