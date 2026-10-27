import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as progression from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';

function fixture(gm=true){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const nodes=new Map();const get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',querySelectorAll:()=>[],querySelector:()=>null});return nodes.get(s)};
 const scheduled=[];
 const document={querySelector:get,querySelectorAll:()=>[]};
 const ctx=vm.createContext({...progression,...scenes,createClient:()=>({}),document,console,structuredClone,clearTimeout(){},setTimeout(fn){scheduled.push(fn);return 1}});
 vm.runInContext(source+'\nglobalThis.api={state,cards,dashboard,sessionSummary,adjustHp,refreshSessionSummary};',ctx);
 const a=ctx.api;
 Object.assign(a.state,{user:{id:'user',email:'player@example.com'},table:'t',tables:gm?[{id:'t',max_players:6}]:[],players:[{id:'p',table_id:'t',name:'Marina',email:'player@example.com',active:true}],sheets:[{id:'s',table_id:'t',player_id:'p',name:'Thalion',secret:false,archived:false,data:{hp:3,hp_max:10,ac:16,initiative:4,level:5}},{id:'secret',table_id:'t',name:'Segredo',secret:true,archived:false,data:{}}],levelUps:[{id:'l',table_id:'t',sheet_id:'s',status:'pending'},{id:'other',table_id:'other',sheet_id:'unknown',status:'pending'}]});
 a.state.sheet=structuredClone(a.state.sheets[0]);
 return {a,get,scheduled};
}
test('search finds a character by responsible player without exposing secret sheets',()=>{
 const {a,get}=fixture();a.state.search='marina';a.cards(false);
 assert.match(get('#cards').innerHTML,/Thalion/);assert.doesNotMatch(get('#cards').innerHTML,/Segredo/);
});
test('dashboard renders actionable pending requests only for master and visible sheets',()=>{
 const {a,get}=fixture();a.dashboard();assert.match(get('#content').innerHTML,/Precisa de você/);assert.match(get('#content').innerHTML,/1 solicitação/);
 const player=fixture(false);player.a.dashboard();assert.doesNotMatch(player.get('#content').innerHTML,/Precisa de você|Arquivo secreto|Nova ficha/);assert.match(player.get('#content').innerHTML,/Minhas fichas/);
});
test('session summary shows real values and escapes character data',()=>{
 const {a}=fixture();a.state.sheet.data.speed='<script>x</script>';
 const html=a.sessionSummary();assert.match(html,/3/);assert.match(html,/10/);assert.match(html,/16/);assert.match(html,/\+4/);assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);
});
test('health controls clamp to current maximum, mark changes pending and schedule existing save',()=>{
 const {a,get,scheduled}=fixture();a.adjustHp(-1);assert.equal(a.state.sheet.data.hp,2);assert.equal(a.state.dirty,true);assert.match(get('#save-status').textContent,/pendentes/);assert.equal(scheduled.length,1);
 a.state.sheet.data.hp=0;a.adjustHp(-1);assert.equal(a.state.sheet.data.hp,0);
 a.state.sheet.data.hp=10;a.adjustHp(1);assert.equal(a.state.sheet.data.hp,10);
});
test('health controls refuse edits during save, conflicts, malformed deltas or unknown maximum',()=>{
 for(const flag of ['saving','conflict']){const {a}=fixture();a.state[flag]=true;a.adjustHp(-1);assert.equal(a.state.sheet.data.hp,3);assert.equal(a.state.dirty,false)}
 const {a}=fixture();a.adjustHp(100);assert.equal(a.state.sheet.data.hp,3);a.state.sheet.data.hp_max=null;a.adjustHp(1);assert.equal(a.state.sheet.data.hp,3);
});
test('summary refresh preserves mounted controls and updates aria-disabled without replacing focus targets',()=>{
 const {a,get}=fixture();const summary=get('#session-summary');summary.innerHTML='mounted controls';
 const value={dataset:{sessionValue:'hp'},textContent:''};const attrs={};const button={dataset:{hp:'1'},setAttribute(k,v){attrs[k]=v}};
 summary.querySelectorAll=s=>s==='[data-session-value]'?[value]:[button];
 a.state.saving=true;a.refreshSessionSummary();
 assert.equal(summary.innerHTML,'mounted controls');assert.equal(value.textContent,'3');assert.equal(attrs['aria-disabled'],'true');
 a.state.saving=false;a.refreshSessionSummary();assert.equal(attrs['aria-disabled'],'false');
});
