import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as progression from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';

function fixture(master=true){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const nodes=new Map(),get=s=>{if(!nodes.has(s))nodes.set(s,{innerHTML:'',textContent:'',classList:{add(){},remove(){}}});return nodes.get(s)};
 const calls=[];let response,resolve;
 const query={update(value){calls.push(['update',value]);return query},eq(...args){calls.push(['eq',...args]);return query},select(){return query},maybeSingle(){return response??new Promise(r=>{resolve=r})}};
 const db={from(name){calls.push(['from',name]);return query}};
 const context=vm.createContext({...progression,...scenes,createClient:()=>db,document:{querySelector:get,querySelectorAll:()=>[]},console:{error(){}},structuredClone,setTimeout(){},clearTimeout(){}});
 vm.runInContext(source+'\nglobalThis.api={state,cards,archiveSheet};',context);
 const a=context.api,sheet={id:'s',table_id:'t',name:'Thalion',version:7,secret:false,archived:false,kind:'personagem',data:{}};
 Object.assign(a.state,{user:{id:'u'},table:'t',tables:master?[{id:'t',max_players:6}]:[],sheets:[sheet]});
 const button={disabled:false,setAttribute(){},removeAttribute(){}};
 return {a,sheet,get,calls,button,respond:r=>{response=r;resolve?.(r)}};
}
test('master card has grouped icon actions with names and direct archive; player has only open',()=>{
 const {a,get}=fixture();a.cards(false);const html=get('#cards').innerHTML;
 assert.match(html,/card-tools/);assert.match(html,/data-copy-sheet="s"[^>]*[\s\S]*?<svg/);assert.match(html,/data-archive-sheet="s"/);assert.match(html,/aria-label="Arquivar ficha de Thalion"/);assert.match(html,/title="Caderno do mestre"/);
 const player=fixture(false);player.a.cards(false);assert.doesNotMatch(player.get('#cards').innerHTML,/data-copy-sheet|data-gm-notes|data-archive-sheet/);
});
test('one click archives with version check and only changes card after persistence',async()=>{
 const {a,sheet,calls,button,respond}=fixture();const pending=a.archiveSheet(sheet,button);
 assert.equal(button.disabled,true);assert.equal(sheet.archived,false);
 assert.ok(calls.some(c=>c[0]==='update'&&c[1].archived===true));assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='version'&&c[2]===7));
 respond({data:{...sheet,archived:true,version:8}});await pending;
 assert.equal(a.state.sheets[0].archived,true);assert.equal(a.state.sheets[0].version,8);assert.equal(button.disabled,false);
});
test('archived card offers one click restoration',async()=>{
 const {a,sheet,get,respond,button}=fixture();sheet.archived=true;a.state.filter='archived';a.cards(false);
 assert.match(get('#cards').innerHTML,/aria-label="Restaurar ficha de Thalion"/);
 respond({data:{...sheet,archived:false,version:8}});await a.archiveSheet(sheet,button);assert.equal(a.state.sheets[0].archived,false);
});
test('archive refuses players, foreign tables and repeated clicks before database calls',async()=>{
 const player=fixture(false);await player.a.archiveSheet(player.sheet,player.button);assert.equal(player.calls.length,0);
 const foreign=fixture();foreign.sheet.table_id='other';await foreign.a.archiveSheet(foreign.sheet,foreign.button);assert.equal(foreign.calls.length,0);
 const {a,sheet,button,respond,calls}=fixture();const first=a.archiveSheet(sheet,button);const count=calls.length;await a.archiveSheet(sheet,button);assert.equal(calls.length,count);respond({data:{...sheet,archived:true}});await first;
});
test('failed or conflicting archive keeps original card and restores the control',async()=>{
 for(const result of [{error:Error('Falha de conexão')},{data:null}]){
  const {a,sheet,get,respond,button}=fixture();respond(result);await a.archiveSheet(sheet,button);
  assert.equal(a.state.sheets[0].archived,false);assert.equal(button.disabled,false);assert.match(get('#toast').textContent,/Falha de conexão|mudou/);
 }
});
test('archive completion after sign-out leaves the sign-in screen and session state untouched',async()=>{
 const {a,sheet,get,respond,button}=fixture();const pending=a.archiveSheet(sheet,button);a.state.user=null;
 respond({data:{...sheet,archived:true,version:8}});await pending;
 assert.equal(get('#content').innerHTML,'');assert.equal(get('#toast').textContent,'');assert.equal(a.state.sheets[0].archived,false);
});
