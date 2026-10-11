-- Transactional integration test. All fixtures are rolled back.
begin;
do $$
declare
 gm_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
 tid uuid; pid uuid; sid uuid; portrait uuid:=gen_random_uuid(); map_id uuid:=gen_random_uuid(); scene uuid:=gen_random_uuid(); r public.dnd_table_presentations;
begin
 insert into auth.users(id,email) values(gm_id,gm_id||'@example.test'),(player_id,player_id||'@example.test'),(outsider_id,outsider_id||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'email',gm_id||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Mesa mídia teste') returning id into tid;
 insert into public.dnd_players(table_id,name,email,user_id) values(tid,'Jogador',player_id||'@example.test',player_id) returning id into pid;
 insert into public.dnd_sheets(table_id,player_id,name,data) values(tid,pid,'Herói','{"level":1}') returning id into sid;
 insert into public.dnd_media_assets(id,table_id,sheet_id,kind,bucket_id,object_path,mime_type,byte_size,width,height,created_by) values
 (portrait,tid,sid,'portrait','dnd-portraits',tid||'/'||sid||'/'||portrait||'.png','image/png',100,10,10,gm_id),
 (map_id,tid,null,'map','dnd-table-scenes',tid||'/'||map_id||'.png','image/png',100,10,10,gm_id),
 (scene,tid,null,'cutscene','dnd-table-scenes',tid||'/'||scene||'.png','image/png',100,10,10,gm_id);
 perform public.set_sheet_portrait(sid,portrait,0);
 r:=public.set_table_map(tid,map_id,0); if r.map_revision<>1 then raise exception 'TEST: revisão do mapa'; end if;
 r:=public.present_cutscene(tid,scene); if not r.cutscene_active then raise exception 'TEST: cutscene inativa'; end if;
 r:=public.dismiss_cutscene(tid); if r.cutscene_active then raise exception 'TEST: cutscene não encerrou'; end if;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'email',player_id||'@example.test','role','authenticated')::text,true);
 if not public.dnd_can_edit_sheet(sid) or not public.dnd_is_table_member(tid) then raise exception 'TEST: jogador perdeu acesso'; end if;
 begin perform public.set_table_map(tid,map_id,1); raise exception 'TEST: jogador alterou mapa'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin perform public.present_cutscene(tid,scene); raise exception 'TEST: jogador iniciou cutscene'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;

 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'email',outsider_id||'@example.test','role','authenticated')::text,true);
 if public.dnd_is_table_member(tid) then raise exception 'TEST: intruso entrou na mesa'; end if;
 begin perform public.set_sheet_portrait(sid,portrait,1); raise exception 'TEST: intruso alterou retrato'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end$$;
rollback;
