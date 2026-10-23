-- Private GM notebook for each character sheet. Players never receive these rows.
create table public.dnd_sheet_gm_notes(
 sheet_id uuid primary key references public.dnd_sheets(id) on delete cascade,
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 background text not null default '' check(octet_length(background)<=120000),
 notes text not null default '' check(octet_length(notes)<=120000),
 revision bigint not null default 1 check(revision>0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now()
);
create index dnd_sheet_gm_notes_table_idx on public.dnd_sheet_gm_notes(table_id);
alter table public.dnd_sheet_gm_notes enable row level security;

create policy "gms read private sheet notes" on public.dnd_sheet_gm_notes for select to authenticated
 using(public.dnd_is_gm(table_id));

create or replace function public.save_sheet_gm_notes(p_sheet_id uuid,p_background text,p_notes text,p_expected_revision bigint)
returns public.dnd_sheet_gm_notes language plpgsql security definer set search_path='' as $$
declare s public.dnd_sheets; r public.dnd_sheet_gm_notes;
begin
 select * into s from public.dnd_sheets where id=p_sheet_id;
 if not found or not public.dnd_is_gm(s.table_id) then raise exception using errcode='P0001',message='not_authorized'; end if;
 if octet_length(coalesce(p_background,''))>120000 or octet_length(coalesce(p_notes,''))>120000 then raise exception using errcode='22001',message='note_too_long'; end if;
 if p_expected_revision=0 then
  insert into public.dnd_sheet_gm_notes(sheet_id,table_id,background,notes,revision,updated_by)
  values(s.id,s.table_id,coalesce(p_background,''),coalesce(p_notes,''),1,auth.uid()) on conflict do nothing returning * into r;
 else
  update public.dnd_sheet_gm_notes set background=coalesce(p_background,''),notes=coalesce(p_notes,''),revision=revision+1,updated_by=auth.uid(),updated_at=now()
  where sheet_id=s.id and table_id=s.table_id and revision=p_expected_revision returning * into r;
 end if;
 if not found then raise exception using errcode='P0001',message='revision_conflict'; end if;
 return r;
end$$;

revoke all on table public.dnd_sheet_gm_notes from public,anon;
grant select on table public.dnd_sheet_gm_notes to authenticated;
revoke all on function public.save_sheet_gm_notes(uuid,text,text,bigint) from public,anon;
grant execute on function public.save_sheet_gm_notes(uuid,text,text,bigint) to authenticated;

-- Backfill from the supplied Notion questionnaire. Existing notebook rows win.
insert into public.dnd_sheet_gm_notes(sheet_id,table_id,background,notes,updated_by)
select s.id,s.table_id,v.background,'',t.owner_id
from public.dnd_sheets s join public.dnd_tables t on t.id=s.table_id
join (values
 (array['glx','cillian liel']::text[], $bg$
Fonte: ficha do Notion — Glx / Cillian Liel

Ponto 2 — Background
Nasceu e cresceu em uma fazenda com pais Aasimar. Teve uma infância isolada porque a seita Minguante caçava Aasimar e arrancava seus olhos. Durante um ataque à casa, fugiu; acredita que os pais morreram, mas não presenciou a morte deles. Perdeu a família, arrepende-se de não ter lutado antes e esconde a infância e o rosto de humanos em quem não confia.

Teme a solidão na escuridão. Busca paz e punição, mantém fé na luz sagrada e não mata inocentes nem desrespeita o sagrado. Segue a luz mesmo sem ter vida para voltar, sacrificaria a própria vida e espera reencontrar pai e mãe. Admira os Sete e Caelan Morvane, acredita em interferência divina e considera Cellebrimbor bela e justa por fora, mas corrupta por dentro.

Ponto 3 — Segredo, vínculo e objetivo
Segredo: matou alguém da seita e teme que essa pessoa pudesse ser boa.
Vínculo: as ferramentas da fazenda e o pai.
Objetivo: acabar com a seita e trazer paz aos Aasimar.
$bg$),
 (array['derick','kel thuzad']::text[], $bg$
Fonte: ficha do Notion — Derick / Kel Thuzad

Ponto 2 — Background
Tem 26 anos e veio de uma pequena comunidade próxima às rotas de Aurora. Estudioso e reservado, dedica-se à medicina, anatomia e aos mortos. Seus pais, Macieira Sacra e Limera Vag, estão vivos, porém distantes. A irmã Elena morreu; a perda mostrou que conhecimento não era poder. Em seu primeiro experimento de necromancia, ouviu uma voz que sabia seu nome. Uma página dizia: “Siga o presságio e ouça a doce melodia da minha voz, eu sei o que você procura.”

Teme morrer sem descobrir o que existe após a morte. Quer preservar a consciência e tornar-se lich. Enxerga a morte como doença; admite que os deuses talvez existam, mas não reconhece autoridade neles. Não destruiria conhecimento. Procura necromancia, o Tratado do Último Suspiro e o ritual de Elena, e sacrificaria quase tudo. Conserva o medalhão de Elena, desconfia dos Sete e acredita que Cellebrimbor guarda conhecimento.

Ponto 3 — Segredo, vínculo e objetivo
Segredo: realizou um ritual proibido no corpo da irmã e uma presença respondeu.
Vínculo: o medalhão de Elena.
Objetivo: compreender a consciência, superar a mortalidade e comandar os mortos.

Ambiguidade preservada: três respostas usam “Elias”, possivelmente um nome anterior.
$bg$),
 (array['felipe','yuri kenpachi']::text[], $bg$
Fonte: ficha do Notion — Felipe / Yuri Kenpachi

Ponto 2 — Background
Veio de uma vila no interior de Aurora. Teve uma infância feliz até ouvir uma voz tenebrosa durante uma chuva, apagar e despertar diante da mãe morta. Cuida do pai e de duas irmãs e sente culpa por não ter protegido a mãe.

Teme falhar ao proteger quem ama e busca paz. Acredita em magia e poder oculto e nunca aceitaria morrer sem lutar. Aventura-se para proteger os outros e impedir que a tragédia se repita; sacrificaria tudo. Deseja superar os Sete, não acredita em interferência divina e considera Cellebrimbor sua segunda casa.

Ponto 3 — Segredo, vínculo e objetivo
Segredo: às vezes ouve uma voz que quer lutar e matar.
Vínculo: a irmã mais velha.
Objetivo: ficar forte para proteger todos.
$bg$)
) as v(names,background) on lower(btrim(s.name))=any(v.names)
where not exists(select 1 from public.dnd_sheet_gm_notes n where n.sheet_id=s.id);
