alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('user','admin','super_admin'));
alter table public.profiles drop constraint profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check check(theme in ('blue','slate','rose','plum','amber','graphite','violet','ocean','peach','mint'));

-- Internal live lookup avoids recursive profile RLS. It only reveals the caller's role.
create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.current_app_role() returns text
language sql stable security definer set search_path = '' as $$
 select role from public.profiles where id=(select auth.uid()) and enabled
 and (select auth.jwt()->'app_metadata'->>'managed_account')='true'
$$;
revoke all on function private.current_app_role() from public,anon;
grant execute on function private.current_app_role() to authenticated;
drop policy team_read on public.profiles;
create policy team_read on public.profiles for select to authenticated
 using(enabled and (select private.current_app_role()) is not null);
drop policy account_edit on public.profiles;
create policy account_edit on public.profiles for update to authenticated
 using(id=(select auth.uid()) and (select private.current_app_role()) is not null)
 with check(id=(select auth.uid()) and enabled);

-- Role and enabled changes are serialized; clients have no EXECUTE privilege.
create or replace function public.manage_member(actor_id uuid, target_id uuid, new_role text default null, new_enabled boolean default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare actor public.profiles; target public.profiles;
begin
 perform pg_advisory_xact_lock(711904);
 select * into actor from public.profiles where id=actor_id and enabled;
 select * into target from public.profiles where id=target_id for update;
 if actor.id is null or target.id is null or actor.role not in ('super_admin','admin') then raise exception 'Not authorized'; end if;
 if actor.role='admin' and (target.role<>'user' or new_role is not null) then raise exception 'Superadmin only'; end if;
 if new_role is not null and new_role not in ('user','admin','super_admin') then raise exception 'Invalid role'; end if;
 if actor_id=target_id and (new_role is distinct from target.role and new_role is not null or new_enabled=false) then raise exception 'Cannot remove your own access'; end if;
 if target.role='super_admin' and target.enabled and (new_enabled=false or new_role is not null and new_role<>'super_admin')
 and (select count(*) from public.profiles where role='super_admin' and enabled)<=1 then raise exception 'Keep an enabled superadmin'; end if;
 update public.profiles set role=coalesce(new_role,role),enabled=coalesce(new_enabled,enabled) where id=target_id;
end $$;
revoke all on function public.manage_member(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_member(uuid,uuid,text,boolean) to service_role;
create index if not exists shared_tasks_assignee on public.shared_tasks(assignee);

-- Sharing and moving the original are one transaction, including active timer banking.
create or replace function public.share_work_task(actor_id uuid, task_id uuid, recipients uuid[], assigned uuid default null)
returns public.shared_tasks language plpgsql security invoker set search_path = '' as $$
declare source public.tasks; result public.shared_tasks; saved jsonb; banked numeric;
begin
 select * into source from public.tasks where id=task_id and owner_id=actor_id for update;
 if source.id is null or source.archived or source.context<>'Work' or source.state='DONE' or source.payload->>'recurrence'<>'none' then raise exception 'Choose an open non-repeating Work task'; end if;
 if not exists(select 1 from public.profiles where id=actor_id and enabled) then raise exception 'Account disabled'; end if;
 if cardinality(recipients)>100 or exists(select 1 from unnest(recipients) r where not exists(select 1 from public.profiles p where p.id=r and p.enabled)) then raise exception 'Choose enabled members'; end if;
 banked:=coalesce((source.payload->>'seconds')::numeric,0)+case when source.payload->>'runningSince' is not null then greatest(0,floor((extract(epoch from clock_timestamp())*1000-(source.payload->>'runningSince')::numeric)/1000)) else 0 end;
 saved:=source.payload||jsonb_build_object('seconds',banked,'runningSince',null,'state',case when source.state='ACTIVE' then 'PAUSED' else source.state end);
 insert into public.shared_tasks(id,owner_id,viewers,assignee,assignment_status,payload)
 values(task_id,actor_id,recipients,assigned,case when assigned=actor_id then 'accepted' when assigned is null then 'unassigned' else 'pending' end,saved) returning * into result;
 update public.tasks set archived=true,payload=saved||jsonb_build_object('archived',true,'source','shared') where id=task_id;
 return result;
end $$;
revoke all on function public.share_work_task(uuid,uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.share_work_task(uuid,uuid,uuid[],uuid) to service_role;
