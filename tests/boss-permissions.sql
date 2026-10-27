-- Run only in an authorized validation database. Fixtures always roll back.
begin;
create temporary table boss_test_context(gm_id uuid,player_id uuid,outsider_id uuid,tid uuid,sid uuid,other_sid uuid);
grant select on boss_test_context to authenticated;
do $$
declare g uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); t uuid; other_t uuid; s uuid; other_s uuid;
begin
 insert into auth.users(id,email) values(g,g||'@example.test'),(p,p||'@example.test'),(o,o||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'email',g||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name) values(g,'Boss validation') returning id into t;
 insert into public.dnd_tables(owner_id,name) values(g,'Other table') returning id into other_t;
 insert into public.dnd_players(table_id,name,email,user_id) values(t,'Player',p||'@example.test',p);
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(t,'Guardião','monstro',true,'{"level":1,"is_boss":true,"hp":75,"hp_max":100,"attacks":"PRIVATE"}') returning id into s;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(other_t,'Outro','monstro',true,'{"level":1,"is_boss":true,"hp":20,"hp_max":40}') returning id into other_s;
 insert into boss_test_context values(g,p,o,t,s,other_s);
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: boss revealed on creation'; end if;
 perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
 perform public.dnd_set_boss_visibility(other_s,true,(select version from public.dnd_sheets where id=other_s));
 if (select hp from public.dnd_boss_bars where sheet_id=s)<>75 then raise exception 'TEST: reveal lost HP'; end if;
 update public.dnd_sheets set data=jsonb_set(data,'{hp}','0') where id=s;
 if (select hp from public.dnd_boss_bars where sheet_id=s)<>0 then raise exception 'TEST: zero HP did not sync'; end if;
 if not exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: zero HP hid boss'; end if;
 begin perform public.dnd_set_boss_visibility(s,true,-1);raise exception 'TEST: stale reveal accepted';exception when raise_exception then if sqlerrm like 'TEST:%' then raise;end if;if sqlerrm<>'revision_conflict' then raise;end if;end;
 update public.dnd_sheets set data=jsonb_set(data,'{hp_max}','0') where id=s;
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: invalid HP left public bar';end if;
 begin perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));raise exception 'TEST: invalid HP revealed';exception when raise_exception then if sqlerrm like 'TEST:%' then raise;end if;if sqlerrm<>'invalid_boss_hp' then raise;end if;end;
 update public.dnd_sheets set data=jsonb_set(data,'{hp_max}','100') where id=s;
 perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
end$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'email',player_id||'@example.test','role','authenticated')::text,true) from boss_test_context;
do $$ declare s uuid; begin
 select sid into s from boss_test_context;
 if (select count(*) from public.dnd_boss_bars)<>1 then raise exception 'TEST: player read another table or missed own boss';end if;
 if exists(select 1 from public.dnd_sheets where id=s) then raise exception 'TEST: player read secret boss sheet';end if;
 begin perform public.dnd_set_boss_visibility(s,false,1);raise exception 'TEST: player hid boss';exception when raise_exception then if sqlerrm like 'TEST:%' then raise;end if;if sqlerrm<>'not_authorized' then raise;end if;end;
 begin update public.dnd_boss_bars set hp=99 where sheet_id=s;raise exception 'TEST: player wrote projection';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from boss_test_context;
do $$ begin if exists(select 1 from public.dnd_boss_bars) then raise exception 'TEST: outsider read bars';end if;end$$;
reset role;
do $$ declare g uuid; s uuid; begin
 select gm_id,sid into g,s from boss_test_context;perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'role','authenticated')::text,true);
 perform public.dnd_set_boss_visibility(s,false,(select version from public.dnd_sheets where id=s));
 update public.dnd_sheets set data=jsonb_set(data,'{hp}','30') where id=s;
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: hidden boss reappeared on HP change';end if;
 perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
 update public.dnd_sheets set archived=true where id=s;
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: archived boss remained visible';end if;
 update public.dnd_sheets set archived=false where id=s;
 perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
 update public.dnd_sheets set data=jsonb_set(data,'{is_boss}','false') where id=s;
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: unmarked boss remained visible';end if;
 update public.dnd_sheets set data=jsonb_set(data,'{is_boss}','true') where id=s;
 perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
 -- Live sheets currently have immutable table links. Defense if that guard ever changes:
 if not exists(select 1 from pg_trigger where tgrelid='public.dnd_sheets'::regclass and tgname='dnd_sheet_guard') then
  update public.dnd_sheets set table_id=(select table_id from public.dnd_sheets where id=(select other_sid from boss_test_context)) where id=s;
  if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: moved boss stayed visible to old table';end if;
  perform public.dnd_set_boss_visibility(s,true,(select version from public.dnd_sheets where id=s));
 end if;
 delete from public.dnd_sheets where id=s;
 if exists(select 1 from public.dnd_boss_bars where sheet_id=s) then raise exception 'TEST: deleted sheet retained bar';end if;
end$$;
rollback;
