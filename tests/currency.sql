-- Isolated fixtures only. The entire scenario is rolled back.
begin;
do $$
declare
 gm_id uuid:=gen_random_uuid();player_id uuid:=gen_random_uuid();intruder_id uuid:=gen_random_uuid();
 tid uuid;other_table uuid;member uuid;hero uuid;blocked uuid;foreign_sheet uuid;fighter uuid;key uuid:=gen_random_uuid();v_version bigint;
begin
 insert into auth.users(id,email) values(gm_id,'gm-currency@example.test'),(player_id,'player-currency@example.test'),(intruder_id,'intruder-currency@example.test');
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Currency fixture') returning id into tid;
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Other currency fixture') returning id into other_table;
 insert into public.dnd_players(table_id,name,email,user_id) values(tid,'Player','player-currency@example.test',player_id) returning id into member;
 insert into public.dnd_sheets(table_id,player_id,name,data) values(tid,member,'Hero','{"class":"Guerreiro","level":1,"hp":10,"hp_max":10,"cp":3,"sp":4,"gp":2}') returning id into hero;
 insert into public.dnd_sheets(table_id,name,data) values(tid,'Blocked','{"class":"Guerreiro","level":1,"hp":10,"hp_max":10}') returning id into blocked;
 insert into public.dnd_sheets(table_id,name,data) values(other_table,'Foreign','{"level":1}') returning id into foreign_sheet;
 update public.dnd_table_settings set gold_xp_enabled=true where table_id=tid;
 select id into fighter from public.dnd_classes where slug='fighter';

 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'email','gm-currency@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.dnd_sheet_wallets where sheet_id=hero and cp=3 and sp=4 and gp=2 and gold_progress=0) then raise exception 'TEST: legacy backfill failed';end if;
 begin update public.dnd_sheets set data=jsonb_set(data,'{gp}','99') where id=hero;raise exception 'TEST: direct coin edit allowed';
 exception when insufficient_privilege then if sqlerrm not like 'As moedas desta mesa%' then raise;end if;end;

 perform public.dnd_distribute_currency(tid,0,0,15,jsonb_build_array(jsonb_build_object('sheet_id',hero,'cp',0,'sp',0,'gp',15)),key,'Baú');
 if not exists(select 1 from public.dnd_sheet_wallets where sheet_id=hero and gp=17 and gold_progress=10) then raise exception 'TEST: wallet or capped progress wrong';end if;
 if (select count(*) from public.dnd_currency_allocations where sheet_id=hero)<>1 then raise exception 'TEST: allocation missing';end if;
 perform public.dnd_distribute_currency(tid,0,0,15,jsonb_build_array(jsonb_build_object('sheet_id',hero,'cp',0,'sp',0,'gp',15)),key,'Retry');
 if (select count(*) from public.dnd_currency_allocations where sheet_id=hero)<>1 or (select gp from public.dnd_sheet_wallets where sheet_id=hero)<>17 then raise exception 'TEST: idempotency failed';end if;
 begin perform public.dnd_distribute_currency(tid,0,0,1,jsonb_build_array(jsonb_build_object('sheet_id',foreign_sheet,'cp',0,'sp',0,'gp',1)),gen_random_uuid(),'Foreign');raise exception 'TEST: foreign sheet allowed';
 exception when invalid_parameter_value then null;end;
 if (select gp from public.dnd_sheet_wallets where sheet_id=foreign_sheet)<>0 then raise exception 'TEST: foreign rollback failed';end if;
 select s.version into v_version from public.dnd_sheets s where s.id=blocked;
 begin perform public.dnd_request_level_up(blocked,fighter,6::smallint,v_version,gen_random_uuid(),null::uuid);raise exception 'TEST: level-up without gold allowed';
 exception when invalid_parameter_value then if sqlerrm not like 'Ainda faltam 10 PO%' then raise;end if;end;
 select s.version into v_version from public.dnd_sheets s where s.id=hero;
 perform public.dnd_request_level_up(hero,fighter,6::smallint,v_version,gen_random_uuid(),null::uuid);
 if not exists(select 1 from public.dnd_sheets where id=hero and data->>'level'='2') or (select gold_progress from public.dnd_sheet_wallets where sheet_id=hero)<>0 then raise exception 'TEST: applied level-up did not reset progress';end if;

 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'email','player-currency@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if (select count(*) from public.dnd_sheet_wallets where sheet_id=hero)<>1 or (select count(*) from public.dnd_currency_allocations where sheet_id=hero)<>1 then raise exception 'TEST: player cannot read own currency';end if;
 begin perform public.dnd_distribute_currency(tid,0,0,1,jsonb_build_array(jsonb_build_object('sheet_id',hero,'cp',0,'sp',0,'gp',1)),gen_random_uuid(),'Player');raise exception 'TEST: player distributed currency';
 exception when insufficient_privilege then null;end;
 begin update public.dnd_sheet_wallets set gp=999 where sheet_id=hero;raise exception 'TEST: player updated wallet';
 exception when insufficient_privilege then null;end;

 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',intruder_id,'email','intruder-currency@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.dnd_sheet_wallets where sheet_id=hero) or exists(select 1 from public.dnd_currency_allocations where sheet_id=hero) then raise exception 'TEST: intruder read currency';end if;
 reset role;
end$$;
select 'currency distribution, authorization, idempotency and gold level gate: passed' as result;
rollback;
