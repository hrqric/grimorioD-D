import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as scenes from '../dist/scenes.js';
function fixture(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const marks=['death_success','death_failure'].flatMap(key=>Array.from({length:3},(_,i)=>({dataset:{deathSave:key,deathIndex:String(i)},checked:false})));
 const outputs={death_success:{},death_failure:{}},status={},scheduled=[];
 const document={querySelector(s){if(s==='#save-status')return status;const m=s.match(/^\[data-death-count="(.+)"\]$/);return m?outputs[m[1]]:null},querySelectorAll(s){if(s==='[data-death-save]')return marks;const m=s.match(/^\[data-death-save="(.+)"\]$/);return m?marks.filter(x=>x.dataset.deathSave===m[1]):[]}};
 const ctx=vm.createContext({...scenes,createClient:()=>({}),document,console,clearTimeout(){},setTimeout(fn){scheduled.push(fn);return 1}});
 vm.runInContext(source+'\nglobalThis.api={state,deathSavesView,bindDeathSaves};',ctx);ctx.api.state.sheet={data:{death_success:1,death_failure:2}};return {api:ctx.api,marks,outputs,status,scheduled};
}
test('salvaguardas mostram os valores existentes e três marcas para cada resultado',()=>{const {api}=fixture();const html=api.deathSavesView();assert.match(html,/1 \/ 3/);assert.match(html,/2 \/ 3/);assert.equal((html.match(/data-death-save=/g)||[]).length,6);assert.equal((html.match(/ checked /g)||[]).length,3)});
test('marcar e corrigir resultados atualiza a ficha e agenda o salvamento',()=>{const {api,marks,outputs,status,scheduled}=fixture();api.bindDeathSaves();marks[2].checked=true;marks[2].onchange();assert.equal(api.state.sheet.data.death_success,3);assert.deepEqual(marks.slice(0,3).map(m=>m.checked),[true,true,true]);assert.equal(outputs.death_success.textContent,'3 / 3');marks[1].checked=false;marks[1].onchange();assert.equal(api.state.sheet.data.death_success,1);assert.equal(api.state.sheet.data.death_failure,2);assert.equal(api.state.dirty,true);assert.match(status.textContent,/pendentes/);assert.equal(scheduled.length,2)});
