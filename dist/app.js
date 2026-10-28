import { copySheetName, requestSheetCopy } from './copy-sheets.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { classesForTable, validateHomebrewClass, findClass, classReviewState, characterProgression, levelFeatures, existingSubclass, classLevelLabel, proficiencyBonus, catalogConditions, activeConditions, updateActiveCondition, conditionVisual, dominantCondition } from './progression.js';
import { MEDIA, validateMedia, mediaPath, imageDimensions } from './media.js';
import { sceneHistoryForTable, createLatestRequestGate, historyOrPrevious } from './scenes.js';
import { emptyGmNote, normalizeGmNote, gmNoteError } from './gm-notes.js';
import { goldThreshold, currencyProgress, validateCurrencyDistribution, currencyGainMessage } from './currency.js';
import { applyRealtimeChange, preserveDirtySheet } from './realtime-cache.js';
const db=createClient('https://psvugkyzlhzemptavpdh.supabase.co','sb_publishable_r6nBnvXMVpVx2HshzFXxSQ_8vr0Mnck');
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={user:null,tables:[],players:[],sheets:[],subclasses:[],settings:[],rulesets:[],rules:[],classes:[],classLevels:[],characterClasses:[],levelUps:[],wallets:[],assets:[],portraits:[],presentations:[],bossBars:[],bossTable:null,bossError:'',sceneHistory:[],mediaMode:'live',historyLoading:false,historyError:'',dismissedCutscene:null,table:null,view:'fichas',filter:'all',search:'',sheet:null,tab:'principal',dirty:false,saving:false,conflict:false,gmNote:null,channel:null,connected:false};
const mediaUrls=new Map();
const archivingSheets=new Set();
const bossBusy=new Set();
const bossRefreshGate=createLatestRequestGate();
let timer,toastTimer,authMode='login',refreshTimer,scenePollTimer,bossRefreshPromise,bossRefreshTable,subscriptionReady=false;
let sceneRefreshRunning=false,sceneRefreshPending=false;
const historyRefreshGate=createLatestRequestGate();
const abilities=[['str','Força'],['dex','Destreza'],['con','Constituição'],['int','Inteligência'],['wis','Sabedoria'],['cha','Carisma']];
const skills=[['Atletismo','str'],['Acrobacia','dex'],['Furtividade','dex'],['Prestidigitação','dex'],['Arcanismo','int'],['História','int'],['Investigação','int'],['Natureza','int'],['Religião','int'],['Intuição','wis'],['Lidar com animais','wis'],['Medicina','wis'],['Percepção','wis'],['Sobrevivência','wis'],['Atuação','cha'],['Enganação','cha'],['Intimidação','cha'],['Persuasão','cha']];
const mod=n=>Math.floor((Number(n??10)-10)/2),signed=n=>n>=0?'+'+n:n;
const gm=()=>state.tables.some(t=>t.id===state.table);
const table=()=>state.tables.find(t=>t.id===state.table);
const players=()=>state.players.filter(p=>p.table_id===state.table&&p.active);
const sheets=()=>state.sheets.filter(s=>s.table_id===state.table);
const availableClasses=(tableId=state.sheet?.table_id||state.table)=>classesForTable(state.classes,tableId);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),6500)}
function fail(error){console.error(error);toast(error?.message||'Não foi possível concluir. Tente novamente.');}
async function result(promise){const r=await promise;if(r.error)throw r.error;return r.data;}

function isBoss(sheet){return Boolean(sheet?.secret&&sheet.kind==='monstro'&&sheet.data?.is_boss===true)}
function bossBarsForTable(rows,tableId){
 const seen=new Set();return (Array.isArray(rows)?rows:[]).filter(row=>{
  if(!row||row.table_id!==tableId||typeof row.sheet_id!=='string'||!row.sheet_id||seen.has(row.sheet_id)||typeof row.name!=='string'||!row.name.trim()||row.name.length>150)return false;
  if(!['number','string'].includes(typeof row.hp)||!['number','string'].includes(typeof row.hp_max)||String(row.hp).trim()===''||String(row.hp_max).trim()==='')return false;
  const hp=Number(row.hp),max=Number(row.hp_max);if(!Number.isFinite(hp)||!Number.isFinite(max)||hp<0||max<=0)return false;
  seen.add(row.sheet_id);return true;
 }).map(row=>({sheet_id:row.sheet_id,table_id:row.table_id,name:row.name,hp:Math.min(Number(row.hp),Number(row.hp_max)),hp_max:Number(row.hp_max)}));
}
function bossControls(sheet){
 if(!gm()||!isBoss(sheet)||sheet.archived)return '';
 const visible=state.bossBars.some(b=>b.table_id===state.table&&b.sheet_id===sheet.id);
 return `<div class="boss-actions"><span>Boss · ${visible?'revelado à mesa':'oculto'}</span><button data-boss-visible="${sheet.id}" data-visible="${!visible}" ${bossBusy.has(sheet.id)||state.bossTable!==state.table||state.bossError?'disabled':''}>${visible?'Ocultar boss':'Revelar boss'}</button></div>`;
}
function bindBossControls(){document.querySelectorAll('[data-boss-visible]').forEach(button=>button.onclick=()=>setBossVisibility(button.dataset.bossVisible,button.dataset.visible==='true'))}
function renderBossBars(){
 const hud=$('#boss-hud');if(!hud)return;
 const rows=state.user?bossBarsForTable(state.bossBars,state.table):[];
 hud.hidden=!rows.length&&!(state.bossError&&gm());
 const markup=rows.map(b=>{const percent=Math.round(b.hp/b.hp_max*10000)/100;return `<div class="boss-bar"><h2>${esc(b.name)}</h2><div class="boss-life" role="progressbar" aria-label="Vida de ${esc(b.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}" aria-valuetext="${percent}% de vida restante"><div style="width:${percent}%"></div></div></div>`}).join('')+(state.bossError?`<p class="boss-sync-error" role="status">${esc(state.bossError)}</p>`:'');
 if(hud.innerHTML!==markup)hud.innerHTML=markup;
 document.querySelectorAll('[data-boss-visible]').forEach(button=>{
  const visible=rows.some(b=>b.sheet_id===button.dataset.bossVisible);button.dataset.visible=String(!visible);button.textContent=visible?'Ocultar boss':'Revelar boss';
  button.disabled=bossBusy.has(button.dataset.bossVisible)||state.bossTable!==state.table||Boolean(state.bossError);
  const label=button.parentElement?.querySelector('span');if(label)label.textContent='Boss · '+(visible?'revelado à mesa':'oculto');
 });
}
async function refreshBossBars({force=false}={}){
 if(!state.user||!state.table){state.bossBars=[];state.bossTable=null;state.bossError='';renderBossBars();return false;}
 const user=state.user,tableId=state.table;
 if(!force&&state.bossTable===tableId&&!state.bossError)return true;
 if(!force&&bossRefreshPromise&&bossRefreshTable===tableId)return bossRefreshPromise;
 const request=bossRefreshGate.begin();let refresh;
 refresh=(async()=>{
  try{
   const rows=await result(db.from('dnd_boss_bars').select('sheet_id,table_id,name,hp,hp_max').eq('table_id',tableId).order('sheet_id'));
   if(state.user!==user||state.table!==tableId||!bossRefreshGate.isLatest(request))return false;
   state.bossBars=bossBarsForTable(rows,tableId);state.bossTable=tableId;state.bossError='';renderBossBars();return true;
  }catch(err){
   if(state.user!==user||state.table!==tableId||!bossRefreshGate.isLatest(request))return false;
   state.bossError=['42P01','PGRST205'].includes(err?.code)?'Barras de boss indisponíveis: a migração do banco ainda precisa ser aplicada.':'Não foi possível sincronizar as barras de boss. Tentando novamente…';
   renderBossBars();return false;
  }finally{if(bossRefreshPromise===refresh){bossRefreshPromise=null;bossRefreshTable=null;}}
 })();
 bossRefreshPromise=refresh;bossRefreshTable=tableId;
 return refresh;
}
async function setBossVisibility(sheetId,visible){
 const sheet=state.sheets.find(s=>s.id===sheetId),user=state.user,tableId=state.table;
 if(!user||!gm()||!sheet||sheet.table_id!==tableId||!isBoss(sheet)||sheet.archived||bossBusy.has(sheetId))return;
 if(state.sheet?.id===sheetId&&!await leave())return;
 if(state.user!==user||state.table!==tableId)return;
 const current=state.sheet?.id===sheetId?state.sheet:state.sheets.find(s=>s.id===sheetId);
 bossBusy.add(sheetId);renderBossBars();
 try{
  await result(db.rpc('dnd_set_boss_visibility',{p_sheet_id:sheetId,p_visible:visible,p_expected_version:current.version}));
  if(state.user!==user||state.table!==tableId)return;
  const synced=await refreshBossBars({force:true});
  if(state.user!==user||state.table!==tableId)return;
  toast(synced?(visible?'Boss revelado à mesa.':'Boss ocultado.'):'Comando salvo. Aguardando sincronização da barra.');
 }catch(err){if(state.user===user&&state.table===tableId)fail(Error(({invalid_boss_hp:'Defina PV atuais válidos e PV máximos maiores que zero antes de revelar o boss.',not_a_boss:'Somente monstros secretos, ativos e marcados como boss podem ser revelados.',revision_conflict:'A ficha mudou. Recarregue antes de revelar ou ocultar o boss.',not_authorized:'Somente o mestre desta mesa pode apresentar um boss.'})[err?.message]||err?.message||'Não foi possível apresentar o boss.'))}
 finally{bossBusy.delete(sheetId);if(state.user===user&&state.table===tableId)renderBossBars()}
}

