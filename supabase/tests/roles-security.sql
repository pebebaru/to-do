begin;
create temp table qa_people(id uuid primary key,kind text);
insert into qa_people select gen_random_uuid(),v from unnest(array['super_admin','admin','user','outsider','disabled']) v;
insert into auth.users(id) select id from qa_people;
insert into public.profiles(id,username,display_name,role,enabled)
select id,'qa_'||replace(id::text,'-','')::varchar(20),'QA rollback',case when kind in ('outsider','disabled') then 'user' else kind end,kind<>'disabled' from qa_people;
grant select on qa_people to authenticated;
create function pg_temp.check_test(ok boolean,label text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'FAIL: %',label;end if;end$$;
select pg_temp.check_test(not has_function_privilege('authenticated','public.manage_member(uuid,uuid,text,boolean)','execute'),'client cannot mutate roles via RPC');
select pg_temp.check_test(not has_function_privilege('anon','public.share_work_task(uuid,uuid,uuid[],uuid)','execute'),'anon cannot share via RPC');
select public.manage_member((select id from qa_people where kind='super_admin'),(select id from qa_people where kind='user'),'admin',null);
select pg_temp.check_test((select role='admin' from public.profiles where id=(select id from qa_people where kind='user')),'superadmin assigns admin');
select public.manage_member((select id from qa_people where kind='super_admin'),(select id from qa_people where kind='user'),'user',null);
do $$begin
 begin perform public.manage_member((select id from qa_people where kind='admin'),(select id from qa_people where kind='user'),'super_admin',null); raise exception 'FAIL admin elevated role'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
 begin perform public.manage_member((select id from qa_people where kind='super_admin'),(select id from qa_people where kind='super_admin'),'user',null); raise exception 'FAIL self demotion'; exception when others then if SQLERRM like 'FAIL%' then raise; end if; end;
end$$;
select public.manage_member((select id from qa_people where kind='admin'),(select id from qa_people where kind='user'),null,false);
select pg_temp.check_test((select not enabled from public.profiles where id=(select id from qa_people where kind='user')),'admin disables normal user');
select public.manage_member((select id from qa_people where kind='admin'),(select id from qa_people where kind='user'),null,true);

create temp table qa_task(id uuid);
insert into qa_task values(gen_random_uuid());
grant select on qa_task to authenticated;
insert into public.tasks(id,owner_id,title,context,state,rank,payload)
select t.id,p.id,'QA rollback timer','Work','ACTIVE',0,jsonb_build_object('id',t.id,'title','QA rollback timer','context','Work','state','ACTIVE','recurrence','none','actions','[]'::jsonb,'seconds',5,'runningSince',extract(epoch from clock_timestamp()-interval '60 seconds')*1000)
from qa_task t,qa_people p where p.kind='user';
do $$begin
 begin perform public.share_work_task((select id from qa_people where kind='user'),(select id from qa_task),array[(select id from qa_people where kind='disabled')],null);raise exception 'FAIL disabled recipient accepted';exception when others then if SQLERRM like 'FAIL%' then raise;end if;end;
end$$;
select pg_temp.check_test(not(select archived from public.tasks where id=(select id from qa_task)),'failed share leaves source intact');
select public.share_work_task((select id from qa_people where kind='user'),(select id from qa_task),array[(select id from qa_people where kind='outsider')],null);
select pg_temp.check_test((select (payload->>'seconds')::numeric>=65 and payload->>'runningSince' is null and payload->>'state'='PAUSED' from public.shared_tasks where id=(select id from qa_task)),'share banks running time and pauses');
select pg_temp.check_test((select archived and payload->>'source'='shared' from public.tasks where id=(select id from qa_task)),'share archives source atomically');
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from qa_people where kind='admin'),'app_metadata',jsonb_build_object('managed_account',true))::text,true);
set local role authenticated;
select pg_temp.check_test((select count(*) from public.shared_tasks where id=(select id from qa_task))=0,'nonparticipant admin cannot read shared task directly');
select pg_temp.check_test((select count(*) from public.tasks where id=(select id from qa_task))=0,'other user cannot read private task');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from qa_people where kind='outsider'),'app_metadata',jsonb_build_object('managed_account',true))::text,true);
set local role authenticated;
select pg_temp.check_test((select count(*) from public.shared_tasks where id=(select id from qa_task))=1,'explicit participant can read shared task');
reset role;

select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from qa_people where kind='user'),'app_metadata',jsonb_build_object('managed_account',true))::text,true);
set local role authenticated;
select pg_temp.check_test((select count(*) from public.profiles)>0,'enabled managed member sees directory');
do $$begin
 begin update public.profiles set role='super_admin' where id=auth.uid();raise exception 'FAIL direct role update';exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select id from qa_people where kind='disabled'),'app_metadata',jsonb_build_object('managed_account',true,'role','super_admin'))::text,true);
set local role authenticated;
select pg_temp.check_test((select count(*) from public.profiles)=0,'disabled stale token cannot read directory');
select pg_temp.check_test((select count(*) from public.tasks)=0,'disabled stale token cannot read tasks');
select pg_temp.check_test((select count(*) from public.shared_tasks)=0,'disabled stale token cannot read shared tasks');
reset role;
select 'PASS: role assignment, self protection, direct escalation denial, disabled stale-token isolation; all fixtures rolled back' as result;
rollback;
