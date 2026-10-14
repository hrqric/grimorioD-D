import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as progression from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';

const rules=[
 {id:'blind',kind:'condition',slug:'condition-cego',name:'Cego (Blinded)'},
 {id:'paralyzed',kind:'condition',slug:'condition-paralisado',name:'Paralisado (Paralyzed)'},
 {id:'poisoned',kind:'condition',slug:'condition-envenenado',name:'Envenenado (Poisoned)'}
];

function renderCard(activeConditions=[]){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const cardsNode={innerHTML:''};
 const document={querySelector:selector=>selector==='#cards'?cardsNode:null,querySelectorAll:()=>[]};
 const context=vm.createContext({...progression,...scenes,createClient:()=>({}),document,console,structuredClone});
 vm.runInContext(source+'\nglobalThis.api={state,cards};',context);
 Object.assign(context.api.state,{table:'t',filter:'all',search:'',rules,players:[],portraits:[],assets:[],sheets:[{id:'s',table_id:'t',name:'Derrick',kind:'personagem',secret:false,archived:false,data:{species:'Humano',class:'Mago',level:3,ac:15,hp:1,hp_max:18,active_conditions:activeConditions}}]});
 context.api.cards(false);
 return cardsNode.innerHTML;
}

test('overview card without active conditions keeps its neutral appearance',()=>{
 const html=renderCard();
 assert.doesNotMatch(html,/card-conditioned|condition-card-icons|data-dominant-tone/);
});

test('overview card shows every active condition icon with accessible names',()=>{
 const html=renderCard(['condition-cego','condition-envenenado']);
 assert.match(html,/condition-card-icons/);
 assert.match(html,/title="Cego \(Blinded\)"[^>]*>◉</);
 assert.match(html,/title="Envenenado \(Poisoned\)"[^>]*>☠</);
});

test('incapacitating condition supplies the dominant card tone',()=>{
 const html=renderCard(['condition-cego','condition-paralisado']);
 assert.match(html,/card-conditioned/);
 assert.match(html,/data-dominant-tone="disabled"/);
 assert.match(html,/data-tone="sight"/);
 assert.match(html,/data-tone="disabled"/);
});