function navIcon(kind){const paths={copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',archive:'<path d="M4 8v12h16V8M3 3h18v5H3Zm6 9h6"/>',restore:'<path d="M4 11v9h16V8M3 3h18v5H11M3 12l4-4 4 4m-4-4v8"/>',group:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/>',map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/>',book:'<path d="M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4Zm10 3a3 3 0 0 1 3-3h4v16h-3a4 4 0 0 0-4 2"/>',up:'<path d="M12 21V3m-7 7 7-7 7 7"/>',lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]||paths.book}</svg>`}
function sessionSummary(){
 const d=state.sheet.data,hp=Number(d.hp??0),max=Number(d.hp_max??0),valid=Number.isFinite(hp)&&Number.isFinite(max)&&max>0,locked=state.saving||state.conflict||!valid;
 return `<section class="combat-summary" aria-label="Valores rápidos de combate"><div><span>Pontos de vida</span><div class="hp-adjust"><button type="button" data-hp="-1" aria-label="Diminuir um ponto de vida" aria-disabled="${locked||hp<=0}">−</button><strong><span data-session-value="hp">${esc(d.hp??0)}</span> <small>/ <span data-session-value="hp_max">${esc(d.hp_max??0)}</span></small></strong><button type="button" data-hp="1" aria-label="Aumentar um ponto de vida" aria-disabled="${locked||hp>=max}">+</button></div><small data-hp-note ${valid?'hidden':''}>Defina os PV máximos em Em jogo.</small></div><div><span>Defesa (CA)</span><strong data-session-value="ac">${esc(d.ac??10)}</strong></div><div><span>Iniciativa</span><strong data-session-value="initiative">${signed(Number(d.initiative)||0)}</strong></div><div><span>Deslocamento</span><strong data-session-value="speed">${esc(d.speed||'9 m')}</strong></div></section>`;
}
function bindHpControls(){document.querySelectorAll('[data-hp]').forEach(b=>b.onclick=()=>adjustHp(Number(b.dataset.hp)))}
function refreshSessionSummary(){
 const summary=$('#session-summary');if(!summary||!state.sheet)return;
 const d=state.sheet.data,hp=Number(d.hp??0),max=Number(d.hp_max??0),valid=Number.isFinite(hp)&&Number.isFinite(max)&&max>0;
 const values={hp:d.hp??0,hp_max:d.hp_max??0,ac:d.ac??10,initiative:signed(Number(d.initiative)||0),speed:d.speed||'9 m'};
 summary.querySelectorAll('[data-session-value]').forEach(el=>{el.textContent=String(values[el.dataset.sessionValue])});
 summary.querySelectorAll('[data-hp]').forEach(b=>b.setAttribute('aria-disabled',String(state.saving||state.conflict||!valid||(Number(b.dataset.hp)<0?hp<=0:hp>=max))));
 const note=summary.querySelector('[data-hp-note]');if(note)note.hidden=valid;
}
function adjustHp(delta){
 if(!state.sheet||state.saving||state.conflict||![1,-1].includes(delta))return;
 const d=state.sheet.data,hp=Number(d.hp??0),max=Number(d.hp_max);
 if(!Number.isFinite(hp)||!Number.isFinite(max)||max<=0)return;
 if((delta>0&&hp>=max)||(delta<0&&hp<=0))return;
 const next=Math.min(max,Math.max(0,hp+delta));if(next===hp)return;
 d.hp=next;state.dirty=true;const input=$('[data-field="hp"]');if(input)input.value=String(next);
 const status=$('#save-status');if(status)status.textContent='Alterações pendentes…';
 refreshSessionSummary();clearTimeout(timer);timer=setTimeout(save,600);
}

function focusWorkspace(){const main=$('#main-content');if(main){main.focus();main.scrollIntoView({block:'start'})}}
function brand(){return '<div class="brand"><span class="mark"><img src="grimorio-icon.png" alt=""></span><div>Grimório<small>FICHAS DE D&D</small></div></div>'}
function login(){ $('#app').innerHTML=`<div class="login"><aside class="login-art">${brand()}<div class="ornament" aria-hidden="true">✧</div><div class="intro"><div class="eyebrow">CADA PERSONAGEM, UMA HISTÓRIA</div><h1>Sua aventura.<br>Em boas mãos.</h1><p>Um lugar para as fichas da sua mesa. Cada ponto de vida, cada magia, cada mudança — juntos, em tempo real.</p></div><div class="note">D&D 2024 · Fichas em português · Segredos guardados</div></aside><main class="login-form"><div class="eyebrow">BEM-VINDO À MESA</div><h2>${authMode==='signup'?'Abra seu grimório':'A aventura continua'}</h2><p>Entre para acessar suas fichas e sua mesa.</p><div class="tabs"><button data-auth="login" class="${authMode==='login'?'active':''}">Entrar</button><button data-auth="signup" class="${authMode==='signup'?'active':''}">Criar conta</button></div><form id="auth-form"><label>E-mail<input name="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com"></label><label>Senha<input name="password" type="password" minlength="8" autocomplete="${authMode==='signup'?'new-password':'current-password'}" required placeholder="Pelo menos 8 caracteres"></label><button class="primary">${authMode==='signup'?'Criar minha conta':'Entrar no Grimório'} →</button><p id="auth-message" role="status" class="note"></p></form><p class="note">É jogador? Use o mesmo e-mail que seu mestre adicionou à mesa. Suas fichas aparecerão após o login.</p></main></div>`;
 document.querySelectorAll('[data-auth]').forEach(b=>b.onclick=()=>{authMode=b.dataset.auth;login()});
 $('#auth-form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;const f=new FormData(e.target);try{const credentials={email:f.get('email').trim().toLowerCase(),password:f.get('password')};const r=authMode==='signup'?await db.auth.signUp({...credentials,options:{emailRedirectTo:location.origin}}):await db.auth.signInWithPassword(credentials);if(r.error)throw r.error;if(!r.data.session)$('#auth-message').textContent='Conta criada. Confirme seu e-mail e depois volte aqui para entrar.';else await start(r.data.session.user);}catch(err){$('#auth-message').textContent=err.message==='Invalid login credentials'?'E-mail ou senha incorretos.':err.message;}finally{b.disabled=false;}};
}
async function load(){const [ts,ps,ss,settings,rulesets,rules,classes,classLevels,characterClasses,levelUps,wallets,assets,portraits,presentations]=await Promise.all([result(db.from('dnd_tables').select('*').order('created_at')),result(db.from('dnd_players').select('*').order('created_at')),result(db.from('dnd_sheets').select('*').order('updated_at',{ascending:false})),result(db.from('dnd_table_settings').select('*')),result(db.from('dnd_rulesets').select('*').eq('active',true)),result(db.from('dnd_rule_entries').select('*').order('name')),result(db.from('dnd_classes').select('*').order('name')),result(db.from('dnd_class_levels').select('*')),result(db.from('dnd_character_classes').select('*')),result(db.from('dnd_level_ups').select('*').order('created_at',{ascending:false})),result(db.from('dnd_sheet_wallets').select('*')),result(db.from('dnd_media_assets').select('*').is('deleted_at',null)),result(db.from('dnd_sheet_portraits').select('*')),result(db.from('dnd_table_presentations').select('*'))]);Object.assign(state,{tables:ts,players:ps,sheets:ss,settings,rulesets,rules,classes,classLevels,characterClasses,levelUps,wallets,assets,portraits,presentations});const history=await historyOrPrevious(result(db.from('dnd_scene_history').select('*').is('removed_at',null).order('created_at',{ascending:false})),state.sceneHistory);state.sceneHistory=history.entries;state.historyError=history.error;state.subclasses=await result(db.from('dnd_subclasses').select('*').order('name'));const ids=[...new Set([...ts.map(t=>t.id),...ps.filter(p=>p.active).map(p=>p.table_id),...ss.map(s=>s.table_id)])];if(!ids.includes(state.table))state.table=ids[0]||null;}
const realtimeCollections={dnd_sheets:{collection:'sheets'},dnd_players:{collection:'players'},dnd_tables:{collection:'tables'},dnd_classes:{collection:'classes'},dnd_subclasses:{collection:'subclasses'},dnd_table_settings:{collection:'settings',key:'table_id'}};
function applyRealtimePayload({collection,key='id'},payload){
 const change=applyRealtimeChange(state[collection],payload,key);if(!change.handled)return false;
 state[collection]=change.rows;
 if(collection==='sheets'&&state.sheet?.id===((payload.eventType==='DELETE'?payload.old:payload.new)?.id)){
  if(payload.eventType==='DELETE'){state.sheet=null;state.dirty=false;clearTimeout(timer);toast('O acesso a esta ficha foi removido.');}
  else state.sheet=preserveDirtySheet(state.sheet,payload,state);
 }
 const ids=[...new Set([...state.tables.map(t=>t.id),...state.players.filter(p=>p.active).map(p=>p.table_id),...state.sheets.map(s=>s.table_id)])];
 if(!ids.includes(state.table))state.table=ids[0]||null;
 return true;
}
function realtimeChanged(table){return payload=>{if(applyRealtimePayload(realtimeCollections[table],payload)){render();return;}changed();}}
async function start(user){clearInterval(scenePollTimer);subscriptionReady=false;state.user=user;await result(db.rpc('dnd_claim_player_identity'));await load();render();if(state.channel)await db.removeChannel(state.channel);state.channel=db.channel('grimorio-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'dnd_sheets'},realtimeChanged('dnd_sheets')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_players'},realtimeChanged('dnd_players')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_tables'},realtimeChanged('dnd_tables')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_classes'},realtimeChanged('dnd_classes')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_subclasses'},realtimeChanged('dnd_subclasses')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_table_settings'},realtimeChanged('dnd_table_settings')).on('postgres_changes',{event:'*',schema:'public',table:'dnd_level_ups'},changed).on('postgres_changes',{event:'INSERT',schema:'public',table:'dnd_currency_allocations'},currencyAllocationChanged).on('postgres_changes',{event:'*',schema:'public',table:'dnd_table_presentations'},refreshPresentation).on('postgres_changes',{event:'*',schema:'public',table:'dnd_scene_history'},refreshSceneHistory).on('postgres_changes',{event:'*',schema:'public',table:'dnd_boss_bars'},()=>void refreshBossBars({force:true})).subscribe(status=>{state.connected=status==='SUBSCRIBED';const el=$('#connection');if(el)el.textContent=state.connected?'Conectado em tempo real':'Reconectando…';if(state.connected){if(subscriptionReady)changed();subscriptionReady=true;pollSceneState();}});scenePollTimer=setInterval(pollSceneState,30000);}
function currencyAllocationChanged(payload){const allocation=payload?.new;if(!allocation||allocation.created_by===state.user?.id)return changed();const sheet=state.sheets.find(s=>s.id===allocation.sheet_id),wallet=state.wallets.find(w=>w.sheet_id===allocation.sheet_id),progress=currencyProgress(wallet,sheet?.data?.level);const ready=Number(allocation.gp_amount)>0&&progress.goal>0&&progress.current+Number(allocation.gp_amount)>=progress.goal;toast(currencyGainMessage(allocation,ready));changed();}
function pollSceneState(){if(!document.hidden)void refreshPresentation()}
function changed(){if(!state.user)return;clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{try{if(!state.user)return;await load();if(!state.user)return;showCutscene();if(state.sheet){const fresh=state.sheets.find(s=>s.id===state.sheet.id);if(!fresh){state.sheet=null;state.dirty=false;clearTimeout(timer);toast('O acesso a esta ficha foi removido.');render();return;}if(state.dirty||state.saving)return;const focus=document.activeElement;if(focus?.matches('[data-field]'))return;state.sheet=structuredClone(fresh);}render();}catch(err){fail(err)}},200);}
function render(){if(!state.user)return login();const ids=[...new Set([...state.tables.map(t=>t.id),...state.players.filter(p=>p.active).map(p=>p.table_id),...state.sheets.map(s=>s.table_id)])];$('#app').innerHTML=`<a class="skip-link" href="#main-content">Ir para o conteúdo</a><div class="shell"><aside class="sidebar">${brand()}<div><label class="table-label" for="table-select">Sua mesa</label><select id="table-select" aria-label="Selecionar mesa">${ids.length?ids.map(id=>`<option value="${id}" ${id===state.table?'selected':''}>${esc(state.tables.find(t=>t.id===id)?.name||'Mesa · '+id.slice(0,4))}</option>`).join(''):'<option>Nenhuma mesa</option>'}</select></div><nav aria-label="Navegação principal"><button data-view="fichas" class="${state.view==='fichas'?'active':''}">${navIcon('group')} ${gm()?'Visão da mesa':'Minhas fichas'}</button><button data-view="mapa" class="${state.view==='mapa'?'active':''}">${navIcon('map')} Mapa e cenas</button><button data-view="glossario" class="${state.view==='glossario'?'active':''}">${navIcon('book')} Glossário</button><button data-view="progressao" class="${state.view==='progressao'?'active':''}">${navIcon('up')} Progressão</button>${gm()?`<button data-view="homebrew" class="${state.view==='homebrew'?'active':''}">${navIcon('book')} Classes homebrew</button><button data-view="secretas" class="${state.view==='secretas'?'active':''}">${navIcon('lock')} Arquivo secreto</button><button data-view="jogadores" class="${state.view==='jogadores'?'active':''}">${navIcon('group')} Jogadores</button>`:''}<button id="new-table">＋ &nbsp; Criar mesa</button></nav><div class="foot"><b>${gm()?'Visão do mestre':'Visão do jogador'}</b><br>D&D 2024 · Português</div></aside><main class="main" id="main-content" tabindex="-1"><header class="topbar"><span class="workspace-context">${esc(table()?.name||'Sua mesa')} <span aria-hidden="true">/</span> <b>${gm()?'Visão do mestre':'Visão do jogador'}</b></span><span id="connection" class="status">${state.connected?'Conectado em tempo real':'Conectando…'}</span><button class="quiet" id="logout" title="${esc(state.user.email)}">Sair</button></header><section id="boss-hud" class="boss-hud" aria-label="Bosses revelados" hidden></section><div id="content"></div></main></div>`;
 $('#table-select').onchange=async e=>{if(!await leave())return render();state.table=e.target.value;state.sheet=null;state.view='fichas';state.search='';state.filter='all';state.mediaMode='live';render();void refreshPresentation()};
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{if(!await leave())return;state.view=b.dataset.view;state.sheet=null;state.search='';state.filter='all';render();focusWorkspace()});
 $('#new-table').onclick=async()=>{if(await leave())newTable()};$('#logout').onclick=async()=>{if(!await leave())return;await db.auth.signOut();state.user=null;state.sheet=null;state.bossBars=[];state.bossTable=null;state.bossError='';state.connected=false;if(state.channel)await db.removeChannel(state.channel);login()};
 document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===state.view&&!state.sheet)b.setAttribute('aria-current','page')});
 if(state.sheet)editor();else if(state.view==='homebrew'&&gm())homebrewView();else if(state.view==='jogadores'&&gm())playerView();else if(state.view==='mapa')mediaView();else if(state.view==='glossario')glossaryView();else if(state.view==='progressao')progressView();else dashboard();hydrateMedia();showCutscene();renderBossBars();void refreshBossBars();
}
async function leave(){if(state.dirty){await save();if(state.dirty){toast('Salve ou recarregue a ficha antes de sair.');return false;}}return !state.saving;}
function dashboard(){
 const secret=state.view==='secretas'&&gm(),isGm=gm(),ss=sheets().filter(s=>s.secret===secret);
 const pending=state.levelUps.filter(l=>l.table_id===state.table&&l.status==='pending'&&ss.some(s=>s.id===l.sheet_id&&!s.archived));
 $('#content').innerHTML=`<div class="heading"><div><h1>${secret?'Arquivo secreto':isGm?'Sua mesa, pronta para jogar.':'Minhas fichas'}</h1><p>${secret?'NPCs, criaturas e histórias de acesso exclusivo do mestre.':isGm?'Consulte o grupo e resolva o que precisa da sua atenção.':'Abra sua ficha para acompanhar vida, atributos e recursos.'}</p></div><div class="actions">${state.table&&!secret?'<button id="dashboard-map">Mapa e cenas</button>':''}${isGm?'<button class="primary" id="new-sheet">+ Nova ficha</button>':''}</div></div><div class="session-stats"><span><b>${ss.filter(s=>!s.archived).length}</b> ${secret?'fichas secretas':isGm?'personagens ativos':'fichas ativas suas'}</span>${isGm?'<span><b>'+players().length+' / '+(table()?.max_players??0)+'</b> jogadores na mesa</span>':''}<span><b>${secret?'Só o mestre':'D&D 2024'}</b> ${secret?'tem acesso':'regras da mesa'}</span></div><div class="session-desk"><section aria-label="Fichas"><div class="section-title"><h2>${secret?'Fichas secretas':isGm?'Grupo de aventureiros':'Seus personagens'}</h2></div><div class="toolbar"><div class="tabs" aria-label="Filtrar fichas"><button data-filter="all" aria-pressed="${state.filter==='all'}" class="${state.filter==='all'?'active':''}">Ativas</button><button data-filter="archived" aria-pressed="${state.filter==='archived'}" class="${state.filter==='archived'?'active':''}">Arquivadas</button></div><input id="search" type="search" placeholder="Buscar personagem ou jogador…" aria-label="Buscar fichas por nome, jogador, classe ou espécie" value="${esc(state.search)}"></div><div id="cards"></div><p class="note session-tip">${secret?'As fichas deste arquivo são acessíveis somente pelo mestre.':'As alterações são salvas automaticamente ao sair de cada campo.'}</p></section>${state.table&&!secret?`<aside class="session-rail">${isGm?`<section><h2>Precisa de você</h2><p>${pending.length?pending.length+' '+(pending.length===1?'solicitação':'solicitações')+' de subida de nível.':'Nenhuma solicitação de nível pendente.'}</p>${pending.slice(0,3).map(l=>{const s=ss.find(s=>s.id===l.sheet_id);return `<div class="pending-request"><b>${esc(s.name)}</b><small>Nível ${esc(l.from_total_level??s.data.level??1)} → ${esc(l.to_total_level??Number(s.data.level||1)+1)}</small></div>`}).join('')}${pending.length?'<button id="dashboard-progress" class="primary">Revisar solicitações</button>':''}</section><section><p class="private-label">Visível só para o mestre</p><h2>Arquivo secreto</h2><p>Consulte NPCs e criaturas sem expor seus preparativos ao grupo.</p><button id="dashboard-secret" class="quiet">Abrir arquivo secreto →</button></section>`:`<section><h2>Progressão</h2><p>${pending.length?pending.length+' pedido(s) de suas fichas aguardando aprovação.':'Consulte as regras da mesa e o histórico de suas fichas.'}</p><button id="dashboard-progress">Consultar progressão</button></section><section><h2>Mapa e cenas</h2><p>O mapa e as cenas compartilhados pelo mestre ficam disponíveis na navegação.</p></section>`}</aside>`:''}</div>`;
 if($('#new-sheet'))$('#new-sheet').onclick=()=>newSheet(secret);
 for(const [id,view] of [['dashboard-map','mapa'],['dashboard-progress','progressao'],['dashboard-secret','secretas']]){const button=$('#'+id);if(button)button.onclick=()=>{state.view=view;state.search='';state.filter='all';render();focusWorkspace()}}
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;dashboard()});$('#search').oninput=e=>{state.search=e.target.value;cards(secret)};cards(secret);
}
function cards(secret){const list=sheets().filter(s=>s.secret===secret&&s.archived===(state.filter==='archived')&&[s.name,s.data.class,s.data.species,state.players.find(p=>p.id===s.player_id)?.name].some(v=>String(v||'').toLowerCase().includes(state.search.toLowerCase())));$('#cards').innerHTML=list.length?`<div class="cards">${list.map(s=>{const d=s.data,p=state.players.find(p=>p.id===s.player_id),portrait=portraitAsset(s.id),conditions=activeConditions(s,state.rules),dominant=dominantCondition(conditions),dominantVisual=dominant&&conditionVisual(dominant.slug),conditionIcons=conditions.length?`<div class="condition-card-icons" aria-label="Condições ativas">${conditions.map(condition=>{const visual=conditionVisual(condition.slug);return `<span data-tone="${visual.tone}" title="${esc(condition.name)}" aria-label="${esc(condition.name)}">${visual.icon}</span>`}).join('')}</div>`:'';return `<article class="card ${dominant?'card-conditioned':''}" ${dominant?`data-tone="${dominantVisual.tone}" data-dominant-tone="${dominantVisual.tone}"`:''}><div class="card-top"><div class="card-avatar-wrap"><div class="avatar">${portrait?`<img data-media="${portrait.id}" alt="Retrato de ${esc(s.name)}">`:esc(s.name.charAt(0).toUpperCase())}</div>${conditionIcons}</div><div><span class="badge">${s.secret?'◇ Secreta · ':''}${esc(isBoss(s)?'Boss':s.kind)}</span><h3>${esc(s.name)}</h3><small>${esc(d.species||'Espécie não definida')} · ${esc(d.class||'Sem classe')}</small></div></div><div class="card-body"><small>${esc(p?.name||'Ficha do mestre')}</small><div class="mini-stats"><div><b>${esc(d.level||1)}</b><span>NÍVEL</span></div><div><b>${esc(d.ac??10)}</b><span>ARMADURA</span></div><div><b>${esc(d.hp??0)}<small> / ${esc(d.hp_max??0)}</small></b><span>PONTOS DE VIDA</span></div></div><div class="hpbar"><i style="width:${Math.min(100,Math.max(0,Number(d.hp||0)/Math.max(1,Number(d.hp_max||1))*100))}%"></i></div><div class="card-actions"><button data-open="${s.id}" aria-label="Abrir ficha de ${esc(s.name)}">Abrir ficha <span aria-hidden="true">↗</span></button><div class="card-tools" role="group" aria-label="Ações do mestre">${gm()?`<button data-copy-sheet="${s.id}" class="card-tool" aria-label="Copiar ficha de ${esc(s.name)}" title="Copiar ficha">${navIcon('copy')}<span>Copiar</span></button>`:''}${gm()?`<button class="notebook-button" data-gm-notes="${s.id}" aria-label="Abrir caderno do mestre de ${esc(s.name)}" title="Caderno do mestre">${navIcon('book')}<span>Caderno</span></button>`:''}${gm()?`<button class="card-tool" data-archive-sheet="${s.id}" aria-label="${s.archived?'Restaurar':'Arquivar'} ficha de ${esc(s.name)}" title="${s.archived?'Restaurar ficha':'Arquivar ficha'}" ${archivingSheets.has(s.id)?'disabled aria-busy="true"':''}>${navIcon(s.archived?'restore':'archive')}<span>${s.archived?'Restaurar':'Arquivar'}</span></button>`:''}</div>${bossControls(s)}</div></div></article>`}).join('')}</div>`:`<div class="empty"><div class="sigil" aria-hidden="true">${secret?'◇':'✧'}</div><h2>${state.search?'Nenhuma ficha encontrada':state.filter==='archived'?'Nenhuma ficha arquivada':secret?'Guarde aqui seus segredos':'Uma mesa pronta para novas histórias'}</h2><p>${state.search?'Tente outro nome, classe ou espécie.':gm()?'Crie uma ficha e dê início à próxima aventura. Você pode adicionar os jogadores e definir o limite da mesa.':state.table?'Seu mestre ainda não atribuiu uma ficha a você.':'Peça ao mestre para adicionar seu e-mail à mesa, ou crie sua própria mesa para mestrar.'}</p>${!state.table?'<button class="primary" id="empty-create">Criar minha mesa</button>':''}</div>`;document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>{state.sheet=structuredClone(state.sheets.find(s=>s.id===b.dataset.open));state.tab='combate';state.dirty=false;state.conflict=false;render();focusWorkspace()});document.querySelectorAll('[data-copy-sheet]').forEach(b=>b.onclick=()=>copySheet(state.sheets.find(s=>s.id===b.dataset.copySheet)));document.querySelectorAll('[data-gm-notes]').forEach(b=>b.onclick=()=>openGmNotebook(state.sheets.find(s=>s.id===b.dataset.gmNotes)));document.querySelectorAll('[data-archive-sheet]').forEach(b=>b.onclick=()=>archiveSheet(state.sheets.find(s=>s.id===b.dataset.archiveSheet),b));bindBossControls();if($('#empty-create'))$('#empty-create').onclick=newTable;hydrateMedia();}
async function archiveSheet(sheet,button){
 if(!state.user||!gm()||!sheet||sheet.table_id!==state.table||archivingSheets.has(sheet.id))return;
 const user=state.user,archived=!sheet.archived;archivingSheets.add(sheet.id);button.disabled=true;button.setAttribute('aria-busy','true');
 try{
  const fresh=await result(db.from('dnd_sheets').update({archived}).eq('id',sheet.id).eq('table_id',sheet.table_id).eq('version',sheet.version).select().maybeSingle());
  if(state.user!==user)return;
  if(!fresh)throw Error('A ficha mudou em outra tela. Recarregue antes de tentar novamente.');
  const index=state.sheets.findIndex(s=>s.id===fresh.id);if(index>=0)state.sheets[index]=fresh;
  toast(archived?'Ficha arquivada. Você pode restaurá-la em Arquivadas.':'Ficha restaurada.');
 }catch(err){if(state.user===user)fail(err)}finally{
  archivingSheets.delete(sheet.id);button.disabled=false;button.removeAttribute('aria-busy');
  if(state.user===user&&state.table===sheet.table_id){void refreshBossBars();if(!state.sheet&&['fichas','secretas'].includes(state.view))dashboard();}
 }
}
function modal(title,body,submit){const d=$('#dialog');d.innerHTML=`<form><h2>${title}</h2>${body}<p class="error" id="modal-error" role="alert"></p><div class="actions"><button type="button" id="cancel">Cancelar</button><button class="primary">Salvar</button></div></form>`;$('#cancel').onclick=()=>d.close();d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('.primary');if(b.disabled)return;b.disabled=true;try{await submit(new FormData(e.target));d.close();await load();render();}catch(err){$('#modal-error').textContent=err.message;}finally{b.disabled=false;}};d.showModal();}
async function openGmNotebook(sheet){
 if(!sheet||!gm())return fail(Error('Somente o mestre desta mesa pode acessar este caderno.'));
 const d=$('#dialog');d.innerHTML='<div class="notebook-loading" role="status">Abrindo o caderno do mestre…</div>';d.showModal();
 try{const row=await result(db.from('dnd_sheet_gm_notes').select('*').eq('sheet_id',sheet.id).maybeSingle());state.gmNote=normalizeGmNote(row,sheet);renderGmNotebook(sheet,'background')}
 catch(err){d.close();fail(Error(gmNoteError(err)))}
}
function renderGmNotebook(sheet,tab){
 const d=$('#dialog'),note=state.gmNote||emptyGmNote(sheet),isBackground=tab==='background';
 d.innerHTML=`<form class="notebook-modal"><div class="notebook-title"><span class="notebook-icon" aria-hidden="true">▤</span><div><div class="eyebrow">VISÍVEL SOMENTE PARA O MESTRE</div><h2>Caderno de ${esc(sheet.name)}</h2></div></div><div class="tabs" role="tablist" aria-label="Seções do caderno"><button type="button" role="tab" data-note-tab="background" class="${isBackground?'active':''}" aria-selected="${isBackground}">Background</button><button type="button" role="tab" data-note-tab="notes" class="${isBackground?'':'active'}" aria-selected="${!isBackground}">Anotações</button></div><label>${isBackground?'Pontos 2 e 3 da ficha':'Anotações do mestre'}<textarea name="note-content" rows="14" maxlength="30000" placeholder="${isBackground?'Registre aqui o background privado da ficha.':'Registre acontecimentos, pistas e lembretes das sessões anteriores.'}">${esc(isBackground?note.background:note.notes)}</textarea></label><p class="note">Este conteúdo é privado e não faz parte dos dados compartilhados da ficha.</p><p class="error" id="modal-error" role="alert"></p><div class="actions"><button type="button" id="cancel">Fechar</button><button class="primary">Salvar caderno</button></div></form>`;
 const capture=()=>{note[isBackground?'background':'notes']=d.querySelector('[name=note-content]').value;state.gmNote=note};
 d.querySelector('#cancel').onclick=()=>d.close();d.querySelectorAll('[data-note-tab]').forEach(button=>button.onclick=()=>{capture();renderGmNotebook(sheet,button.dataset.noteTab)});
 d.querySelector('form').onsubmit=async event=>{event.preventDefault();capture();const button=event.target.querySelector('.primary');button.disabled=true;$('#modal-error').textContent='';try{const saved=await result(db.rpc('save_sheet_gm_notes',{p_sheet_id:sheet.id,p_background:note.background,p_notes:note.notes,p_expected_revision:note.revision}));state.gmNote=normalizeGmNote(saved,sheet);d.close();toast('Caderno do mestre salvo.')}catch(err){$('#modal-error').textContent=gmNoteError(err)}finally{button.disabled=false}};
}
function newTable(){modal('Uma nova mesa','<label>Nome da mesa<input name="name" required maxlength="100" placeholder="Ex.: As Crônicas de Valdora"></label><label>Limite de jogadores<input name="limit" type="number" min="1" max="1000" value="6" required></label><p class="note">Você será o mestre desta mesa e poderá alterar o limite depois.</p>',async f=>{const t=await result(db.from('dnd_tables').insert({name:f.get('name').trim(),max_players:Number(f.get('limit'))}).select().single());state.table=t.id;state.view='fichas';state.sheet=null;toast('Mesa criada. Bem-vindo à aventura!')})}
function copySheet(sheet){
 if(!gm()||!sheet||sheet.table_id!==state.table)return;
 modal('Copiar ficha',`<label>Nome da cópia<input name="name" required maxlength="150" value="${esc(copySheetName(sheet.name))}"></label><p class="note">A cópia mantém os dados, classes, sigilo e jogador responsável. Retrato, histórico e caderno do mestre não serão copiados.</p>`,async f=>{
  const copied=await requestSheetCopy(db,sheet,f.get('name'),gm());
  state.sheet=copied;state.tab='principal';state.dirty=false;state.conflict=false;state.filter='all';toast('Ficha copiada.');
 });
}
function newSheet(secret){modal(secret?'Nova ficha secreta':'Nova ficha','<label>Nome<input name="name" required maxlength="150" placeholder="Nome do personagem"></label>'+ (secret?'<label>Tipo<select name="kind"><option value="npc">NPC</option><option value="monstro">Monstro</option><option value="boss">Boss</option><option value="personagem">Personagem secreto</option></select></label><p class="note">Somente você poderá ler e editar esta ficha.</p>':`<label>Jogador responsável<select name="player"><option value="">Mestre (sem jogador)</option>${players().map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></label>`),async f=>{const s=await result(db.from('dnd_sheets').insert({table_id:state.table,name:f.get('name').trim(),secret,kind:secret?(f.get('kind')==='boss'?'monstro':f.get('kind')):'personagem',player_id:secret?null:f.get('player')||null,data:{is_boss:secret&&f.get('kind')==='boss',level:1,ac:10,hp:0,hp_max:0,str:10,dex:10,con:10,int:10,wis:10,cha:10,proficiency:2}}).select().single());state.sheet=s;state.tab='principal';state.dirty=false;state.conflict=false;toast('Ficha criada.')})}
function playerView(){const ps=players();$('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">CADA AVENTUREIRO TEM SEU LUGAR</div><h1>Jogadores</h1><p>Adicione os e-mails que terão acesso às fichas atribuídas.</p></div><button class="primary" id="add-player">＋ Adicionar jogador</button></div><section class="panel"><div class="row"><div><h3>Vagas à sua maneira</h3><p>${ps.length} de ${table().max_players} vagas ocupadas. O mestre não ocupa uma vaga.</p></div><button id="limit">Alterar limite</button></div>${ps.map(p=>`<div class="row"><div><b>${esc(p.name)}</b><p>${esc(p.email)} · ${sheets().filter(s=>s.player_id===p.id&&!s.archived).length} ficha(s)</p></div><button data-remove="${p.id}" class="quiet danger">Remover acesso</button></div>`).join('')||'<p style="margin-top:20px">Nenhum jogador adicionado ainda.</p>'}</section><p class="note">Compartilhe o endereço do site com seus jogadores. Eles devem criar uma conta usando o e-mail adicionado aqui. Nenhum convite é enviado automaticamente.</p><button id="copy-link">Copiar endereço do site</button>`;
 $('#limit').onclick=()=>modal('Limite de jogadores',`<label>Quantidade máxima<input name="limit" type="number" min="${Math.max(1,ps.length)}" max="1000" value="${table().max_players}" required></label>`,async f=>{await result(db.from('dnd_tables').update({max_players:Number(f.get('limit'))}).eq('id',state.table));toast('Limite atualizado.')});
 $('#add-player').onclick=()=>modal('Adicionar jogador','<label>Nome<input name="name" required maxlength="100"></label><label>E-mail da conta<input type="email" name="email" required></label>',async f=>{const email=f.get('email').trim().toLowerCase();const old=state.players.find(p=>p.table_id===state.table&&p.email===email);if(old?.active)throw Error('Este jogador já está na mesa.');await result(old?db.from('dnd_players').update({active:true,name:f.get('name').trim()}).eq('id',old.id):db.from('dnd_players').insert({table_id:state.table,name:f.get('name').trim(),email}));toast('Jogador adicionado. Atribua uma ficha a ele.')});
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>modal('Remover acesso?','<p>O jogador perderá acesso às fichas desta mesa. Suas fichas serão preservadas para o mestre.</p>',async()=>{await result(db.from('dnd_players').update({active:false}).eq('id',b.dataset.remove));toast('Acesso removido.')}));$('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.origin);toast('Endereço copiado.')}catch{toast('Copie o endereço na barra do navegador.')}};
}
function homebrewView(){
 if(!gm()){ $('#content').innerHTML='<div class="empty"><h2>Somente o mestre pode gerenciar classes homebrew.</h2></div>';return; }
 const classes=availableClasses(state.table).filter(c=>c.table_id===state.table).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
 $('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">CRIAÇÕES DA SUA MESA</div><h1>Classes homebrew</h1><p>Estas classes e subclasses ficam disponíveis apenas nesta mesa.</p></div><button id="new-homebrew" class="primary">＋ Criar classe</button></div>${classes.length?classes.map(c=>`<section class="panel"><div class="row"><div><h3>${esc(c.name)} <span class="badge">Homebrew</span></h3><p>d${c.hit_die} de vida · Subclasse no nível ${c.subclass_level}</p></div><button data-add-subclass="${esc(c.id)}">Adicionar subclasse</button></div><p style="white-space:pre-line">${esc(c.description)}</p><h4>Subclasses</h4>${state.subclasses.filter(s=>s.class_id===c.id).map(s=>`<div class="row"><div><b>${esc(s.name)}</b><p style="white-space:pre-line">${esc(s.description)}</p></div></div>`).join('')}</section>`).join(''):'<div class="empty"><h2>Nenhuma classe homebrew</h2><p>Crie uma classe e suas subclasses para os personagens desta mesa.</p></div>'}<p class="note">O dado de vida e a escolha de subclasse são usados na subida de nível. Registre habilidades e recursos nos campos de características da ficha.</p>`;
 $('#new-homebrew').onclick=newHomebrewClass;
 document.querySelectorAll('[data-add-subclass]').forEach(b=>b.onclick=()=>newHomebrewSubclass(b.dataset.addSubclass));
}
function newHomebrewClass(){
 if(!gm())return;
 const tableId=state.table;
 modal('Criar classe homebrew',`<p class="note">Disponível somente em ${esc(table()?.name||'esta mesa')}.</p><label>Nome da classe<input name="name" required maxlength="100" placeholder="Ex.: Pirata"></label><label>Descrição<textarea name="description" maxlength="5000" rows="3"></textarea></label><div class="grid two"><label>Dado de vida<select name="hit_die"><option value="6">d6</option><option value="8" selected>d8</option><option value="10">d10</option><option value="12">d12</option></select></label><label>Nível de escolha da subclasse<input name="subclass_level" type="number" min="1" max="20" value="3" required></label></div><label>Subclasses — uma por linha<textarea name="subclasses" rows="4" maxlength="10100" placeholder="Corsário&#10;Bucaneiro" required></textarea></label><p class="note">Inclua pelo menos uma subclasse. Você poderá adicionar outras depois.</p>`,async f=>{
  const input=validateHomebrewClass({name:f.get('name'),description:f.get('description'),hit_die:f.get('hit_die'),subclass_level:f.get('subclass_level'),subclasses:String(f.get('subclasses')||'').split(/\r?\n/).filter(s=>s.trim()).map(name=>({name,description:''}))},state.classes,tableId);
  await result(db.rpc('dnd_create_homebrew_class',{p_table_id:tableId,p_name:input.name,p_description:input.description,p_hit_die:input.hit_die,p_subclass_level:input.subclass_level,p_subclasses:input.subclasses}));
  toast('Classe criada para esta mesa. Já pode ser escolhida na ficha.');
 });
}
function newHomebrewSubclass(classId){
 if(!gm())return;
 const c=availableClasses(state.table).find(c=>c.id===classId&&c.table_id===state.table);
 if(!c)return;
 modal('Adicionar subclasse',`<p>Classe: ${esc(c.name)} · Somente nesta mesa</p><label>Nome<input name="name" required maxlength="100"></label><label>Descrição<textarea name="description" rows="3" maxlength="5000"></textarea></label>`,async f=>{
  const input=validateHomebrewClass({name:c.name,description:c.description,hit_die:c.hit_die,subclass_level:c.subclass_level,subclasses:[{name:f.get('name'),description:f.get('description')}]});
  if(state.subclasses.some(s=>s.class_id===c.id&&s.name.trim().toLocaleLowerCase('pt-BR')===input.subclasses[0].name.toLocaleLowerCase('pt-BR')))throw Error('Já existe uma subclasse com este nome.');
  await result(db.rpc('dnd_add_homebrew_subclass',{p_class_id:c.id,p_name:input.subclasses[0].name,p_description:input.subclasses[0].description}));
  toast('Subclasse adicionada.');
 });
}
function isCantrip(entry){return entry.kind==='spell'&&(entry.metadata?.spell_level===0||entry.metadata?.tags?.includes('Truques'));}
function spellLevel(entry){const level=Number(entry.metadata?.spell_level);return entry.kind==='spell'&&Number.isInteger(level)&&level>=0&&level<=9?level:null;}
function matchesGlossaryClass(entry,classId){
 if(!classId)return true;
 const c=availableClasses().find(c=>c.id===classId),m=entry.metadata||{};
 if(!c)return false;
 const sameName=value=>String(value||'').trim().toLocaleLowerCase('pt-BR')===c.name.trim().toLocaleLowerCase('pt-BR');
 return m.class_id===c.id||m.class_slug===c.slug&&Boolean(c.slug)||sameName(m.class_name)||(Array.isArray(m.classes)&&m.classes.some(sameName));
}
function matchesGlossary(entry,kind,query,classId='',circle=''){return matchesGlossaryClass(entry,classId)&&(!kind||(kind==='cantrip'?isCantrip(entry):entry.kind===kind))&&(circle===''||spellLevel(entry)===Number(circle))&&(!query||[entry.name,entry.summary,entry.content,...(entry.metadata?.tags||[])].some(v=>String(v||'').toLowerCase().includes(query.toLowerCase())));}
function glossaryView(){
 const kinds={rule:'Regra',feature:'Característica',spell:'Magia',item:'Item',condition:'Condição',feat:'Talento',deity:'Divindade',attribute:'Atributo'};
 $('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">REGRAS À MÃO</div><h1>Glossário</h1><p>Consulte regras e conceitos sem sair da ficha.</p></div><span class="badge">${state.rules.length} entradas</span></div><div class="toolbar glossary-tools"><input id="glossary-search" type="search" placeholder="Buscar regra, magia, item…" aria-label="Buscar no glossário"><select id="glossary-kind" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option><option value="cantrip">Truques</option>${Object.entries(kinds).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select><select id="glossary-circle" aria-label="Filtrar por círculo" hidden><option value="">Todos os círculos</option><option value="0">Truques</option>${Array.from({length:9},(_,i)=>`<option value="${i+1}">${i+1}º círculo</option>`).join('')}</select><select id="glossary-class" aria-label="Filtrar por classe"><option value="">Todas as classes</option>${availableClasses().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div><div id="glossary-results"></div><p class="note">O catálogo combina referências da planilha D&D 2024 fornecida pelo usuário e material do System Reference Document 5.2.1 da Wizards of the Coast LLC (CC-BY-4.0). Consulte a origem e a licença em cada entrada.</p>`;
 const draw=()=>{
  const q=$('#glossary-search').value.trim().toLowerCase(),kind=$('#glossary-kind').value,classId=$('#glossary-class').value,circle=$('#glossary-circle').value;
  const list=state.rules.filter(r=>matchesGlossary(r,kind,q,classId,circle));
  if(kind==='spell'||kind==='cantrip')list.sort((a,b)=>(spellLevel(a)??99)-(spellLevel(b)??99)||a.name.localeCompare(b.name,'pt-BR'));
  const cards=list.map(r=>{const source=r.source_url?`<a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(r.source_name||'Ver fonte')} ↗</a>`:esc(r.source_name||'Fonte não informada');return `<article class="panel glossary-entry"><span class="badge">${esc(kinds[r.kind]||r.kind)}</span>${isCantrip(r)?' <span class="badge">Truques</span>':''}<h3>${esc(r.name)}</h3><p>${esc(r.summary)}</p><details><summary>Ler regra</summary><p style="white-space:pre-line">${esc(r.content)}</p><p class="note">${source}${r.source_page?' · '+esc(r.source_page):''}<br>${esc(r.license||'Licença não informada')}${r.metadata?.needs_review?'<br>Texto da fonte sinalizado para revisão.':''}</p></details></article>`}).join('');
  $('#glossary-results').innerHTML=list.length?`<div class="glossary-grid">${cards}</div>`:'<div class="empty"><h2>Nenhuma entrada encontrada</h2><p>Tente outro termo ou categoria.</p></div>';
 };
 $('#glossary-search').oninput=draw;$('#glossary-kind').onchange=()=>{const spell=$('#glossary-kind').value==='spell';$('#glossary-circle').hidden=!spell;if(!spell)$('#glossary-circle').value='';draw();};$('#glossary-circle').onchange=draw;$('#glossary-class').onchange=draw;draw();
}
function classSelect(){
 const s=state.sheet,c=findClass(s,state.classes),review=classReviewState(s,state.classes);
 const locked=state.characterClasses.some(x=>x.sheet_id===s.id)||['pending','approved'].includes(review)||state.levelUps.some(x=>x.sheet_id===s.id&&x.status==='pending');
 return `<label>Classe<select data-field="class" ${locked?'disabled':''}><option value="">Selecione uma classe</option>${!c&&s.data.class?`<option selected value="${esc(s.data.class)}">${esc(s.data.class)} — ${review==='approved'?'aprovada pelo mestre':'aguardando mestre'}</option>`:''}${availableClasses().map(x=>`<option value="${esc(x.name)}" ${c?.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select>${locked?'<small>Classe protegida durante a progressão ou avaliação.</small>':''}</label>${['pending','approved'].includes(review)?`<div class="field-wide"><p class="note">${review==='approved'?'Classe personalizada aprovada. Características e level-up dependem de um catálogo de progressão.':'Nome não reconhecido. O mestre precisa manter este nome ou corrigir para uma classe cadastrada.'}</p>${gm()?`<button type="button" data-review-class="${s.id}">Avaliar classe</button>`:''}</div>`:''}`;
}
function classReviewQueue(){
 if(!gm())return '';
 const pending=sheets().filter(s=>!s.archived&&classReviewState(s,state.classes)==='pending');
 return pending.length?`<section class="panel"><h3>Classes aguardando avaliação</h3>${pending.map(s=>`<div class="row"><div><b>${esc(s.name)}</b><p>${esc(s.data.class)}</p></div><button data-review-class="${s.id}">Avaliar classe</button></div>`).join('')}</section>`:'';
}
function bindClassReviews(){document.querySelectorAll('[data-review-class]').forEach(b=>b.onclick=async()=>{if(await leave())reviewClass(b.dataset.reviewClass)});}
function reviewClass(id){
 if(!gm())return;
 const s=state.sheets.find(x=>x.id===id),linked=state.characterClasses.filter(x=>x.sheet_id===id),primary=linked.find(x=>x.is_primary);
 if(!s)return;
 const choices=availableClasses(s.table_id).filter(c=>!linked.length||c.id===primary?.class_id);
 modal('Avaliar classe',`<p>${esc(s.name)}: <b>${esc(s.data.class)}</b></p><label>Decisão<select name="decision"><option value="keep">Manter nome como correto (classe personalizada)</option><option value="map">Corrigir para classe cadastrada</option></select></label><label>Classe correta<select name="class_id"><option value="">Selecione</option>${choices.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><p class="note">Manter o nome não cria regras de progressão. Com histórico existente, a correção deve corresponder à classe principal vinculada.</p>`,async f=>{
  const data=structuredClone(s.data),decision=f.get('decision');
  if(decision==='map'){const c=choices.find(x=>x.id===f.get('class_id'));if(!c)throw Error('Selecione a classe correta.');data.class=c.name;}
  data.class_review={decision,name:data.class,original_name:s.data.class};
  const fresh=await result(db.from('dnd_sheets').update({data}).eq('id',s.id).eq('version',s.version).select().maybeSingle());
  if(!fresh)throw Error('A ficha mudou. Recarregue antes de avaliar.');
  if(state.sheet?.id===id)state.sheet=fresh;
  toast(decision==='keep'?'Nome aprovado pelo mestre.':'Classe corrigida.');
 });
 const form=$('#dialog form'),decision=form.querySelector('[name=decision]'),choice=form.querySelector('[name=class_id]');
 const refresh=()=>{choice.disabled=decision.value!=='map';choice.required=decision.value==='map';};decision.onchange=refresh;refresh();
}
function featureRows(classId,subclassId,level){
 const entries=levelFeatures(state.rules,classId,subclassId,level);
 return entries.length?entries.map(e=>`<div class="progress-feature"><p><b>${e.subclass?'Subclasse: ':''}${esc(e.names)}</b></p>${e.resources?`<p class="note">Recursos: ${esc(e.resources)}</p>`:''}</div>`).join(''):'<p class="note">Nenhum ganho cadastrado para este nível.</p>';
}
function characteristicsView(){
 const s=state.sheet,progress=characterProgression(s,state.classes,state.characterClasses,state.subclasses),review=classReviewState(s,state.classes);
 if(review!=='known')return `<section class="panel"><h3>Características</h3><p>${review==='approved'?'Classe personalizada aprovada, ainda sem características cadastradas.':review==='pending'?'A classe precisa de avaliação do mestre antes de exibir a progressão.':'Selecione uma classe na aba Personagem.'}</p>${review!=='empty'?classSelect():''}</section>`;
 const pending=state.levelUps.filter(l=>l.sheet_id===s.id&&l.status==='pending');
 return `<section class="panel"><h3>Características</h3><p>Níveis, nomes e recursos da sua classe. Explicações detalhadas virão no futuro Oráculo.</p><p class="note">Recursos são os valores de referência de cada nível, não valores para somar. A prévia não aplica alterações na ficha.</p></section>${pending.map(l=>`<section class="panel pending-preview"><h3>Aguardando aprovação do mestre</h3><p>${esc(availableClasses().find(c=>c.id===l.class_id)?.name)} · nível ${l.to_class_level}. Estes ganhos ainda não foram adquiridos.</p>${featureRows(l.class_id,l.subclass_id,l.to_class_level)}</section>`).join('')}${progress.map(c=>{
  const sub=state.subclasses.find(x=>x.id===c.subclass_id);
  const levels=state.classLevels.filter(l=>l.class_id===c.class_id).sort((a,b)=>a.level-b.level);
  const acquired=levels.filter(l=>l.level<=c.class_level),future=levels.filter(l=>l.level>c.class_level+1);
  const renderLevel=l=>`<article class="progress-level"><h4>Nível ${l.level}</h4>${featureRows(c.class_id,c.subclass_id,l.level)}</article>`;
  return `<section class="panel"><h3>${esc(c.catalog.name)} · nível ${c.class_level}${sub?' · '+esc(sub.name):''}</h3>${!sub?`<p class="note">Subclasse escolhida pelo level-up a partir do nível ${c.catalog.subclass_level}. Nenhuma característica de subclasse é atribuída antes da escolha.</p>`:''}<h4>Adquiridas</h4>${acquired.map(renderLevel).join('')||'<p>Nenhuma progressão cadastrada.</p>'}${c.class_level<20?`<h4>Próximo nível — prévia</h4>${renderLevel({level:c.class_level+1})}`:'<p>Nível máximo desta classe atingido.</p>'}${future.length?`<details><summary>Progressão futura · ainda não adquirida</summary>${future.map(renderLevel).join('')}</details>`:''}</section>`;
 }).join('')}`;
}
function policyLabel(v){return {player_free:'Livre pelo jogador',player_request:'Solicitada e aprovada pelo mestre',gm_only:'Exclusiva do mestre'}[v]||v}
const currencySetting=(tableId=state.table)=>state.settings.find(s=>s.table_id===tableId);
const walletFor=sheetId=>state.wallets.find(w=>w.sheet_id===sheetId)||{sheet_id:sheetId,cp:0,sp:0,gp:0,gold_progress:0};
function currencyProgressCard(sheet,compact=false){
 if(!currencySetting(sheet.table_id)?.gold_xp_enabled||sheet.secret||sheet.archived||sheet.kind!=='personagem')return '';
 const wallet=walletFor(sheet.id),progress=currencyProgress(wallet,sheet.data.level),message=progress.goal===0?'Nível máximo alcançado.':progress.ready?'Ouro necessário alcançado — conclua a subida de nível.':`Faltam ${progress.remaining} PO para o nível ${Number(sheet.data.level||1)+1}.`;
 return `<section class="currency-progress ${compact?'compact':''}" aria-label="Progresso por ouro de ${esc(sheet.name)}"><div class="currency-progress-head"><div><span class="coin-mark" aria-hidden="true">PO</span><span><small>PROGRESSO POR OURO</small><b>${progress.current} / ${progress.goal} PO</b></span></div>${compact?`<span class="currency-level">Nível ${esc(sheet.data.level||1)}</span>`:''}</div><div class="currency-bar" role="progressbar" aria-label="Ouro para o próximo nível" aria-valuemin="0" aria-valuemax="${progress.goal}" aria-valuenow="${progress.current}" aria-valuetext="${esc(message)}"><i style="width:${progress.percent}%"></i></div><p class="${progress.ready?'ready':''}">${esc(message)}</p>${compact?`<div class="currency-balances"><span>${wallet.cp} PC</span><span>${wallet.sp} PP</span><span>${wallet.gp} PO</span></div>`:''}</section>`;
}
function currencyPartyProgress(){const list=sheets().filter(s=>!s.secret&&!s.archived&&s.kind==='personagem');return `<section class="panel currency-party"><div class="section-title"><div><span class="badge">OURO COMO XP</span><h2>Progresso do grupo</h2></div>${gm()?'<button id="distribute-currency" class="primary">＋ Nova distribuição</button>':''}</div><div class="currency-grid">${list.map(s=>`<article><h3>${esc(s.name)}</h3>${currencyProgressCard(s,true)}</article>`).join('')||'<p>Nenhum personagem ativo nesta mesa.</p>'}</div></section>`}
function currencySetup(setting){
 if(setting?.gold_xp_enabled)return currencyPartyProgress();
 if(!gm())return '';
 return `<section class="panel currency-setup"><span class="badge">REGRA OPCIONAL DA MESA</span><h3>Moedas do mestre e ouro como progressão</h3><p>Quando ativada, somente o mestre distribui PC, PP e PO. O ouro recebido libera o fluxo normal de level-up.</p><button id="enable-gold-xp">Ativar nesta mesa</button></section>`;
}
function currencyModalSnapshot(){
 const totals={cp:Number($('#currency-total-cp').value),sp:Number($('#currency-total-sp').value),gp:Number($('#currency-total-gp').value)},allocations=[];
 document.querySelectorAll('[data-currency-sheet]').forEach(row=>{if(!row.querySelector('[name=currency-recipient]').checked)return;allocations.push({sheet_id:row.dataset.currencySheet,cp:Number(row.querySelector('[data-coin=cp]').value),sp:Number(row.querySelector('[data-coin=sp]').value),gp:Number(row.querySelector('[data-coin=gp]').value)})});
 return {totals,allocations};
}
function refreshCurrencyModal(){
 const snapshot=currencyModalSnapshot(),sums={cp:0,sp:0,gp:0};snapshot.allocations.forEach(row=>Object.keys(sums).forEach(coin=>sums[coin]+=Number(row[coin])||0));
 const remaining=Object.fromEntries(Object.keys(sums).map(coin=>[coin,(Number(snapshot.totals[coin])||0)-sums[coin]]));
 $('#currency-remaining').innerHTML=`Restante: <b>${remaining.cp} PC · ${remaining.sp} PP · ${remaining.gp} PO</b>`;
}
function openCurrencyDistribution(){
 if(!gm()||!currencySetting()?.gold_xp_enabled)return;
 const characters=sheets().filter(s=>!s.secret&&!s.archived&&s.kind==='personagem');
 modal('Distribuir tesouro',`<p class="note">Informe o total encontrado e decida quanto cada personagem recebe.</p><div class="grid three currency-totals"><label>Total PC<input id="currency-total-cp" name="total_cp" type="number" min="0" step="1" value="0" required></label><label>Total PP<input id="currency-total-sp" name="total_sp" type="number" min="0" step="1" value="0" required></label><label>Total PO<input id="currency-total-gp" name="total_gp" type="number" min="0" step="1" value="0" required></label></div><label>Origem do tesouro <input name="reason" maxlength="300" placeholder="Ex.: Baú da torre"></label><div class="currency-distribution-head"><b>Personagem</b><span>PC</span><span>PP</span><span>PO</span></div><div class="currency-distribution">${characters.map(s=>`<div data-currency-sheet="${s.id}"><label><input type="checkbox" name="currency-recipient" value="${s.id}"> ${esc(s.name)}</label>${['cp','sp','gp'].map(coin=>`<input data-coin="${coin}" type="number" min="0" step="1" value="0" disabled aria-label="${coin.toUpperCase()} para ${esc(s.name)}">`).join('')}</div>`).join('')}</div><p id="currency-remaining" class="currency-remaining" aria-live="polite">Restante: <b>0 PC · 0 PP · 0 PO</b></p><button type="button" id="split-currency-equally">Dividir igualmente entre selecionados</button>`,async f=>{
  const clean=validateCurrencyDistribution(currencyModalSnapshot().totals,currencyModalSnapshot().allocations);
  await result(db.rpc('dnd_distribute_currency',{p_table_id:state.table,p_total_cp:clean.totals.cp,p_total_sp:clean.totals.sp,p_total_gp:clean.totals.gp,p_allocations:clean.allocations,p_idempotency_key:crypto.randomUUID(),p_reason:f.get('reason')||''}));
  toast('Tesouro distribuído. Os jogadores receberam as moedas.');
 });
 document.querySelectorAll('[data-currency-sheet]').forEach(row=>{const check=row.querySelector('[name=currency-recipient]');check.onchange=()=>{row.querySelectorAll('[data-coin]').forEach(input=>{input.disabled=!check.checked;if(!check.checked)input.value='0'});refreshCurrencyModal()};row.querySelectorAll('[data-coin]').forEach(input=>input.oninput=refreshCurrencyModal)});
 document.querySelectorAll('.currency-totals input').forEach(input=>input.oninput=refreshCurrencyModal);
 $('#split-currency-equally').onclick=()=>{const selected=[...document.querySelectorAll('[data-currency-sheet]')].filter(row=>row.querySelector('[name=currency-recipient]').checked);if(!selected.length)return fail(Error('Selecione pelo menos um personagem.'));for(const coin of ['cp','sp','gp']){const total=Number($(`#currency-total-${coin}`).value)||0,base=Math.floor(total/selected.length);selected.forEach((row,index)=>row.querySelector(`[data-coin=${coin}]`).value=String(base+(index===0?total-base*selected.length:0)))}refreshCurrencyModal()};
}
function progressView(){
 const setting=currencySetting(),list=state.levelUps.filter(l=>l.table_id===state.table),pending=list.filter(l=>l.status==='pending');
 $('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">JORNADA DOS PERSONAGENS</div><h1>Progressão</h1><p>Acompanhe solicitações, ouro e o histórico de level-up da mesa.</p></div></div>${gm()?`<section class="panel"><h3>Política de level-up</h3><p>Defina quem pode iniciar e aplicar uma subida de nível.</p><div class="policy-grid">${[['player_free','Livre pelo jogador','O jogador escolhe os dados e aplica imediatamente.'],['player_request','Com aprovação','O mestre revisa cada solicitação antes de aplicar.'],['gm_only','Somente o mestre','Jogadores não podem iniciar a progressão.']].map(([v,n,d])=>`<label class="policy-card ${setting?.level_up_policy===v?'selected':''}"><input type="radio" name="policy" value="${v}" ${setting?.level_up_policy===v?'checked':''}><b>${n}</b><small>${d}</small></label>`).join('')}</div></section>`:`<section class="panel"><span class="badge">POLÍTICA DA MESA</span><h3>${esc(policyLabel(setting?.level_up_policy))}</h3></section>`}${currencySetup(setting)}${gm()&&pending.length?`<section class="panel"><h3>Solicitações pendentes</h3>${pending.map(levelUpRow).join('')}</section>`:''}${classReviewQueue()}<section class="panel"><h3>Histórico de level-up</h3>${list.filter(l=>l.status!=='pending').map(levelUpRow).join('')||'<p>Nenhum level-up registrado ainda.</p>'}</section>`;
 bindClassReviews();document.querySelectorAll('[name=policy]').forEach(el=>el.onchange=async()=>{try{await result(db.from('dnd_table_settings').update({level_up_policy:el.value,updated_at:new Date().toISOString()}).eq('table_id',state.table));await load();progressView();toast('Política de level-up atualizada.')}catch(err){fail(err)}});document.querySelectorAll('[data-approve]').forEach(b=>b.onclick=()=>decideLevelUp(b.dataset.approve,true));document.querySelectorAll('[data-reject]').forEach(b=>b.onclick=()=>decideLevelUp(b.dataset.reject,false));if($('#distribute-currency'))$('#distribute-currency').onclick=openCurrencyDistribution;if($('#enable-gold-xp'))$('#enable-gold-xp').onclick=()=>modal('Ativar moedas do mestre?',`<p>Os saldos atuais de PC, PP e PO serão preservados. Depois disso, somente distribuições do mestre poderão alterá-los, e PO passará a liberar o level-up.</p><p class="note">A regra não pode ser desativada pela interface para evitar divergência entre os saldos.</p>`,async()=>{await result(db.from('dnd_table_settings').update({gold_xp_enabled:true,updated_at:new Date().toISOString()}).eq('table_id',state.table));toast('Moedas do mestre e progressão por ouro ativadas.')});
}
function levelUpRow(l){const s=state.sheets.find(x=>x.id===l.sheet_id),c=availableClasses().find(x=>x.id===l.class_id),gains=Array.isArray(l.gains)?l.gains:[];return `<div class="row"><div><b>${esc(s?.name||'Ficha')} · ${esc(c?.name||'Classe')} ${l.to_class_level}</b><p>Nível ${l.from_total_level} → ${l.to_total_level} · +${l.hp_gain} PV · ${new Date(l.created_at).toLocaleString('pt-BR')}</p>${gains.length?`<details class="gain-list"><summary>Ver ganhos</summary><ul>${gains.map(g=>`<li><b>${esc(g.name)}</b>: ${esc(g.summary||g.quantity||'Adquirido')}</li>`).join('')}</ul></details>`:''}<span class="status-pill ${l.status}">${{applied:'Aplicado',pending:'Aguardando mestre',rejected:'Rejeitado',cancelled:'Cancelado'}[l.status]||l.status}</span></div>${gm()&&l.status==='pending'?`<div class="actions"><button data-reject="${l.id}" class="quiet danger">Rejeitar</button><button data-approve="${l.id}" class="primary">Aprovar</button></div>`:''}</div>`}
async function decideLevelUp(id,approve){try{await result(db.rpc('dnd_decide_level_up',{p_level_up_id:id,p_approve:approve}));await load();progressView();toast(approve?'Level-up aprovado e aplicado.':'Solicitação rejeitada.')}catch(err){fail(err)}}
function field(key,label,type='text',def='',attrs=''){const v=state.sheet.data[key]??def;return `<label>${label}<input data-field="${key}" type="${type}" value="${esc(v)}" ${attrs}></label>`}
function currencyFields(){
 if(!currencySetting(state.sheet.table_id)?.gold_xp_enabled)return [['cp','Cobre (PC)'],['sp','Prata (PP)'],['ep','Electro (PE)'],['gp','Ouro (PO)'],['pp','Platina (PL)']].map(([k,l])=>field(k,l,'number',0,'min="0"')).join('');
 const wallet=walletFor(state.sheet.id);
 return `<label>Cobre (PC)<input value="${wallet.cp}" readonly></label><label>Prata (PP)<input value="${wallet.sp}" readonly></label>${field('ep','Electro (PE)','number',0,'min="0"')}<label>Ouro (PO)<input value="${wallet.gp}" readonly></label>${field('pp','Platina (PL)','number',0,'min="0"')}<p class="note field-wide">PC, PP e PO são distribuídos pelo mestre.</p>`;
}
function area(key,label){return `<label class="field-wide">${label}<textarea data-field="${key}">${esc(state.sheet.data[key]||'')}</textarea></label>`}
function check(key,label){return `<label class="checkline"><input data-field="${key}" type="checkbox" ${state.sheet.data[key]?'checked':''}>${label}</label>`}
function conditionPicker(){const selected=new Set(activeConditions(state.sheet,state.rules).map(x=>x.slug)),conditions=catalogConditions(state.rules);return `<fieldset class="condition-picker"><legend>Condições ativas</legend><p class="note">Marque os efeitos que estão afetando o personagem agora.</p><div class="condition-options">${conditions.map(c=>{const visual=conditionVisual(c.slug);return `<label class="condition-option" data-tone="${visual.tone}"><input type="checkbox" data-condition="${esc(c.slug)}" ${selected.has(c.slug)?'checked':''}><span class="condition-icon" aria-hidden="true">${visual.icon}</span><span><b>${esc(c.name)}</b><small>${esc(c.summary||'Condição do glossário')}</small></span></label>`}).join('')}</div>${conditions.length?'':'<p class="note">Nenhuma condição cadastrada no glossário.</p>'}</fieldset>`}
function conditionIndicators(sheet=state.sheet){const active=activeConditions(sheet,state.rules);return active.length?`<div class="condition-alert" role="status" aria-label="Condições ativas"><div><small>Condições ativas</small><div class="condition-badges">${active.map(c=>{const visual=conditionVisual(c.slug);return `<span data-tone="${visual.tone}"><i class="condition-icon" aria-hidden="true">${visual.icon}</i>${esc(c.name)}</span>`}).join('')}</div></div></div>`:''}
function editor(){const s=state.sheet;const setting=state.settings.find(x=>x.table_id===s.table_id);const canLevel=!s.secret&&!s.archived&&(gm()||setting?.level_up_policy!=='gm_only'),portrait=portraitAsset(s.id),conditioned=activeConditions(s,state.rules).length>0;$('#content').innerHTML=`<div class="heading sheet-heading ${conditioned?'has-conditions':''}"><div class="sheet-title">${portrait?`<div class="avatar large"><img data-media="${portrait.id}" alt="Retrato de ${esc(s.name)}"></div>`:''}<div><div class="eyebrow">${s.secret?'◇ ARQUIVO SECRETO DO MESTRE':'FICHA DE PERSONAGEM'}${s.archived?' · ARQUIVADA':''}</div><h1>${esc(s.name)}</h1><p id="saved-at">Atualizada ${new Date(s.updated_at).toLocaleString('pt-BR')}</p>${conditionIndicators(s)}</div></div><div class="actions"><button id="back">← Voltar</button><button id="portrait">${portrait?'Trocar retrato':'Adicionar retrato'}</button>${portrait?'<button id="remove-portrait" class="quiet danger">Remover retrato</button>':''}${canLevel?'<button id="level-up" class="level-up">↑ Subir de nível</button>':''}${gm()?'<button id="access">Gerenciar ficha</button>':''}<button id="print">Imprimir</button></div></div><div id="boss-sheet-controls">${bossControls(s)}</div><div id="session-summary">${sessionSummary()}</div>${currencyProgressCard(s)}<div class="toolbar sheet-toolbar"><div class="tabs" aria-label="Seções da ficha">${[['combate','Em jogo'],['principal','Identidade'],['caracteristicas','Características'],['pericias','Perícias'],['magias','Magias'],['historia','História e inventário']].map(([k,l])=>`<button data-tab="${k}" aria-pressed="${state.tab===k}" class="${state.tab===k?'active':''}">${l}</button>`).join('')}</div><span class="badge">D&D · 2024</span></div><div id="fields"></div><div class="savebar"><span id="save-status" role="status" aria-live="polite">${state.dirty?'Alterações pendentes':'✓ Todas as alterações salvas'}</span><div class="actions"><button id="reload" class="quiet">Recarregar</button><button id="save" class="primary">Salvar agora</button></div></div>`;
 $('#fields').innerHTML=fields();bindHpControls();bindSpellSlots();bindBossControls();if(gm()&&$('#access')){$('#access').insertAdjacentHTML('beforebegin','<button id="gm-notebook" class="notebook-button" title="Caderno do mestre">▤ Caderno</button>');$('#gm-notebook').onclick=()=>openGmNotebook(s)}bindClassReviews();document.querySelectorAll('[data-condition]').forEach(el=>el.onchange=()=>{try{updateActiveCondition(state.sheet.data,el.dataset.condition,el.checked,state.rules);state.dirty=true;clearTimeout(timer);editor();timer=setTimeout(save,600)}catch(err){fail(err)}});document.querySelectorAll('[data-field]').forEach(el=>el.onchange=()=>{const key=el.dataset.field;const v=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;if(el.type==='number'&&!el.checkValidity()){el.reportValidity();return;}if(key==='name')state.sheet.name=v;else state.sheet.data[key]=v;state.dirty=true;if(key.startsWith('slots_')){editor();$('#save-status').textContent='Alterações pendentes…';clearTimeout(timer);timer=setTimeout(save,600);return;}$('#save-status').textContent='Alterações pendentes…';refreshSessionSummary();if(abilities.some(a=>a[0]===key)){el.closest('.ability').querySelector('output').textContent=signed(mod(v));}if(el.tagName==='SELECT'&&el.closest('.skill')){const ability=key.startsWith('save_')?key.slice(5):skills[Number(key.slice(6))][1];el.closest('.skill').querySelector('b').textContent=signed(mod(state.sheet.data[ability])+Number(v)*proficiencyBonus(state.sheet.data.level));}clearTimeout(timer);timer=setTimeout(async()=>{await save();if(key==='class'&&!state.dirty)editor();},600)});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;editor()});$('#back').onclick=async()=>{if(await leave()){state.sheet=null;render();focusWorkspace()}};$('#save').onclick=save;$('#reload').onclick=()=>modal('Recarregar a ficha?','<p>As alterações locais ainda não salvas serão descartadas e a versão mais recente será carregada.</p>',async()=>{clearTimeout(timer);const fresh=await result(db.from('dnd_sheets').select('*').eq('id',s.id).single());state.sheet=fresh;state.dirty=false;state.conflict=false});$('#print').onclick=printSheet;$('#portrait').onclick=()=>chooseMedia('portrait',s.id);if($('#remove-portrait'))$('#remove-portrait').onclick=()=>removePortrait(s.id);if($('#level-up'))$('#level-up').onclick=async()=>{if(await leave())openLevelUp()};if($('#access'))$('#access').onclick=async()=>{if(!await leave())return;manageSheet()};hydrateMedia();
}

function portraitAsset(sheetId){const p=state.portraits.find(x=>x.sheet_id===sheetId);return state.assets.find(x=>x.id===p?.asset_id)}
function currentPresentation(){return state.presentations.find(x=>x.table_id===state.table)}
async function signedUrl(asset){if(!asset)return null;const cached=mediaUrls.get(asset.id);if(cached&&cached.expires>Date.now())return cached.url;const data=await result(db.storage.from(asset.bucket_id).createSignedUrl(asset.object_path,900));mediaUrls.set(asset.id,{url:data.signedUrl,expires:Date.now()+840000});return data.signedUrl}
async function hydrateMedia(root=document){await Promise.all([...root.querySelectorAll('img[data-media]')].map(async img=>{const a=state.assets.find(x=>x.id===img.dataset.media);if(a)try{img.src=await signedUrl(a)}catch(err){img.alt='Imagem indisponível';console.error(err)}}))}
function chooseMedia(kind,sheetId=null){const d=$('#dialog'),limit=MEDIA[kind].max/1024/1024,types=kind==='portrait'?'JPEG, PNG ou WebP':'JPEG, PNG, WebP ou GIF',accept=kind==='portrait'?'image/jpeg,image/png,image/webp':'image/jpeg,image/png,image/webp,image/gif';d.innerHTML=`<form><h2>${kind==='portrait'?'Retrato do personagem':kind==='map'?'Mapa da mesa':'Apresentar cutscene'}</h2><label>Imagem ${types} · até ${limit} MB<input name="image" type="file" accept="${accept}" required></label><img id="media-preview" class="media-preview" alt="Prévia" hidden><p id="upload-status" class="note">A imagem anterior será mantida se o envio falhar.</p><p class="error" id="modal-error" role="alert"></p><div class="actions"><button type="button" id="cancel">Cancelar</button><button class="primary">Enviar</button></div></form>`;$('#cancel').onclick=()=>d.close();const input=d.querySelector('[name=image]');input.onchange=()=>{const f=input.files[0];if(!f)return;try{validateMedia(f,kind);const p=$('#media-preview');p.src=URL.createObjectURL(f);p.hidden=false;$('#upload-status').textContent=`${f.type} · ${(f.size/1024/1024).toFixed(1)} MB`}catch(err){input.value='';$('#modal-error').textContent=err.message}};d.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('.primary');b.disabled=true;$('#upload-status').textContent='Enviando imagem…';try{await uploadMedia(input.files[0],kind,sheetId);d.close();await load();render();toast(kind==='portrait'?'Retrato atualizado.':kind==='map'?'Mapa atualizado.':'Cutscene apresentada para a mesa.')}catch(err){$('#modal-error').textContent=domainMessage(err)}finally{b.disabled=false}};d.showModal()}
async function uploadMedia(file,kind,sheetId){const ext=validateMedia(file,kind),dimensions=await imageDimensions(file),id=crypto.randomUUID(),path=mediaPath(kind,state.table,sheetId,id,ext),bucket=MEDIA[kind].bucket;await result(db.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false}));try{await result(db.from('dnd_media_assets').insert({id,table_id:state.table,sheet_id:sheetId,kind,bucket_id:bucket,object_path:path,mime_type:file.type,byte_size:file.size,...dimensions}));if(kind==='portrait'){const rev=state.portraits.find(x=>x.sheet_id===sheetId)?.revision||0;await result(db.rpc('set_sheet_portrait',{p_sheet_id:sheetId,p_asset_id:id,p_expected_revision:rev}))}else if(kind==='map'){await result(db.rpc('set_table_map',{p_table_id:state.table,p_asset_id:id,p_expected_revision:currentPresentation()?.map_revision||0}))}else{await signedUrl({id,bucket_id:bucket,object_path:path});await result(db.rpc('present_cutscene',{p_table_id:state.table,p_asset_id:id}))}}catch(err){await db.storage.from(bucket).remove([path]);throw err}}
function domainMessage(err){return {not_authorized:'Você não tem permissão para esta ação.',asset_not_found:'A imagem não foi encontrada.',asset_scope_mismatch:'A imagem não pertence a esta mesa ou ficha.',history_not_found:'Esta entrada não está mais disponível.',revision_conflict:'A imagem mudou em outra tela. Recarregue e tente novamente.'}[err?.message]||err?.message||'Não foi possível concluir.'}
async function removePortrait(sheetId){try{const rev=state.portraits.find(x=>x.sheet_id===sheetId)?.revision||0;await result(db.rpc('set_sheet_portrait',{p_sheet_id:sheetId,p_asset_id:null,p_expected_revision:rev}));await load();render();toast('Retrato removido.')}catch(err){fail(Error(domainMessage(err)))}}
function mediaView(){
 const p=currentPresentation(),map=state.assets.find(x=>x.id===p?.map_asset_id),historyMode=state.mediaMode==='history';
 $('#content').innerHTML=`<div class="heading"><div><div class="eyebrow">${historyMode?'MEMÓRIAS DA MESA':'VISÃO COMPARTILHADA'}</div><h1>${historyMode?'Histórico de cutscenes':'Mapa da mesa'}</h1><p>${historyMode?'Reveja cenas salvas sem alterar a apresentação dos outros jogadores.':'O último mapa salvo permanece disponível mesmo durante uma reconexão.'}</p></div><div class="actions media-modes"><button id="live-mode" class="${historyMode?'':'primary'}">Mapa atual</button><button id="history-mode" class="${historyMode?'primary':''}">Histórico</button>${!historyMode&&gm()?`<button id="upload-map">${map?'Trocar mapa':'Adicionar mapa'}</button>${map?'<button id="remove-map" class="quiet danger">Remover mapa</button>':''}<button id="present-scene" class="primary">Apresentar cutscene</button>${p?.cutscene_active?'<button id="save-scene-history">Salvar no histórico</button><button id="end-scene">Encerrar cutscene</button>':''}`:''}</div></div>${historyMode?historyGallery():map?`<section class="panel map-panel"><div class="map-toolbar"><button id="zoom-out">−</button><span id="zoom-label">100%</span><button id="zoom-in">＋</button><button id="fullscreen">Tela cheia</button></div><div class="map-stage" id="map-stage"><img data-media="${map.id}" alt="Mapa atual da mesa"></div></section>`:'<div class="empty"><div class="sigil">⌖</div><h2>Nenhum mapa publicado</h2><p>'+ (gm()?'Adicione uma imagem para compartilhar o cenário com os jogadores.':'O mestre ainda não publicou o mapa desta mesa.')+'</p></div>'}`;
 if($('#live-mode'))$('#live-mode').onclick=()=>{state.mediaMode='live';state.historyError='';mediaView()};
 if($('#history-mode'))$('#history-mode').onclick=()=>{state.mediaMode='history';mediaView();void refreshSceneHistory()};
 if($('#upload-map'))$('#upload-map').onclick=()=>chooseMedia('map');if($('#present-scene'))$('#present-scene').onclick=()=>chooseMedia('cutscene');if($('#remove-map'))$('#remove-map').onclick=()=>setMapNull();if($('#end-scene'))$('#end-scene').onclick=endCutscene;if($('#save-scene-history'))$('#save-scene-history').onclick=saveCurrentCutscene;
 bindHistoryGallery();
 let zoom=1;const apply=()=>{const img=$('#map-stage img');if(img)img.style.transform=`scale(${zoom})`;$('#zoom-label').textContent=Math.round(zoom*100)+'%'};if($('#zoom-in'))$('#zoom-in').onclick=()=>{zoom=Math.min(3,zoom+.25);apply()};if($('#zoom-out'))$('#zoom-out').onclick=()=>{zoom=Math.max(.5,zoom-.25);apply()};if($('#fullscreen'))$('#fullscreen').onclick=()=>$('#map-stage').requestFullscreen();hydrateMedia();
}
function historyGallery(){
 const entries=sceneHistoryForTable(state.sceneHistory,state.table);
 if(state.historyLoading&&!entries.length)return '<div class="empty"><div class="sigil">✧</div><h2>Carregando histórico…</h2></div>';
 const error=`<p id="history-error" class="error history-error" role="alert" ${state.historyError?'':'hidden'}>${esc(state.historyError)}</p>`;
 if(!entries.length)return `${error}<div class="empty"><div class="sigil">✧</div><h2>Nenhuma cutscene no histórico</h2><p>${gm()?'Apresente uma cutscene e escolha “Salvar no histórico”.':'O mestre ainda não salvou nenhuma cena.'}</p></div>`;
 return `${error}<div class="scene-history-grid">${entries.map(entry=>`<article class="scene-history-card"><button class="scene-history-preview" data-history-open="${entry.id}" aria-label="Rever ${esc(entry.title||'cutscene')}"><img data-media="${entry.asset_id}" alt="${esc(entry.title||'Cutscene salva')}"></button><div class="scene-history-body">${gm()?`<label>Título opcional<input data-history-title="${entry.id}" value="${esc(entry.title||'')}" maxlength="160"></label><div class="actions"><button data-history-rename="${entry.id}">Salvar título</button><button class="quiet danger" data-history-remove="${entry.id}">Remover</button></div>`:`${entry.title?`<h3>${esc(entry.title)}</h3>`:''}`}<small>Salva em ${new Date(entry.created_at).toLocaleString('pt-BR')}</small></div></article>`).join('')}</div>`;
}
function bindHistoryGallery(){
 document.querySelectorAll('[data-history-open]').forEach(button=>button.onclick=()=>{const entry=sceneHistoryForTable(state.sceneHistory,state.table).find(item=>item.id===button.dataset.historyOpen);if(entry)openHistoryScene(entry)});
 document.querySelectorAll('[data-history-rename]').forEach(button=>button.onclick=()=>renameHistoryEntry(button.dataset.historyRename));
 document.querySelectorAll('[data-history-remove]').forEach(button=>button.onclick=()=>removeHistoryEntry(button.dataset.historyRemove));
}
function openHistoryScene(entry){
 document.querySelector('.history-replay')?.remove();
 const el=document.createElement('div');el.className='history-replay';el.dataset.history=entry.id;
 el.innerHTML=`<img data-media="${entry.asset_id}" alt="${esc(entry.title||'Cutscene salva')}"><div class="cutscene-actions"><button id="close-history">Fechar replay</button></div>`;
 document.body.append(el);$('#close-history').onclick=()=>el.remove();hydrateMedia(el);
}
async function saveCurrentCutscene(){
 const assetId=currentPresentation()?.cutscene_asset_id;if(!assetId)return;
 try{await result(db.rpc('save_cutscene_history',{p_table_id:state.table,p_asset_id:assetId}));state.historyError='';await refreshSceneHistory();toast('Cutscene salva no histórico.')}catch(err){state.historyError=domainMessage(err);fail(Error(state.historyError))}
}
async function renameHistoryEntry(id){
 const tableId=state.table,input=$(`[data-history-title="${id}"]`);
 try{await result(db.rpc('rename_cutscene_history',{p_history_id:id,p_title:input?.value||null}));state.historyError='';await refreshSceneHistory();toast('Título atualizado.')}catch(err){showHistoryError(domainMessage(err),tableId)}
}
async function removeHistoryEntry(id){
 const tableId=state.table;
 try{await result(db.rpc('remove_cutscene_history',{p_history_id:id}));state.historyError='';await refreshSceneHistory();toast('Cena removida do histórico.')}catch(err){showHistoryError(domainMessage(err),tableId)}
}
function showHistoryError(message,tableId){state.historyError=message;if(state.table!==tableId||state.view!=='mapa'||state.mediaMode!=='history')return;const error=$('#history-error');if(error){error.textContent=message;error.hidden=false}}
async function setMapNull(){try{await result(db.rpc('set_table_map',{p_table_id:state.table,p_asset_id:null,p_expected_revision:currentPresentation()?.map_revision||0}));await load();render();toast('Mapa removido.')}catch(err){fail(Error(domainMessage(err)))}}
async function endCutscene(){try{await result(db.rpc('dismiss_cutscene',{p_table_id:state.table}));await load();render();toast('Cutscene encerrada para todos.')}catch(err){fail(Error(domainMessage(err)))}}
async function refreshSceneHistory(){
 if(!state.user||!state.table)return;
 const user=state.user,tableId=state.table,request=historyRefreshGate.begin();
 state.historyLoading=true;
 try{
  const entries=await result(db.from('dnd_scene_history').select('*').eq('table_id',tableId).is('removed_at',null).order('created_at',{ascending:false}));
  const ids=entries.map(entry=>entry.asset_id);
  const assets=ids.length?await result(db.from('dnd_media_assets').select('*').in('id',ids).is('deleted_at',null)):[];
  if(state.user!==user||state.table!==tableId||!historyRefreshGate.isLatest(request))return;
  state.sceneHistory=state.sceneHistory.filter(entry=>entry.table_id!==tableId).concat(entries);
  state.assets=state.assets.filter(asset=>!ids.includes(asset.id)).concat(assets);
  state.historyError='';
 }catch(err){
  if(state.user===user&&state.table===tableId&&historyRefreshGate.isLatest(request))state.historyError='Não foi possível atualizar o histórico. Tente novamente.';
  console.error('Não foi possível sincronizar o histórico; tentando novamente.',err);
 }finally{
  if(state.user===user&&state.table===tableId&&historyRefreshGate.isLatest(request)){state.historyLoading=false;if(!state.sheet&&state.view==='mapa'&&state.mediaMode==='history')mediaView()}
 }
}
// Refresh media independently so remote scenes never replace unsaved sheet input.
async function refreshPresentation(){
 if(!state.user||!state.table)return;
 if(sceneRefreshRunning){sceneRefreshPending=true;return;}
 sceneRefreshRunning=true;
 const user=state.user,tableId=state.table;
 try{
  const presentation=await result(db.from('dnd_table_presentations').select('*').eq('table_id',tableId).maybeSingle());
  const ids=[presentation?.map_asset_id,presentation?.cutscene_asset_id].filter(Boolean);
  const assets=ids.length?await result(db.from('dnd_media_assets').select('*').in('id',ids).is('deleted_at',null)):[];
  if(state.user!==user||state.table!==tableId)return;
  const previous=currentPresentation();
  const mapChanged=previous?.map_asset_id!==presentation?.map_asset_id||previous?.map_revision!==presentation?.map_revision;
  const sceneChanged=previous?.cutscene_active!==presentation?.cutscene_active||previous?.cutscene_revision!==presentation?.cutscene_revision;
  state.presentations=state.presentations.filter(p=>p.table_id!==tableId);
  if(presentation)state.presentations.push(presentation);
  state.assets=state.assets.filter(a=>!ids.includes(a.id)).concat(assets);
  if(!state.sheet&&state.view==='mapa'&&(mapChanged||sceneChanged))mediaView();
  showCutscene();
 }catch(err){console.error('Não foi possível sincronizar a cena; tentando novamente.',err);}
 finally{sceneRefreshRunning=false;if(sceneRefreshPending){sceneRefreshPending=false;void refreshPresentation();}}
}
function showCutscene(){
 const current=document.querySelector('.cutscene'),p=currentPresentation();
 const key=p?`${p.table_id}:${p.cutscene_revision}`:null;
 if(!state.user||!p?.cutscene_active||state.dismissedCutscene===key){current?.remove();return;}
 const a=state.assets.find(x=>x.id===p.cutscene_asset_id);
 if(!a){current?.remove();return;}
 if(current?.dataset.scene===key)return;
 current?.remove();
 const el=document.createElement('div');el.className='cutscene';el.dataset.scene=key;
 el.innerHTML=`<img data-media="${a.id}" alt="Cutscene apresentada pelo mestre"><div class="cutscene-actions">${gm()?'<button id="save-overlay-history">Salvar no histórico</button>':''}<button id="close-local">${gm()?'Dispensar nesta tela':'Fechar para mim'}</button>${gm()?'<button id="close-global" class="primary">Encerrar para todos</button>':''}</div>`;
 document.body.append(el);
 $('#close-local').onclick=()=>{state.dismissedCutscene=key;el.remove()};
 if($('#close-global'))$('#close-global').onclick=endCutscene;
 if($('#save-overlay-history'))$('#save-overlay-history').onclick=saveCurrentCutscene;
 hydrateMedia(el);
}
async function openLevelUp(){
 const sheet=state.sheet,setting=state.settings.find(x=>x.table_id===sheet.table_id);
 if(setting?.gold_xp_enabled){const progress=currencyProgress(walletFor(sheet.id),sheet.data.level);if(!progress.ready){toast(`Ainda faltam ${progress.remaining} PO para liberar este level-up.`);return;}}
 const linked=state.characterClasses.filter(x=>x.sheet_id===sheet.id);
 const matching=findClass(sheet,state.classes);
 const review=classReviewState(sheet,state.classes);
 if(Number(sheet.data.level||1)>=20){toast('O personagem já está no nível máximo.');return;}
 if(review!=='known'){toast(review==='approved'?'Classe personalizada aprovada, mas ainda sem progressão cadastrada.':'Defina uma classe cadastrada ou aguarde a avaliação do mestre.');return;}
 // Persist the canonical name before the legacy RPC fallback compares names.
 if(sheet.data.class!==matching.name){sheet.data.class=matching.name;state.dirty=true;await save();if(state.dirty)return;}
 const available=availableClasses().filter(c=>linked.length?linked.some(l=>l.class_id===c.id):c.id===matching.id);
 const key=crypto.randomUUID();
 const level=c=>linked.find(x=>x.class_id===c.id)?.class_level??(c.id===matching?.id?Number(sheet.data.level||1):0);
 modal('Subir de nível',`<p>Nível total ${Number(sheet.data.level||1)} → ${Number(sheet.data.level||1)+1}</p>
 <label>Classe — nível atual → próximo<select name="class_id" required>${available.map(c=>`<option value="${c.id}" ${c.id===matching?.id?'selected':''}>${esc(classLevelLabel(c.name,level(c)))}</option>`).join('')}</select></label>
 <label id="subclass-label">Subclasse<select name="subclass_id"></select></label>
 <p id="subclass-note" class="note"></p>
 <label>Ganho de PV, incluindo Constituição<input name="hp_gain" type="number" min="1" max="100" required></label>
 <p class="note">${gm()||setting?.level_up_policy==='player_free'?'A confirmação aplica a progressão.':'A escolha será enviada para aprovação do mestre.'}</p>`,
 async f=>{
  const selectedClass=availableClasses().find(c=>c.id===f.get('class_id'));
  const retained=existingSubclass(sheet,selectedClass,linked.find(c=>c.class_id===selectedClass.id),state.subclasses,level(selectedClass));
  if(retained.unresolved)throw Error('A subclasse existente precisa de revisão do mestre.');
  const response=await result(db.rpc('dnd_request_level_up',{
   p_sheet_id:sheet.id,p_class_id:selectedClass.id,p_subclass_id:retained.id||f.get('subclass_id')||null,
   p_hp_gain:Number(f.get('hp_gain')),p_expected_version:sheet.version,p_idempotency_key:key
  }));
  await load();state.sheet=structuredClone(state.sheets.find(x=>x.id===sheet.id));
  toast(response.status==='pending'?'Solicitação enviada ao mestre.':'Level-up aplicado.');
 });
 const form=$('#dialog form'),cls=form.querySelector('[name=class_id]'),sub=form.querySelector('[name=subclass_id]');
 const refresh=()=>{
  const c=availableClasses().find(x=>x.id===cls.value),current=linked.find(x=>x.class_id===c.id);
  const existing=existingSubclass(sheet,c,current,state.subclasses,level(c));
  const eligible=level(c)+1>=c.subclass_level;
  const choices=state.subclasses.filter(x=>x.class_id===c.id&&(!existing.id||x.id===existing.id));
  sub.innerHTML='<option value="">Selecione uma subclasse</option>'+choices.map(x=>`<option value="${x.id}" ${existing.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('');
  sub.required=eligible&&!existing.id;sub.disabled=!eligible||Boolean(existing.id)||existing.unresolved;
  form.querySelector('.primary').disabled=existing.unresolved;
  form.querySelector('.primary').textContent=gm()||setting?.level_up_policy==='player_free'?'Confirmar level-up':'Solicitar level-up';
  $('#subclass-label').hidden=!eligible;
  $('#subclass-note').textContent=existing.unresolved?'A subclasse preenchida não pôde ser vinculada com segurança. Peça ao mestre para revisar o cadastro.':eligible?(existing.id?'Sua subclasse será mantida.':'Escolha obrigatória. Subclasses ainda não cadastradas precisam ser incluídas no catálogo.'):`Subclasse disponível no nível ${c.subclass_level} desta classe.`;
  form.querySelector('[name=hp_gain]').value=Math.max(1,Math.floor(c.hit_die/2)+1+mod(sheet.data.con));
 };
 cls.onchange=refresh;refresh();
}
function spellSlotView(i){
 const d=state.sheet.data,total=Math.max(0,Math.floor(Number(d['slots_'+i])||0)),spent=Math.max(0,Math.floor(Number(d['spent_'+i])||0));
 return `<div class="spell-circle"><div class="spell-circle-heading"><h4>${i+1}º círculo</h4><span>${Math.max(0,total-spent)} / ${total} disponíveis</span></div><div class="spell-marks" role="group" aria-label="Espaços do ${i+1}º círculo">${Array.from({length:Math.min(total,100)},(_,n)=>`<label class="spell-mark" title="Espaço ${n+1}: ${n<spent?'gasto':'disponível'}"><input type="checkbox" data-spell-slot="${i}" data-slot-index="${n}" ${n<spent?'checked':''} aria-label="Espaço ${n+1} do ${i+1}º círculo, gasto"><span aria-hidden="true"></span></label>`).join('')||'<span class="spell-empty">Nenhum espaço configurado</span>'}</div><label class="spell-total">Total de espaços <input data-field="slots_${i}" type="number" min="0" max="100" step="1" value="${total}"></label>${spent>total?`<p class="spell-overflow">${spent-total} gasto(s) acima do total. Aumente o total para ajustá-los.</p>`:''}</div>`;
}
function bindSpellSlots(){document.querySelectorAll('[data-spell-slot]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.spellSlot),n=Number(el.dataset.slotIndex),d=state.sheet.data,spent=Math.max(0,Math.floor(Number(d['spent_'+i])||0));d['spent_'+i]=el.checked?Math.max(spent,n+1):Math.min(spent,n);state.dirty=true;editor();$('#save-status').textContent='Alterações pendentes…';clearTimeout(timer);timer=setTimeout(save,600);});}
function fields(){const d=state.sheet.data;switch(state.tab){case 'caracteristicas':return characteristicsView();case 'principal':return `<section class="panel"><h3>Identidade</h3><div class="grid"><label class="field-wide">Nome do personagem<input data-field="name" value="${esc(state.sheet.name)}" maxlength="150" required></label>${field('background','Antecedente')}${classSelect()}${field('subclass','Subclasse','text','','readonly')}${field('species','Espécie')}${field('level','Nível (automático pelo level-up)','number',1,'min="1" max="20" readonly')}${field('xp','Experiência (XP)','number',0,'min="0"')}</div></section><section class="panel"><h3>Atributos</h3><div class="grid six">${abilities.map(([k,l])=>`<div class="ability">${field(k,l,'number',10,'min="1" max="30"')}<output>${signed(mod(d[k]))}</output><small class="subtle">modificador</small></div>`).join('')}</div></section><section class="panel"><h3>Essenciais</h3><div class="grid"><label>Bônus de proficiência<input data-field="proficiency" type="number" value="${proficiencyBonus(d.level)}" readonly></label>${field('speed','Deslocamento','text','9 m')}${field('size','Tamanho','text','Médio')}${field('passive','Percepção passiva','number',10,'min="0"')}${field('initiative','Iniciativa','number',0)}${check('inspiration','Inspiração heroica')}</div></section><section class="panel"><h3>Características e talentos</h3><div class="grid">${area('features','Características de classe')}${area('species_traits','Traços de espécie')}${area('feats','Talentos')}</div></section>`;
 case 'pericias':return `<section class="panel"><h3>Salvaguardas</h3><p class="note">Bônus calculados a partir dos atributos e da proficiência informada na ficha.</p><div class="grid two">${abilities.map(([k,l])=>proficiency('save_'+k,l,k)).join('')}</div></section><section class="panel"><h3>Perícias</h3><div class="grid two">${skills.map(([l,k],i)=>proficiency('skill_'+i,l,k)).join('')}</div></section><section class="panel"><h3>Treinamento e proficiências</h3><div class="grid">${check('armor_light','Armadura leve')}${check('armor_medium','Armadura média')}${check('armor_heavy','Armadura pesada')}${check('shields','Escudos')}${area('weapons_training','Armas')}${area('tools','Ferramentas')}</div></section>`;
 case 'combate':return `<section class="panel"><h3>Defesa e vitalidade</h3><div class="grid">${field('ac','Classe de armadura','number',10,'min="0"')}${field('hp','PV atuais','number',0,'min="0"')}${field('hp_max','PV máximos','number',0,'min="0"')}${field('hp_temp','PV temporários','number',0,'min="0"')}${field('hit_dice','Dado de vida','text','1d8')}${field('hit_dice_used','Dados de vida gastos','number',0,'min="0"')}${field('hit_dice_max','Dados de vida máximos','number',1,'min="0"')}${check('shield','Escudo equipado')}</div></section><section class="panel"><h3>Salvaguardas contra morte</h3><div class="grid two">${field('death_success','Sucessos','number',0,'min="0" max="3"')}${field('death_failure','Falhas','number',0,'min="0" max="3"')}</div></section><section class="panel"><h3>Armas e truques de dano</h3><p class="note">Registre nome, bônus de ataque ou CD, dano, tipo e notas.</p>${area('attacks','Ataques')}</section><section class="panel condition-panel"><h3>Condições e recursos</h3>${conditionPicker()}${area('conditions','Outras condições e recursos')}</section>`;
 case 'magias':return `<section class="panel"><h3>Conjuração</h3><div class="grid">${field('casting_ability','Atributo de conjuração')}${field('casting_mod','Modificador de conjuração','number',0)}${field('spell_dc','CD para evitar magia','number',10,'min="0"')}${field('spell_attack','Bônus de ataque mágico','number',0)}</div></section><section class="panel spell-slots"><h3>Espaços de magia</h3><p class="note">Marque um espaço ao conjurar e desmarque para recuperá-lo.</p><div class="spell-slot-grid">${Array.from({length:9},(_,i)=>spellSlotView(i)).join('')}</div></section><section class="panel"><h3>Truques e magias preparadas</h3><p class="note">Registre círculo, nome, tempo de conjuração, alcance, concentração, ritual, materiais e notas.</p>${area('spells','Lista de magias')}</section>`;
 case 'historia':return `<section class="panel"><h3>Quem vive nesta ficha</h3><div class="grid">${area('appearance','Aparência')}${area('history','História e personalidade')}${field('alignment','Alinhamento')}${field('languages','Idiomas')}</div></section><section class="panel"><h3>Equipamento</h3><div class="grid">${area('equipment','Inventário')}${field('attuned_1','Item mágico sintonizado 1')}${field('attuned_2','Item mágico sintonizado 2')}${field('attuned_3','Item mágico sintonizado 3')}</div></section><section class="panel"><h3>Moedas</h3><div class="grid">${currencyFields()}</div></section>`;}}
function proficiency(key,label,ability){const d=state.sheet.data,n=Number(d[key]||0),bonus=mod(d[ability])+n*proficiencyBonus(d.level);return `<div class="skill"><span><b>${signed(bonus)}</b>${label}</span><select data-field="${key}" aria-label="Proficiência em ${label}"><option value="0" ${n===0?'selected':''}>Sem treino</option><option value="1" ${n===1?'selected':''}>Proficiente</option><option value="2" ${n===2?'selected':''}>Especialista</option></select></div>`}
async function save(){clearTimeout(timer);if(!state.dirty||state.saving||!state.sheet)return;state.saving=true;refreshSessionSummary();const snapshot=structuredClone(state.sheet);const status=$('#save-status');if(status)status.textContent='Salvando…';try{if(!snapshot.name.trim())throw Error('Preencha o nome do personagem.');const fresh=await result(db.from('dnd_sheets').update({name:snapshot.name.trim(),data:snapshot.data}).eq('id',snapshot.id).eq('version',snapshot.version).select().maybeSingle());if(!fresh){state.conflict=true;throw Error('A ficha mudou em outra tela. Copie suas alterações e use Recarregar antes de editar novamente.');}const unchanged=JSON.stringify(state.sheet.data)===JSON.stringify(snapshot.data)&&state.sheet.name===snapshot.name;state.sheet.version=fresh.version;state.sheet.updated_at=fresh.updated_at;state.dirty=!unchanged;const idx=state.sheets.findIndex(s=>s.id===fresh.id);if(idx>=0)state.sheets[idx]=fresh;if(status)status.textContent=state.dirty?'Novas alterações pendentes…':'✓ Todas as alterações salvas';if($('#saved-at'))$('#saved-at').textContent='Atualizada '+new Date(fresh.updated_at).toLocaleString('pt-BR');}catch(err){if(status)status.textContent=state.conflict?'Conflito de edição — recarregue a ficha':'Não salvo — tente novamente';fail(err);}finally{state.saving=false;refreshSessionSummary();if(isBoss(snapshot))void refreshBossBars({force:true});if(state.dirty&&!state.conflict&&JSON.stringify(state.sheet.data)!==JSON.stringify(snapshot.data))timer=setTimeout(save,600);}}
function manageSheet(){const s=state.sheet;modal('Gerenciar ficha',`<label>Jogador responsável<select name="player" ${s.secret?'disabled':''}><option value="">Mestre (sem jogador)</option>${players().map(p=>`<option value="${p.id}" ${s.player_id===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>${s.secret&&s.kind==='monstro'?`<label class="checkline"><input type="checkbox" name="is_boss" ${isBoss(s)?'checked':''}> Ficha de boss</label><p class="note">A ficha continua secreta. Use Revelar boss para compartilhar somente a barra de vida.</p>`:''}<label class="checkline"><input type="checkbox" name="archived" ${s.archived?'checked':''}> Arquivar ficha</label><p class="note">${s.secret?'Esta ficha permanece secreta e exclusiva do mestre.':'O jogador selecionado terá acesso para ler e editar esta ficha.'}</p>`,async f=>{const fresh=await result(db.from('dnd_sheets').update({player_id:s.secret?null:f.get('player')||null,archived:f.has('archived'),...(s.secret&&s.kind==='monstro'?{data:{...s.data,is_boss:f.has('is_boss')}}:{})}).eq('id',s.id).eq('version',s.version).select().maybeSingle());if(!fresh)throw Error('A ficha mudou. Recarregue antes de alterar o acesso.');state.sheet=fresh;toast('Ficha atualizada.')})}
window.addEventListener('beforeunload',e=>{if(state.dirty||state.saving){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{changed();void refreshPresentation();void refreshBossBars({force:true});});
window.addEventListener('focus',()=>{void refreshPresentation()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshPresentation()});
db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){clearInterval(scenePollTimer);clearTimeout(refreshTimer);subscriptionReady=false;state.connected=false;document.querySelector('.cutscene')?.remove();state.dismissedCutscene=null;mediaUrls.clear();Object.assign(state,{user:null,tables:[],players:[],sheets:[],subclasses:[],settings:[],rulesets:[],rules:[],classes:[],classLevels:[],characterClasses:[],levelUps:[],wallets:[],assets:[],portraits:[],presentations:[],sceneHistory:[],sheet:null,bossBars:[],bossTable:null,bossError:'',dirty:false});clearTimeout(timer);login();}if(event==='TOKEN_REFRESHED'&&session)state.user=session.user;});
try{const {data:{session},error}=await db.auth.getSession();if(error)throw error;if(session)await start(session.user);else login();}catch(err){login();fail(err)}

function printSheet(){const selected=state.tab;const container=document.createElement('div');container.id='print-sheet';container.innerHTML='<h1>'+esc(state.sheet.name)+'</h1>'+['principal','pericias','combate','magias','historia'].map(tab=>{state.tab=tab;return fields()}).join('');state.tab=selected;container.querySelectorAll('textarea').forEach(el=>{const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=el.value||'—';el.replaceWith(p)});document.body.append(container);window.print();container.remove();}
