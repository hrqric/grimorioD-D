-- Transactional integration test. All fixtures are rolled back.
begin;
create temporary table media_test_context(table_id uuid,history_id uuid,player_id uuid,outsider_id uuid);
grant select on media_test_context to authenticated;
do $$
declare
 gm_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
 tid uuid; other_tid uuid; pid uuid; sid uuid; portrait uuid:=gen_random_uuid(); map_id uuid:=gen_random_uuid(); scene uuid:=gen_random_uuid(); other_scene uuid:=gen_random_uuid(); gif_scene uuid:=gen_random_uuid();
 r public.dnd_table_presentations; h public.dnd_scene_history; duplicate_h public.dnd_scene_history;
begin
 insert into auth.users(id,email) values(gm_id,gm_id||'@example.test'),(player_id,player_id||'@example.test'),(outsider_id,outsider_id||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'email',gm_id||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Mesa mídia teste') returning id into tid;
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Outra mesa') returning id into other_tid;
 insert into public.dnd_players(table_id,name,email,user_id) values(tid,'Jogador',player_id||'@example.test',player_id) returning id into pid;
 insert into public.dnd_sheets(table_id,player_id,name,data) values(tid,pid,'Herói','{"level":1}') returning id into sid;
 insert into public.dnd_media_assets(id,table_id,sheet_id,kind,bucket_id,object_path,mime_type,byte_size,width,height,created_by) values
 (portrait,tid,sid,'portrait','dnd-portraits',tid||'/'||sid||'/'||portrait||'.png','image/png',100,10,10,gm_id),
 (map_id,tid,null,'map','dnd-table-scenes',tid||'/'||map_id||'.png','image/png',100,10,10,gm_id),
 (scene,tid,null,'cutscene','dnd-table-scenes',tid||'/'||scene||'.png','image/png',100,10,10,gm_id),
 (other_scene,other_tid,null,'cutscene','dnd-table-scenes',other_tid||'/'||other_scene||'.png','image/png',100,10,10,gm_id),
 (gif_scene,tid,null,'cutscene','dnd-table-scenes',tid||'/'||gif_scene||'.gif','image/gif',31457280,10,10,gm_id);
 perform public.set_sheet_portrait(sid,portrait,0);
 r:=public.set_table_map(tid,map_id,0); if r.map_revision<>1 then raise exception 'TEST: revisão do mapa'; end if;
 r:=public.present_cutscene(tid,scene); if not r.cutscene_active then raise exception 'TEST: cutscene inativa'; end if;
 r:=public.dismiss_cutscene(tid); if r.cutscene_active then raise exception 'TEST: cutscene não encerrou'; end if;
 h:=public.save_cutscene_history(tid,scene); if h.title is not null or h.removed_at is not null then raise exception 'TEST: histórico inicial inválido'; end if;
 duplicate_h:=public.save_cutscene_history(tid,scene); if duplicate_h.id<>h.id then raise exception 'TEST: salvamento duplicado criou outra entrada'; end if;
 begin perform public.save_cutscene_history(tid,map_id); raise exception 'TEST: mapa entrou no histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.save_cutscene_history(tid,other_scene); raise exception 'TEST: cena de outra mesa entrou no histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 h:=public.rename_cutscene_history(h.id,'  A chegada  '); if h.title<>'A chegada' then raise exception 'TEST: título não foi normalizado'; end if;
 h:=public.rename_cutscene_history(h.id,'   '); if h.title is not null then raise exception 'TEST: título vazio não virou opcional'; end if;
 insert into media_test_context values(tid,h.id,player_id,outsider_id);

 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'email',player_id||'@example.test','role','authenticated')::text,true);
 if not public.dnd_can_edit_sheet(sid) or not public.dnd_is_table_member(tid) then raise exception 'TEST: jogador perdeu acesso'; end if;
 begin perform public.set_table_map(tid,map_id,1); raise exception 'TEST: jogador alterou mapa'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.present_cutscene(tid,scene); raise exception 'TEST: jogador iniciou cutscene'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.save_cutscene_history(tid,gif_scene); raise exception 'TEST: jogador salvou histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.rename_cutscene_history(h.id,'Invasão'); raise exception 'TEST: jogador renomeou histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.remove_cutscene_history(h.id); raise exception 'TEST: jogador removeu histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'email',outsider_id||'@example.test','role','authenticated')::text,true);
 if public.dnd_is_table_member(tid) then raise exception 'TEST: intruso entrou na mesa'; end if;
 begin perform public.set_sheet_portrait(sid,portrait,1); raise exception 'TEST: intruso alterou retrato'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.save_cutscene_history(tid,gif_scene); raise exception 'TEST: intruso salvou histórico'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end$$;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated')::text,true) from media_test_context;
do $$ declare tid uuid; hid uuid; begin
 select table_id,history_id into tid,hid from media_test_context;
 if (select count(*) from public.dnd_scene_history where table_id=tid)<>1 then raise exception 'TEST: membro não leu o histórico'; end if;
end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from media_test_context;
do $$ begin if (select count(*) from public.dnd_scene_history)<>0 then raise exception 'TEST: intruso leu o histórico'; end if; end$$;
reset role;

do $$ declare gm_id uuid; hid uuid; h public.dnd_scene_history; begin
 select t.owner_id,c.history_id into gm_id,hid from media_test_context c join public.dnd_tables t on t.id=c.table_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'role','authenticated')::text,true);
 h:=public.remove_cutscene_history(hid); if h.removed_at is null then raise exception 'TEST: remoção não foi lógica'; end if;
 if not exists(select 1 from public.dnd_media_assets a where a.id=h.asset_id and a.deleted_at is null) then raise exception 'TEST: remoção apagou a mídia'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated')::text,true) from media_test_context;
do $$ begin if (select count(*) from public.dnd_scene_history)<>0 then raise exception 'TEST: membro leu entrada removida'; end if; end$$;
reset role;
do $$ declare gm_id uuid; tid uuid; hid uuid; asset_id uuid; h public.dnd_scene_history; begin
 select t.owner_id,c.table_id,c.history_id,sh.asset_id into gm_id,tid,hid,asset_id from media_test_context c join public.dnd_tables t on t.id=c.table_id join public.dnd_scene_history sh on sh.id=c.history_id;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'role','authenticated')::text,true);
 h:=public.save_cutscene_history(tid,asset_id); if h.id<>hid or h.removed_at is not null then raise exception 'TEST: novo salvamento não restaurou a entrada'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated')::text,true) from media_test_context;
do $$ begin if (select count(*) from public.dnd_scene_history)<>1 then raise exception 'TEST: membro não leu a entrada restaurada'; end if; end$$;
rollback;
