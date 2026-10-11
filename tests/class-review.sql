-- Transactional integration test: all fixtures are rolled back.
begin;
do $$
declare
 gm_id uuid := gen_random_uuid(); player_user uuid := gen_random_uuid();
 tid uuid; pid uuid; sid uuid; hidden_id uuid; cid uuid; other_cid uuid; subid uuid;
 v bigint; req public.dnd_level_ups; n integer;
begin
 insert into auth.users(id,email) values(gm_id,gm_id||'@example.test'),(player_user,player_user||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'email',gm_id||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name,max_players) values(gm_id,'Teste temporário de classes',6) returning id into tid;
 insert into public.dnd_players(table_id,name,email,active) values(tid,'Jogador teste',player_user||'@example.test',true) returning id into pid;
 insert into public.dnd_sheets(table_id,player_id,name,kind,secret,data) values(tid,pid,'Classe legada','personagem',false,'{"class":"Classe desconhecida","level":2,"hp":10,"hp_max":10}') returning id into sid;
 insert into public.dnd_sheets(table_id,name,kind,secret,data) values(tid,'Segredo','personagem',true,'{"class":"Mago","level":2}') returning id into hidden_id;
 select id into cid from public.dnd_classes where slug='wizard';
 select id into other_cid from public.dnd_classes where slug='fighter';
 select id into subid from public.dnd_subclasses where class_id=cid and slug='evoker';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'email',player_user||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 begin
  update public.dnd_sheets set data=data||'{"class":"Mago"}' where id=sid;
  raise exception 'TEST: jogador corrigiu classe desconhecida';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  update public.dnd_sheets set data=data||'{"class_review":{"decision":"keep","name":"Classe desconhecida"}}' where id=sid;
  raise exception 'TEST: jogador aprovou a própria classe';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 select version into v from public.dnd_sheets where id=sid;
 begin
  perform public.dnd_request_level_up(sid,cid,5::smallint,v,gen_random_uuid(),subid);
  raise exception 'TEST: classe desconhecida fez level-up';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'role','authenticated')::text,true);
 set local role authenticated;
 update public.dnd_sheets set data=data||'{"class_review":{"decision":"keep","name":"Classe desconhecida"}}' where id=sid;
 if not exists(select 1 from public.dnd_sheets where id=sid and data->'class_review'->>'reviewed_by'=gm_id::text) then raise exception 'TEST: auditoria ausente'; end if;
 update public.dnd_sheets set data=data||'{"class":"Mago","class_review":{"decision":"map","name":"Mago"}}' where id=sid;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'email',player_user||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 select version into v from public.dnd_sheets where id=sid;
 begin
  perform public.dnd_request_level_up(sid,other_cid,5::smallint,v,gen_random_uuid(),null::uuid);
  raise exception 'TEST: classe incompatível aceita';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  update public.dnd_sheets set data=data||'{"subclass":"Evocador"}' where id=sid;
  raise exception 'TEST: edição direta de subclasse aceita';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 req:=public.dnd_request_level_up(sid,cid,5::smallint,v,gen_random_uuid(),subid);
 if req.status<>'pending' then raise exception 'TEST: pedido deveria aguardar aprovação'; end if;
 if not exists(select 1 from public.dnd_sheets where id=sid and data->>'level'='2') then raise exception 'TEST: nível aplicado antes da aprovação'; end if;
 if not exists(select 1 from public.dnd_level_ups where id=req.id) then raise exception 'TEST: jogador não lê pedido'; end if;
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'role','authenticated')::text,true);
 set local role authenticated;
 perform public.dnd_decide_level_up(req.id,true);
 reset role;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_user,'email',player_user||'@example.test','role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.dnd_character_classes where sheet_id=sid and class_level=3 and subclass_id=subid) then raise exception 'TEST: jogador não lê vínculos'; end if;
 if exists(select 1 from public.dnd_sheets where id=hidden_id) then raise exception 'TEST: ficha secreta exposta'; end if;
 begin
  update public.dnd_sheets set data=data||'{"class":"Guerreiro"}' where id=sid;
  raise exception 'TEST: troca de classe com histórico aceita';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 update public.dnd_sheets set data=data||'{"history":"Edição comum continua funcionando"}' where id=sid;
 reset role;
end;
$$;
select 'class review, player permissions, pending and approved level-up: passed' as result;
rollback;
