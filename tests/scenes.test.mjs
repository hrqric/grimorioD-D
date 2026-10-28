import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const createLatestRequestGate=()=>{let latest=0;return{begin:()=>++latest,isLatest:request=>request===latest}};
const historyOrPrevious=async(promise,previous)=>{try{return{entries:await promise,error:''}}catch{return{entries:previous,error:'Não foi possível atualizar o histórico. Tente novamente.'}}};

function fixture(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 let overlay=null,remote={table_id:'t',cutscene_active:true,cutscene_revision:1,cutscene_asset_id:'a'},reads=0,fail=false;
 const buttons={'#close-local':{},'#close-global':{},'#save-overlay-history':{}};
 const document={activeElement:{matches:()=>true},querySelector:s=>s==='.cutscene'?overlay:buttons[s]||null,
  createElement:()=>({dataset:{},querySelectorAll:()=>[],remove(){if(overlay===this)overlay=null;}}),
  body:{append:el=>{overlay=el;}}};
 const db={from:table=>({select(){return this;},eq(){return this;},in(){return this;},
  async maybeSingle(){reads++;return fail?{error:Error('offline')}:{data:structuredClone(remote)};},
  async is(){return {data:[{id:'a'},{id:'b'}]};}})};
 const context=vm.createContext({createClient:()=>db,createLatestRequestGate,historyOrPrevious,document,console:{error(){}},structuredClone,clearTimeout(){},setTimeout:fn=>{context.pending=fn;}});
 vm.runInContext(source+'\nglobalThis.api={state,refreshPresentation,showCutscene,changed};globalThis.renders=0;render=()=>{renders++};mediaView=()=>{renders++};load=async()=>{};',context);
 const api=context.api;
 Object.assign(api.state,{user:{id:'u'},table:'t',sheet:{id:'s',data:{name:'Ainda digitando'}},sheets:[{id:'s'}],dirty:true});
 return {...api,context,buttons,get overlay(){return overlay;},get reads(){return reads;},set remote(p){remote=p;},set fail(v){fail=v;}};
}

test('remote scene appears and ends while a sheet has unsaved edits',async()=>{
 const a=fixture(),sheet=a.state.sheet;
 await a.refreshPresentation();
 assert.equal(a.overlay.dataset.scene,'t:1');assert.equal(a.state.sheet,sheet);assert.equal(a.state.dirty,true);assert.equal(a.context.renders,0);
 a.remote={table_id:'t',cutscene_active:false,cutscene_revision:2};
 await a.refreshPresentation();assert.equal(a.overlay,null);assert.equal(a.state.sheet,sheet);
});

test('master can save from live cutscene controls without dismissing the scene',async()=>{
 const a=fixture();a.state.tables=[{id:'t'}];
 vm.runInContext('globalThis.savedScenes=[];saveCurrentCutscene=async()=>savedScenes.push(currentPresentation().cutscene_asset_id);',a.context);
 await a.refreshPresentation();const overlay=a.overlay;
 assert.match(overlay.innerHTML,/id="save-overlay-history">Salvar no histórico/);
 await a.buttons['#save-overlay-history'].onclick();
 assert.deepEqual([...a.context.savedScenes],['a']);assert.equal(a.overlay,overlay);
 assert.equal(a.state.dirty,true);
});

test('player does not see save to history in live cutscene controls',async()=>{
 const a=fixture();await a.refreshPresentation();
 assert.doesNotMatch(a.overlay.innerHTML,/save-overlay-history/);
 assert.match(a.overlay.innerHTML,/Fechar para mim/);
});
test('unchanged polling preserves overlay and local dismissal; a new revision reopens',async()=>{
 const a=fixture();await a.refreshPresentation();const overlay=a.overlay;
 await a.refreshPresentation();assert.equal(a.overlay,overlay);
 a.buttons['#close-local'].onclick();await a.refreshPresentation();assert.equal(a.overlay,null);
 a.remote={table_id:'t',cutscene_active:true,cutscene_revision:2,cutscene_asset_id:'b'};
 await a.refreshPresentation();assert.equal(a.overlay.dataset.scene,'t:2');
});
test('dismissal of the same revision in another table does not hide its scene',async()=>{
 const a=fixture();await a.refreshPresentation();a.buttons['#close-local'].onclick();
 a.state.table='other';a.remote={table_id:'other',cutscene_active:true,cutscene_revision:1,cutscene_asset_id:'a'};
 await a.refreshPresentation();assert.equal(a.overlay.dataset.scene,'other:1');
});
test('general realtime refresh still presents scenes when saving or focused',async()=>{
 for(const mode of ['dirty','saving','focus']){
  const a=fixture();a.state.dirty=mode==='dirty';a.state.saving=mode==='saving';
  a.state.presentations=[{table_id:'t',cutscene_active:true,cutscene_revision:1,cutscene_asset_id:'a'}];a.state.assets=[{id:'a'}];
  const sheet=a.state.sheet;a.changed();await a.context.pending();
  assert.equal(a.overlay.dataset.scene,'t:1');assert.equal(a.state.sheet,sheet);assert.equal(a.context.renders,0);
 }
});
test('temporary failure preserves current scene and next refresh recovers',async()=>{
 const a=fixture();await a.refreshPresentation();const overlay=a.overlay;a.fail=true;
 await a.refreshPresentation();assert.equal(a.overlay,overlay);a.fail=false;
 a.remote={table_id:'t',cutscene_active:false,cutscene_revision:2};await a.refreshPresentation();assert.equal(a.overlay,null);
});
test('map refresh updates only the map view and signed-out users do not poll',async()=>{
 const a=fixture();a.state.sheet=null;a.state.view='mapa';await a.refreshPresentation();assert.equal(a.context.renders,1);
 await a.refreshPresentation();assert.equal(a.context.renders,1);
 a.state.user=null;const reads=a.reads;await a.refreshPresentation();assert.equal(a.reads,reads);
});

