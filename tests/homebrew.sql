-- Run only in an authorized validation database; every fixture rolls back.
begin;
do $$
declare
 gm uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); player_uid uuid:=gen_random_uuid();
 t1 uuid; t2 uuid; pid uuid; pid2 uuid; s1 uuid; s2 uuid; c1 public.dnd_classes; c2 public.dnd_classes;
 sub public.dnd_subclasses; req public.dnd_level_ups; v bigint; before_count integer; bad jsonb;
 bounds jsonb; extra public.dnd_classes; die smallint; threshold smallint;
begin
 insert into auth.users(id,email) values(gm,gm||'@example.test'),(outsider,outsider||'@example.test'),(player_uid,player_uid||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm,'email',gm||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name) values(gm,'Homebrew fixture 1') returning id into t1;
 insert into public.dnd_tables(owner_id,name) values(gm,'Homebrew fixture 2') returning id into t2;
 insert into public.dnd_players(table_id,name,email,user_id) values(t1,'Test player',player_uid||'@example.test',player_uid) returning id into pid;
 insert into public.dnd_players(table_id,name,email,user_id) values(t2,'Test player',player_uid||'@example.test',player_uid) returning id into pid2;
 set local role authenticated;
 -- homebrew creation: success, duplicates and atomic validation failure.
 c1:=public.dnd_create_homebrew_class(t1,' Pirata ',' No mar ',10::smallint,3::smallint,'[{"name":"Corsário"},{"name":"Bucaneiro"}]');
 if c1.table_id<>t1 or c1.name<>'Pirata' or c1.description<>'No mar' then raise exception 'TEST: wrong class result'; end if;
 if (select count(*) from public.dnd_subclasses where class_id=c1.id)<>2 then raise exception 'TEST: missing subclasses'; end if;
 if (select count(*) from public.dnd_class_levels where class_id=c1.id)<>20 then raise exception 'TEST: missing class progression'; end if;
 if not exists(select 1 from public.dnd_class_levels where class_id=c1.id and level=20 and proficiency_bonus=6) then raise exception 'TEST: wrong proficiency'; end if;
 begin
  perform public.dnd_create_homebrew_class(t1,'pirata','',8::smallint,3::smallint,'[{"name":"A"}]');
  raise exception 'TEST: accepted duplicate class';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.dnd_create_homebrew_class(t1,'Mago','',8::smallint,3::smallint,'[{"name":"A"}]');
  raise exception 'TEST: shadowed official class';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 select count(*) into before_count from public.dnd_classes;
 for bad in select value from jsonb_array_elements('[[],null,{},[{"name":"A"},{"name":" a "}],[{"name":"A"},{"name":" "}],[{"name":22}],[{"name":"A","description":22}]]') loop
  begin
   perform public.dnd_create_homebrew_class(t1,'Invalid fixture','',8::smallint,3::smallint,bad);
   raise exception 'TEST: invalid subclasses accepted';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 end loop;
 if (select count(*) from public.dnd_classes)<>before_count then raise exception 'TEST: partial class saved'; end if;
 begin
  perform public.dnd_create_homebrew_class(t1,'Invalid die','',4::smallint,3::smallint,'[{"name":"A"}]');
  raise exception 'TEST: invalid die accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.dnd_create_homebrew_class(t1,'Invalid level','',8::smallint,21::smallint,'[{"name":"A"}]');
  raise exception 'TEST: invalid level accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 -- Each invalid case crosses the RPC boundary; failure must roll back every row.
 for bad in select value from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('name',' '),jsonb_build_object('name',null),jsonb_build_object('name',repeat('x',101)),
  jsonb_build_object('description',repeat('x',5001)),jsonb_build_object('hit_die',null),
  jsonb_build_object('hit_die',7),jsonb_build_object('subclass_level',null),jsonb_build_object('subclass_level',0),
  jsonb_build_object('subclasses',jsonb_build_array(jsonb_build_object('name',repeat('x',101)))),
  jsonb_build_object('subclasses',jsonb_build_array(jsonb_build_object('name','A','description',repeat('x',5001)))),
  jsonb_build_object('subclasses',(select jsonb_agg(jsonb_build_object('name','S'||n)) from generate_series(1,101) n))
 )) loop
  bounds:='{"name":"Invalid bounds","description":"","hit_die":8,"subclass_level":3,"subclasses":[{"name":"A"}]}'::jsonb||bad;
  begin
   perform public.dnd_create_homebrew_class(t1,bounds->>'name',bounds->>'description',(bounds->>'hit_die')::smallint,(bounds->>'subclass_level')::smallint,bounds->'subclasses');
   raise exception 'TEST: invalid RPC boundary accepted';
  exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 end loop;
 if (select count(*) from public.dnd_classes)<>before_count then raise exception 'TEST: invalid boundary left partial data'; end if;
 foreach die in array array[6,8,10,12]::smallint[] loop
  foreach threshold in array array[1,20]::smallint[] loop
   extra:=public.dnd_create_homebrew_class(t1,rpad('Boundary '||die||' '||threshold,100,'x'),repeat('d',5000),die,threshold,
    jsonb_build_array(jsonb_build_object('name',repeat('s',100),'description',repeat('d',5000))));
   if extra.hit_die<>die or extra.subclass_level<>threshold or length(extra.name)<>100 or length(extra.description)<>5000 then raise exception 'TEST: valid boundary not preserved'; end if;
  end loop;
 end loop;
 c2:=public.dnd_create_homebrew_class(t2,'Pirata','Outra mesa',8::smallint,3::smallint,'[{"name":"Tempestade"}]');
 sub:=public.dnd_add_homebrew_subclass(c1.id,' Capitão ','Comanda o navio');
 if sub.name<>'Capitão' or sub.description<>'Comanda o navio' then raise exception 'TEST: add subclass failed'; end if;
 begin
  perform public.dnd_add_homebrew_subclass(c1.id,'capitão','');raise exception 'TEST: duplicate subclass';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 reset role;
 -- homebrew visibility: assigned player, active membership and outsider RLS.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_uid,'email',player_uid||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if (select count(*) from public.dnd_classes where id in (c1.id,c2.id))<>2 then raise exception 'TEST: member cannot see catalogs'; end if;
 if not exists(select 1 from public.dnd_subclasses where id=sub.id) then raise exception 'TEST: member cannot read subclass'; end if;
 begin
  perform public.dnd_create_homebrew_class(t1,'Player creation','',8::smallint,3::smallint,'[{"name":"A"}]');raise exception 'TEST: player created class';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.dnd_add_homebrew_subclass(c1.id,'Player creation','');raise exception 'TEST: player created subclass';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 reset role;
 update public.dnd_players set active=false where table_id=t1;
 set local role authenticated;
 if exists(select 1 from public.dnd_classes where id=c1.id) then raise exception 'TEST: removed player sees class'; end if;
 if exists(select 1 from public.dnd_subclasses where class_id=c1.id) then raise exception 'TEST: removed player sees subclass'; end if;
 if exists(select 1 from public.dnd_class_levels where class_id=c1.id) then raise exception 'TEST: removed player sees class levels'; end if;
 if exists(select 1 from public.dnd_subclass_levels where subclass_id=sub.id) then raise exception 'TEST: removed player sees subclass levels'; end if;
 reset role;
 update public.dnd_players set active=true where table_id=t1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'email',outsider||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.dnd_classes where table_id in (t1,t2)) then raise exception 'TEST: outsider sees classes'; end if;
 if exists(select 1 from public.dnd_subclasses where class_id in (c1.id,c2.id)) then raise exception 'TEST: outsider sees subclasses'; end if;
 if not exists(select 1 from public.dnd_classes where table_id is null) then raise exception 'TEST: official catalog hidden'; end if;
 begin
  perform public.dnd_create_homebrew_class(t1,'Intruder creation','',8::smallint,3::smallint,'[{"name":"A"}]');raise exception 'TEST: outsider created class';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 reset role;
 -- homebrew isolation: privileged writes and RPCs cannot cross the table boundary.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm,'email',gm||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_sheets(table_id,player_id,name,data) values(t1,pid,'Local pirate','{"class":"Pirata","level":2,"hp":10,"hp_max":10}') returning id into s1;
 insert into public.dnd_sheets(table_id,player_id,name,data) values(t2,pid2,'Other pirate','{"class":"Pirata","level":2,"hp":10,"hp_max":10}') returning id into s2;
 begin
  insert into public.dnd_character_classes(sheet_id,class_id,class_level) values(s2,c1.id,2);
  raise exception 'TEST: foreign link accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 set local role authenticated;
 select version into v from public.dnd_sheets where id=s2;
 begin
  perform public.dnd_request_level_up(s2,c1.id,5::smallint,v,gen_random_uuid(),sub.id);
  raise exception 'TEST: foreign level-up accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform public.dnd_create_homebrew_class(t1,'Navegante','',8::smallint,3::smallint,'[{"name":"Explorador"}]');
 begin
  update public.dnd_sheets set data=data||'{"class":"Navegante"}' where id=s2;
  raise exception 'TEST: foreign class name accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 select version into v from public.dnd_sheets where id=s1;
 req:=public.dnd_request_level_up(s1,c1.id,6::smallint,v,gen_random_uuid(),sub.id);
 if req.status<>'applied' then raise exception 'TEST: master level-up failed'; end if;
 if not exists(select 1 from public.dnd_character_classes where sheet_id=s1 and class_id=c1.id and subclass_id=sub.id and class_level=3) then raise exception 'TEST: local progression missing'; end if;
 if not exists(select 1 from public.dnd_sheets where id=s1 and data->>'level'='3' and data->>'subclass'='Capitão') then raise exception 'TEST: local sheet not updated'; end if;
 reset role;
 -- Same player belongs to both tables: class UUID, not membership, decides scope.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_uid,'email',player_uid||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 select version into v from public.dnd_sheets where id=s2;
 begin
  perform public.dnd_request_level_up(s2,c1.id,5::smallint,v,gen_random_uuid(),sub.id);
  raise exception 'TEST: dual-table player used foreign class';
 exception when raise_exception then
  if sqlerrm<>'Classe indisponível nesta mesa.' then raise; end if;
 end;
 select * into sub from public.dnd_subclasses where class_id=c2.id limit 1;
 req:=public.dnd_request_level_up(s2,c2.id,5::smallint,v,gen_random_uuid(),sub.id);
 if req.status<>'pending' then raise exception 'TEST: player request not pending'; end if;
 if not exists(select 1 from public.dnd_sheets where id=s2 and data->>'level'='2') then raise exception 'TEST: player gained level before approval'; end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm,'email',gm||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 perform public.dnd_decide_level_up(req.id,true);
 if not exists(select 1 from public.dnd_character_classes where sheet_id=s2 and class_id=c2.id and subclass_id=sub.id and class_level=3) then raise exception 'TEST: homebrew approval not applied'; end if;
 reset role;
end $$;
select 'homebrew creation, visibility, isolation: passed' as result;
rollback;
