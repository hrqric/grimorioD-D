import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as projection from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';
import * as currency from '../dist/currency.js';

function fixture(isGm=true){
 const content={innerHTML:''};
 const document={querySelector:selector=>selector==='#content'?content:null,querySelectorAll:()=>[]};
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({...projection,...scenes,...currency,createClient:()=>({}),document,console});
 vm.runInContext(source+'\nglobalThis.api={state,progressView,currencyFields,currencyProgressCard};',context);
 const api=context.api,sheet={id:'sheet',table_id:'table',name:'Yuri',kind:'personagem',secret:false,archived:false,data:{level:7,ep:2,pp:1}};
 Object.assign(api.state,{table:'table',tables:isGm?[{id:'table'}]:[],sheets:[sheet],sheet,settings:[{table_id:'table',level_up_policy:'gm_only',gold_xp_enabled:true}],wallets:[{sheet_id:'sheet',table_id:'table',cp:18,sp:12,gp:84,gold_progress:35}],levelUps:[],classes:[],players:[],rules:[],characterClasses:[]});
 return {api,content};
}

test('ficha ativa mostra barra acessível com a meta do nível atual',()=>{
 const {api}=fixture(false),html=api.currencyProgressCard(api.state.sheet);
 assert.match(html,/35 \/ 55 PO/);assert.match(html,/Faltam 20 PO para o nível 8/);assert.match(html,/role="progressbar"/);assert.match(html,/aria-valuenow="35"/);
});

test('PC, PP e PO ficam somente leitura quando a regra está ativa',()=>{
 const {api}=fixture(false),html=api.currencyFields();
 assert.match(html,/Cobre \(PC\).*value="18" readonly/s);assert.match(html,/Prata \(PP\).*value="12" readonly/s);assert.match(html,/Ouro \(PO\).*value="84" readonly/s);
 assert.doesNotMatch(html,/data-field="(?:cp|sp|gp)"/);assert.match(html,/data-field="ep"/);assert.match(html,/data-field="pp"/);
});

test('somente o mestre vê o comando de nova distribuição',()=>{
 const master=fixture(true);master.api.progressView();assert.match(master.content.innerHTML,/id="distribute-currency"/);
 const player=fixture(false);player.api.progressView();assert.doesNotMatch(player.content.innerHTML,/id="distribute-currency"/);assert.match(player.content.innerHTML,/Progresso do grupo/);
});