function historyFixture({master=true,entries=[],failMutation=false}={}){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const content={innerHTML:''},titleInput={value:'Título em edição'},historyError={hidden:true,textContent:''},nodes={'#close-history':{},'#history-error':historyError},rpcCalls=[];let overlay=null;
 const document={activeElement:null,
  querySelector(selector){if(selector==='#content')return content;if(selector==='.cutscene'||selector==='.history-replay')return null;if(selector.startsWith('[data-history-title='))return titleInput;return nodes[selector]||null;},
  querySelectorAll(){return[];},
  createElement:()=>({dataset:{},className:'',innerHTML:'',querySelectorAll:()=>[],remove(){if(overlay===this)overlay=null;}}),
  body:{append:el=>{overlay=el;}}};
 const db={rpc:async(name,args)=>{rpcCalls.push([name,args]);return failMutation?{error:Error('not_authorized')}:{data:{}}},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'signed'}})})}};
 const context=vm.createContext({createClient:()=>db,createLatestRequestGate,historyOrPrevious,sceneHistoryForTable:(items,id)=>items.filter(x=>x.table_id===id&&!x.removed_at).sort((a,b)=>b.created_at.localeCompare(a.created_at)),document,console:{error(){}},structuredClone,clearTimeout(){},setTimeout(){},setInterval(){},Date,Intl});
 vm.runInContext(source+'\nglobalThis.api={state,mediaView,openHistoryScene,renameHistoryEntry};',context);
 Object.assign(context.api.state,{user:{id:'u'},table:'t',view:'mapa',mediaMode:'history',tables:master?[{id:'t'}]:[],sceneHistory:entries,assets:[{id:'asset',bucket_id:'b',object_path:'p'}],presentations:[]});
 return {...context.api,content,titleInput,historyError,rpcCalls,close:nodes['#close-history'],get overlay(){return overlay;}};
}

test('history mode exposes an empty gallery and a Histórico switch',()=>{
 const a=historyFixture();a.mediaView();
 assert.match(a.content.innerHTML,/Histórico/);
 assert.match(a.content.innerHTML,/Nenhuma cutscene no histórico/);
});

test('master gets history title and removal controls while player is read-only',()=>{
 const entry={id:'h',table_id:'t',asset_id:'asset',title:'A chegada',created_at:'2026-10-13T12:00:00Z',removed_at:null};
 const master=historyFixture({master:true,entries:[entry]});master.mediaView();
 assert.match(master.content.innerHTML,/data-history-title="h"/);assert.match(master.content.innerHTML,/data-history-remove="h"/);
 const player=historyFixture({master:false,entries:[entry]});player.mediaView();
 assert.doesNotMatch(player.content.innerHTML,/data-history-title/);assert.doesNotMatch(player.content.innerHTML,/data-history-remove/);
});

test('history replay opens and closes locally without a presentation RPC',()=>{
 const a=historyFixture();a.openHistoryScene({id:'h',asset_id:'asset',title:'Cena local'});
 assert.equal(a.overlay.dataset.history,'h');
 a.close.onclick();assert.equal(a.overlay,null);
 assert.equal(a.rpcCalls.length,0);
});

test('failed rename preserves the typed title and never replaces another view',async()=>{
 const entry={id:'h',table_id:'t',asset_id:'asset',title:'Anterior',created_at:'2026-10-13T12:00:00Z',removed_at:null};
 const a=historyFixture({entries:[entry],failMutation:true});a.mediaView();const html=a.content.innerHTML;
 a.state.view='fichas';await a.renameHistoryEntry('h');
 assert.equal(a.titleInput.value,'Título em edição');assert.equal(a.content.innerHTML,html);assert.equal(a.state.view,'fichas');
});

test('scene polling only reconciles presentation because realtime owns history and boss bars',()=>{
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({createClient:()=>({}),createLatestRequestGate,historyOrPrevious,document:{},console,clearTimeout(){},setTimeout(){},setInterval(){}});
 vm.runInContext(source+'\nlet livePolls=0,historyPolls=0,bossPolls=0;refreshPresentation=()=>{livePolls++};refreshSceneHistory=()=>{historyPolls++};refreshBossBars=()=>{bossPolls++};pollSceneState();globalThis.counts=[livePolls,historyPolls,bossPolls];',context);
 assert.deepEqual([...context.counts],[1,0,0]);
});
