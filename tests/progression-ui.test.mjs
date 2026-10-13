import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as projection from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';
function fixture(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({...projection,...scenes,createClient:()=>({}),console});
 vm.runInContext(source+'\nglobalThis.api={state,classSelect,characteristicsView,classReviewQueue,fields,conditionIndicators};',context);
 const api=context.api;
 Object.assign(api.state,{table:'t',tables:[{id:'t'}],classes:[{id:'w',name:'Mago',subclass_level:3},{id:'f',name:'Guerreiro'}],classLevels:[1,2,3,4,5].map(level=>({class_id:'w',level})),subclasses:[{id:'e',class_id:'w',name:'Evocador'}],sheet:{id:'s',table_id:'t',data:{class:'Mago',level:2}},rules:[{id:'r',name:'Segredo longo',summary:'Não mostrar',content:'Não mostrar',metadata:{class_id:'w',grant:'class',level:3,features_text:'Subclasse de Mago',resources_text:'Truques: 3'}},{id:'e',name:'Evocação',metadata:{class_id:'w',subclass_id:'e',grant:'subclass',level:3}},{id:'blind',kind:'condition',slug:'condition-cego',name:'Cego (Blinded)',summary:'Não enxerga.'},{id:'prone',kind:'condition',slug:'condition-caido',name:'Caído (Prone)',summary:'Está no chão.'}]});
 return api;
}
test('nível e subclasse são somente leitura na ficha',()=>{
 const a=fixture();a.state.tab='principal';
 const html=a.fields();
 assert.match(html,/data-field="level"[^>]*readonly/);
 assert.match(html,/data-field="subclass"[^>]*readonly/);
});
test('ficha deriva a proficiência do nível e ignora valor salvo incorreto',()=>{
 const a=fixture();Object.assign(a.state.sheet.data,{level:9,proficiency:99,str:10,skill_0:1});
 a.state.tab='principal';
 assert.match(a.fields(),/data-field="proficiency"[^>]*value="4"[^>]*readonly/);
 a.state.tab='pericias';
 assert.match(a.fields(),/<b>\+4<\/b>Atletismo/);
});
test('aba de combate oferece condições do glossário e preserva anotações livres',()=>{
 const a=fixture();Object.assign(a.state.sheet.data,{active_conditions:['condition-cego'],conditions:'Resistência a fogo'});a.state.tab='combate';
 const html=a.fields();
 assert.match(html,/data-condition="condition-cego"[^>]*checked/);
 assert.match(html,/data-condition="condition-caido"/);
 assert.match(html,/Outras condições e recursos/);
 assert.match(html,/Resistência a fogo/);
 assert.match(html,/data-tone="sight"/);
 assert.match(a.conditionIndicators(),/data-tone="sight"/);
 assert.match(a.conditionIndicators(),/condition-icon[^>]*>◉</);
 assert.match(a.conditionIndicators(),/Cego \(Blinded\)/);
});
test('dropdown contém catálogo e fica protegido com histórico',()=>{
 const a=fixture();assert.match(a.classSelect(),/<select data-field="class"/);
 assert.match(a.classSelect(),/value="Mago" selected/);
 a.state.characterClasses=[{sheet_id:'s',class_id:'w',class_level:2}];
 assert.match(a.classSelect(),/data-field="class" disabled/);
});
test('classe desconhecida fica preservada na fila do mestre',()=>{
 const a=fixture();a.state.sheet.data.class='<Artífice>';
 a.state.sheets=[a.state.sheet];
 assert.match(a.classSelect(),/&lt;Artífice&gt; — aguardando mestre/);
 assert.match(a.classReviewQueue(),/data-review-class="s"/);
 a.state.tables=[];assert.equal(a.classReviewQueue(),'');
 assert.doesNotMatch(a.classSelect(),/data-review-class/);
});
test('aba mostra nomes e recursos, separa pendência e omite textos completos',()=>{
 const a=fixture();
 a.state.levelUps=[{sheet_id:'s',class_id:'w',subclass_id:'e',to_class_level:3,status:'pending'}];
 const html=a.characteristicsView();
 assert.match(html,/Adquiridas/);assert.match(html,/Próximo nível/);assert.match(html,/Progressão futura/);
 assert.match(html,/ainda não foram adquiridos/);assert.match(html,/Truques: 3/);
 assert.match(html,/Evocação/);assert.doesNotMatch(html,/Não mostrar|Segredo longo/);
 const acquired=html.split('<h4>Adquiridas</h4>')[1].split('<h4>Próximo nível')[0];
 assert.doesNotMatch(acquired,/Evocação|Subclasse de Mago/);
});
