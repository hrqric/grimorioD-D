-- Regression fixtures mirror the reported level 4 fighter and level 1 druid.
-- No real characters are updated. All fixtures are rolled back.
begin;
do $$
declare
 uid uuid:=gen_random_uuid(); tid uuid; fighter_sheet uuid; druid_sheet uuid; max_sheet uuid; bad_sheet uuid;
 fighter uuid; druid uuid; knight uuid; champion uuid; druid_sub uuid; req public.dnd_level_ups; v bigint;
begin
 insert into auth.users(id,email) values(uid,uid||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name,max_players) values(uid,'Legacy level regression',6) returning id into tid;
 select id into fighter from public.dnd_classes where slug='fighter';
 select id into druid from public.dnd_classes where slug='druid';
 select id into knight from public.dnd_subclasses where class_id=fighter and name='Cavaleiro Místico';
 select id into champion from public.dnd_subclasses where class_id=fighter and slug='champion';
 select id into druid_sub from public.dnd_subclasses where class_id=druid order by name limit 1;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Fighter fixture','personagem',false,'{"class":"Guerreiro","level":4,"subclass":"Cavaleiro místico ","hp":20,"hp_max":20}') returning id into fighter_sheet;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Max fixture','personagem',false,'{"class":"Guerreiro","level":20,"subclass":"Cavaleiro Místico"}') returning id into max_sheet;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Unknown subclass fixture','personagem',false,'{"class":"Guerreiro","level":4,"subclass":"Não cadastrada"}') returning id into bad_sheet;
 set local role authenticated;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Druid fixture','personagem',false,'{"class":"Druida","hp":10,"hp_max":10}') returning id into druid_sheet;
 if (select data->>'level' from public.dnd_sheets where id=druid_sheet)<>'1' then raise exception 'TEST: default level is not 1'; end if;
 begin
   insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Invalid initial level','personagem',false,'{"level":2}');
   raise exception 'TEST: allowed initial level 2';
 exception when raise_exception then if sqlerrm<>'Novas fichas começam no nível 1.' then raise; end if; end;
 begin
   update public.dnd_sheets set data=jsonb_set(data,'{level}','5') where id=fighter_sheet;
   raise exception 'TEST: GM edited level directly';
 exception when raise_exception then if sqlerrm<>'O nível só pode ser alterado pelo fluxo de level-up.' then raise; end if; end;
 select version into v from public.dnd_sheets where id=fighter_sheet;
 begin
   perform public.dnd_request_level_up(fighter_sheet,fighter,8::smallint,v,gen_random_uuid(),champion);
   raise exception 'TEST: legacy subclass was replaceable';
 exception when raise_exception then if sqlerrm<>'A subclasse já registrada na ficha deve ser mantida.' then raise; end if; end;
 req:=public.dnd_request_level_up(fighter_sheet,fighter,8::smallint,v,gen_random_uuid(),null::uuid);
 if req.from_total_level<>4 or req.to_total_level<>5 or req.from_class_level<>4 or req.to_class_level<>5 or req.subclass_id<>knight then raise exception 'TEST: fighter progression wrong'; end if;
 if not exists(select 1 from public.dnd_sheets where id=fighter_sheet and data->>'level'='5' and data->>'subclass'='Cavaleiro Místico' and data->>'hp_max'='28') then raise exception 'TEST: fighter sheet wrong'; end if;
 select version into v from public.dnd_sheets where id=druid_sheet;
 req:=public.dnd_request_level_up(druid_sheet,druid,7::smallint,v,gen_random_uuid(),null::uuid);
 if req.from_total_level<>1 or req.to_total_level<>2 or req.from_class_level<>1 or req.to_class_level<>2 or req.subclass_id is not null then raise exception 'TEST: druid progression wrong'; end if;
 select version into v from public.dnd_sheets where id=druid_sheet;
 begin
   perform public.dnd_request_level_up(druid_sheet,druid,7::smallint,v,gen_random_uuid(),null::uuid);
   raise exception 'TEST: level 3 should require subclass';
 exception when raise_exception then if sqlerrm<>'Escolha uma subclasse para continuar.' then raise; end if; end;
 req:=public.dnd_request_level_up(druid_sheet,druid,7::smallint,v,gen_random_uuid(),druid_sub);
 if req.to_class_level<>3 or req.subclass_id<>druid_sub then raise exception 'TEST: level 3 choice failed'; end if;
 select version into v from public.dnd_sheets where id=bad_sheet;
 begin
   perform public.dnd_request_level_up(bad_sheet,fighter,8::smallint,v,gen_random_uuid(),champion);
   raise exception 'TEST: unknown legacy subclass overwritten';
 exception when raise_exception then if sqlerrm not like 'A subclasse preenchida não pôde%' then raise; end if; end;
 select version into v from public.dnd_sheets where id=max_sheet;
 begin
   perform public.dnd_request_level_up(max_sheet,fighter,8::smallint,v,gen_random_uuid(),null::uuid);
   raise exception 'TEST: level 21 allowed';
 exception when raise_exception then if sqlerrm<>'O personagem já está no nível máximo.' then raise; end if; end;
 reset role;
end;
$$;
select 'legacy 4->5 preserves subclass; 1->2; choice at 3; direct level writes blocked; cap 20: passed' as result;
rollback;
