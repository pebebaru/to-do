-- Evaluate live account access once per statement; preserve all ownership boundaries.
alter policy shared_read on public.shared_tasks using (
 (owner_id=(select auth.uid()) or (select auth.uid())=any(viewers))
 and (select private.current_app_role()) is not null
);
alter policy group_read on public.team_groups using (
 (select private.current_app_role()) is not null
);
alter policy private_tasks on public.tasks using (
 owner_id=(select auth.uid()) and (select private.current_app_role()) is not null
) with check (
 owner_id=(select auth.uid()) and (select private.current_app_role()) is not null
);
