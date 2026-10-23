-- Transactional integration test for the private GM notebook. Run only on a disposable Supabase database.
begin;
create temporary table gm_note_test_context(table_id uuid,sheet_id uuid,gm_id uuid,player_id uuid,outsider_id uuid);
grant select on gm_note_test_context to authenticated;
do $$
declare
 gm_id uuid:=gen_random_uuid(); player_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid();
 tid uuid; pid uuid; sid uuid; note public.dnd_sheet_gm_notes;
begin
 insert into auth.users(id,email) values(gm_id,gm_id||'@example.test'),(player_id,player_id||'@example.test'),(outsider_id,outsider_id||'@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'email',gm_id||'@example.test','role','authenticated')::text,true);
 insert into public.dnd_tables(owner_id,name) values(gm_id,'Mesa caderno teste') returning id into tid;
 insert into public.dnd_players(table_id,name,email,user_id) values(tid,'Jogador',player_id||'@example.test',player_id) returning id into pid;
 insert into public.dnd_sheets(table_id,player_id,name,data) values(tid,pid,'Herói','{"level":1}') returning id into sid;
 note:=public.save_sheet_gm_notes(sid,'Background privado','Sessão 1',0);
 if note.revision<>1 or note.background<>'Background privado' then raise exception 'TEST: criação do caderno falhou'; end if;
 begin perform public.save_sheet_gm_notes(sid,'Perdido','Perdido',0); raise exception 'TEST: conflito de criação não detectado'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 note:=public.save_sheet_gm_notes(sid,'Background privado','Sessão 2',1);
 if note.revision<>2 or note.notes<>'Sessão 2' then raise exception 'TEST: atualização do caderno falhou'; end if;
 begin perform public.save_sheet_gm_notes(sid,'Perdido','Perdido',1); raise exception 'TEST: revisão obsoleta não detectada'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 insert into gm_note_test_context values(tid,sid,gm_id,player_id,outsider_id);
end$$;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',gm_id,'role','authenticated')::text,true) from gm_note_test_context;
do $$ begin if (select count(*) from public.dnd_sheet_gm_notes)<>1 then raise exception 'TEST: mestre não leu o caderno'; end if; end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',player_id,'role','authenticated')::text,true) from gm_note_test_context;
do $$ declare sid uuid; begin
 if (select count(*) from public.dnd_sheet_gm_notes)<>0 then raise exception 'TEST: jogador leu o caderno'; end if;
 select sheet_id into sid from gm_note_test_context;
 begin perform public.save_sheet_gm_notes(sid,'Ataque','Ataque',2); raise exception 'TEST: jogador alterou o caderno'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider_id,'role','authenticated')::text,true) from gm_note_test_context;
do $$ declare sid uuid; begin
 if (select count(*) from public.dnd_sheet_gm_notes)<>0 then raise exception 'TEST: intruso leu o caderno'; end if;
 select sheet_id into sid from gm_note_test_context;
 begin perform public.save_sheet_gm_notes(sid,'Ataque','Ataque',2); raise exception 'TEST: intruso alterou o caderno'; exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
end$$;
reset role;
rollback;
