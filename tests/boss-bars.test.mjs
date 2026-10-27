import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as scenes from '../dist/scenes.js';
import * as progression from '../dist/progression.js';

function fixture(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 let remote=[],error=null,resolver,rpcError=null;const calls=[],rpcCalls=[];
 const hud={innerHTML:'',hidden:true};const buttons=[];
 const toast={textContent:'',classList:{add(){},remove(){}}};
 const doc={hidden:false,querySelector:s=>s==='#boss-hud'?hud:s==='#toast'?toast:null,querySelectorAll:()=>buttons};
 const db={from(name){calls.push(name);return{select(){return this},eq(){return this},order(){if(resolver)return new Promise(resolve=>resolver(resolve));return Promise.resolve(error?{error}:{data:remote})}}}};
 db.rpc=async(name,args)=>{rpcCalls.push([name,args]);return rpcError?{error:rpcError}:{data:null}};
 const ctx=vm.createContext({...scenes,...progression,createClient:()=>db,document:doc,console:{error(){}},structuredClone,setTimeout(){},clearTimeout(){}});
 vm.runInContext(source+'\nglobalThis.api={state,isBoss,bossBarsForTable,refreshBossBars,renderBossBars,bossControls,setBossVisibility};',ctx);
 const a=ctx.api;Object.assign(a.state,{user:{id:'u'},table:'t',tables:[{id:'t'}],sheet:{id:'editing',data:{history:'Ainda digitando'}},dirty:true});
 return {a,hud,ctx,calls,rpcCalls,toast,set rows(value){remote=value},set error(value){error=value},set rpcError(value){rpcError=value},defer(fn){resolver=fn}};
}
const boss={sheet_id:'boss',table_id:'t',name:'Guardião <antigo>',hp:75,hp_max:100};
test('only secret unarchived monster sheets marked as boss are eligible for reveal',()=>{
 const {a}=fixture();const s={secret:true,kind:'monstro',archived:false,data:{is_boss:true}};
 assert.equal(a.isBoss(s),true);assert.equal(a.isBoss({...s,secret:false}),false);assert.equal(a.isBoss({...s,kind:'personagem'}),false);assert.equal(a.isBoss({...s,data:{is_boss:'true'}}),false);
 a.state.bossBars=[];assert.doesNotMatch(a.bossControls({...s,id:'b',archived:true}),/data-boss-visible/);
});
test('public projection filters other tables, invalid HP and duplicate sheets',()=>{
 const {a}=fixture();const rows=a.bossBarsForTable([boss,{...boss},{...boss,sheet_id:'zero',hp:0},{...boss,sheet_id:'foreign',table_id:'other'},{...boss,sheet_id:'invalid',hp_max:0},{...boss,sheet_id:'nan',hp:'oops'}],'t');
 assert.equal(rows.length,2);assert.equal(rows[1].hp,0);assert.equal(a.bossBarsForTable(null,'t').length,0);
});
test('HUD shows escaped names and life proportions without exposing exact values or secrets',()=>{
 const {a,hud}=fixture();a.state.bossBars=[{...boss,hp:73,data:{attacks:'Segredo'}}];a.renderBossBars();
 assert.equal(hud.hidden,false);assert.match(hud.innerHTML,/Guardião &lt;antigo&gt;/);assert.match(hud.innerHTML,/73%/);assert.doesNotMatch(hud.innerHTML,/Segredo|<antigo>|73\s*\/\s*100/);
});
test('remote boss updates and hiding never reconstruct the editor or discard pending fields',async()=>{
 const f=fixture(),sheet=f.a.state.sheet;f.rows=[boss];await f.a.refreshBossBars();assert.equal(f.a.state.sheet,sheet);assert.equal(f.a.state.dirty,true);assert.match(f.hud.innerHTML,/75%/);
 f.rows=[];await f.a.refreshBossBars();assert.equal(f.hud.hidden,true);assert.equal(f.a.state.sheet.data.history,'Ainda digitando');
});
test('late responses after table switch or sign-out cannot restore an old boss',async()=>{
 const f=fixture();let resolve;f.defer(r=>{resolve=r});const pending=f.a.refreshBossBars();f.a.state.table='other';resolve({data:[boss]});await pending;assert.equal(f.a.state.bossBars.length,0);
 const g=fixture();g.defer(r=>{resolve=r});const signedOut=g.a.refreshBossBars();g.a.state.user=null;resolve({data:[boss]});await signedOut;assert.equal(g.a.state.bossBars.length,0);
});
test('temporary failure marks the HUD stale and the next successful refresh recovers',async()=>{
 const f=fixture();f.rows=[boss];await f.a.refreshBossBars();f.error=Error('offline');await f.a.refreshBossBars();assert.match(f.hud.innerHTML,/sincroniza/);assert.equal(f.a.state.bossBars.length,1);
 f.error=null;f.rows=[{...boss,hp:10}];await f.a.refreshBossBars();assert.equal(f.a.state.bossError,'');assert.match(f.hud.innerHTML,/10%/);
});
test('only the master can reveal a boss using the persisted sheet version',async()=>{
 const f=fixture();f.a.state.sheets=[{id:'boss',table_id:'t',version:8,secret:true,kind:'monstro',archived:false,data:{is_boss:true,hp:75,hp_max:100}}];f.rows=[boss];
 await f.a.setBossVisibility('boss',true);assert.equal(f.rpcCalls.length,1);assert.equal(f.rpcCalls[0][1].p_expected_version,8);assert.equal(f.rpcCalls[0][1].p_visible,true);assert.match(f.toast.textContent,/revelado/);
 f.a.state.tables=[];await f.a.setBossVisibility('boss',false);assert.equal(f.rpcCalls.length,1);
});
test('failed visibility command never announces success or mutates the current boss projection',async()=>{
 const f=fixture();f.a.state.sheets=[{id:'boss',table_id:'t',version:8,secret:true,kind:'monstro',archived:false,data:{is_boss:true}}];
 f.rpcError=Error('invalid_boss_hp');await f.a.setBossVisibility('boss',true);assert.match(f.toast.textContent,/PV máximos/);assert.equal(f.a.state.bossBars.length,0);
});
test('overlapping refreshes keep only the latest response, including multiple bosses and zero life',async()=>{
 const f=fixture(),resolves=[];f.defer(r=>resolves.push(r));const older=f.a.refreshBossBars(),newer=f.a.refreshBossBars();
 resolves[1]({data:[{...boss,hp:0},{...boss,sheet_id:'second',name:'Segundo boss',hp:25}]});await newer;
 resolves[0]({data:[boss]});await older;assert.equal(f.a.state.bossBars.length,2);assert.equal(f.a.state.bossBars[0].hp,0);assert.match(f.hud.innerHTML,/Segundo boss/);
});
