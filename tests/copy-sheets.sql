-- Isolated validation only. All fixtures roll back.
begin;
do $$
declare g uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); t uuid; pid uuid;
 s public.dnd_sheets; c public.dnd_sheets; classid uuid; subclassid uuid; uid uuid; n integer; bad text;
begin
 insert into auth.users(id,email) values(g,'copy-gm@example.test'),(p,'copy-player@example.test'),(outsider,'copy-other@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'email','copy-gm@example.test')::text,true);
 insert into public.dnd_tables(owner_id,name) values(g,'Copy fixture') returning id into t;
 insert into public.dnd_players(table_id,name,email,user_id) values(t,'Player','copy-player@example.test',p) returning id into pid;
 insert into public.dnd_sheets(table_id,player_id,name,secret,archived,data)
 values(t,pid,'Original',true,true,'{"level":5,"class":"Mago","hp":23,"spells":"Luz"}') returning * into s;
 select id into classid from public.dnd_classes where name='Mago' limit 1;
 select id into subclassid from public.dnd_subclasses where class_id=classid limit 1;
 if subclassid is null then raise exception 'TEST fixture: no subclass'; end if;
 insert into public.dnd_character_classes(sheet_id,class_id,class_level,is_primary,subclass_id) values(s.id,classid,5,true,subclassid);
 set local role authenticated;
 c:=public.dnd_copy_sheet(s.id,' Cópia ');
 if c.id=s.id or c.table_id<>t or c.player_id<>pid or c.data<>s.data or not c.secret or c.archived or c.name<>'Cópia' or c.version<>1 then raise exception 'TEST copy_preserves: wrong copy'; end if;
 if not exists(select 1 from public.dnd_character_classes where sheet_id=c.id and class_id=classid and class_level=5 and is_primary and subclass_id=subclassid) then raise exception 'TEST copy_preserves: class missing'; end if;
 if (select data from public.dnd_sheets where id=s.id)<>s.data or not (select archived from public.dnd_sheets where id=s.id) then raise exception 'TEST copy_preserves: changed original'; end if;
 if exists(select 1 from public.dnd_level_ups where sheet_id=c.id) then raise exception 'TEST copy_preserves: copied history'; end if;
 for uid in select unnest(array[p,outsider]) loop
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',case when uid=p then 'copy-player@example.test' else 'copy-other@example.test' end)::text,true);
  begin perform public.dnd_copy_sheet(s.id,'Denied');raise exception 'TEST copy_denied: unauthorized copy';exception when insufficient_privilege then null;end;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.dnd_copy_sheet(s.id,'Denied');raise exception 'TEST copy_denied: unauthenticated copy';exception when insufficient_privilege then null;end;
 reset role;
 set local role anon;
 begin perform public.dnd_copy_sheet(s.id,'Denied');raise exception 'TEST copy_denied: anon grant';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g,'email','copy-gm@example.test')::text,true);
 set local role authenticated;
 foreach bad in array array['',' ',repeat('x',151)] loop
  begin perform public.dnd_copy_sheet(s.id,bad);raise exception 'TEST copy_invalid: name accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.dnd_copy_sheet(gen_random_uuid(),'Missing');raise exception 'TEST copy_invalid: missing accepted';exception when no_data_found then null;end;
 begin insert into public.dnd_sheets(table_id,name,data) values(t,'Bad direct','{"level":5}');raise exception 'TEST copy_level_guard: bypass';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 reset role;
end $$;
-- Inject a failing dependent write to prove atomic rollback.
create function public.copy_test_fail() returns trigger language plpgsql as $$ begin raise exception 'injected class failure';end $$;
create trigger copy_test_failure before insert on public.dnd_character_classes for each row execute function public.copy_test_fail();
do $$
declare s uuid; g uuid; n integer;
begin
 select x.id,t.owner_id into s,g from public.dnd_sheets x join public.dnd_tables t on t.id=x.table_id where x.name='Original' and t.name='Copy fixture';
 select count(*) into n from public.dnd_sheets;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',g)::text,true);
 set local role authenticated;
 begin perform public.dnd_copy_sheet(s,'Atomic');raise exception 'TEST copy_atomic: missing failure';exception when raise_exception then if sqlerrm<>'injected class failure' then raise;end if;end;
 reset role;
 if (select count(*) from public.dnd_sheets)<>n then raise exception 'TEST copy_atomic: partial write';end if;
end $$;
rollback;
