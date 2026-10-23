import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as projection from '../dist/progression.js';
import * as scenes from '../dist/scenes.js';
function fixture(){
 const elements=new Map();
 const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,required:false,querySelector:s=>element(key+' '+s),querySelectorAll:()=>[],showModal(){this.open=true;},close(){this.open=false;},classList:{add(){},remove(){}}});return elements.get(key);};
 const calls=[];let error=null;
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'created'},error};}};
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({...projection,...scenes,createClient:()=>db,document:{querySelector:element,querySelectorAll:()=>[]},FormData:class{constructor(form){return form.data;}},crypto:{randomUUID:()=> 'key'},console,setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(source+'\nglobalThis.api={state,classSelect,homebrewView,newHomebrewClass,newHomebrewSubclass,openLevelUp,setLoad:fn=>load=fn,setRender:fn=>render=fn};',context);
 const a=context.api;
 Object.assign(a.state,{user:{id:'gm'},table:'t1',tables:[{id:'t1',name:'Mar'}],classes:[{id:'w',name:'Mago',hit_die:6,subclass_level:3},{id:'p1',name:'Pirata',table_id:'t1',hit_die:10,subclass_level:3},{id:'p2',name:'Bruxo do mar',table_id:'t2',hit_die:8,subclass_level:2}],sheet:{id:'s',table_id:'t1',version:1,data:{class:'Pirata',level:2,con:10}},subclasses:[{id:'corsair',class_id:'p1',name:'Corsário'},{id:'foreign',class_id:'p2',name:'Tempestade'}]});
 a.setLoad(async()=>{});a.setRender(()=>{});
 return {a,element,calls,setError:e=>error=e};
}
test('homebrew selection shows only global and same-table classes',()=>{
 const {a}=fixture();const html=a.classSelect();
 assert.match(html,/value="Pirata" selected/);assert.match(html,/Mago/);assert.doesNotMatch(html,/Bruxo do mar/);
 a.state.sheet.table_id='t2';a.state.sheet.data.class='Bruxo do mar';
 const other=a.classSelect();assert.match(other,/value="Bruxo do mar" selected/);assert.doesNotMatch(other,/value="Pirata"/);
});
test('homebrew view lists only current-table classes and shows the empty create action',()=>{
 const {a,element}=fixture();a.state.sheet=null;a.homebrewView();
 assert.match(element('#content').innerHTML,/Pirata/);assert.doesNotMatch(element('#content').innerHTML,/Bruxo do mar/);
 assert.match(element('#content').innerHTML,/Corsário/);
 a.state.classes=[];a.homebrewView();assert.match(element('#content').innerHTML,/Nenhuma classe homebrew/);assert.match(element('#content').innerHTML,/id="new-homebrew"/);
});
test('homebrew view sorts names and escapes class and subclass descriptions',()=>{
 const {a,element}=fixture();a.state.sheet=null;
 a.state.classes.push({id:'z',name:'Zelador',table_id:'t1',description:'<script>perigo</script>'},{id:'a',name:'Alquimista',table_id:'t1',description:'A & B'});
 a.state.subclasses.push({id:'x',class_id:'a',name:'<Ilusionista>',description:'<img onerror="x">'});
 a.homebrewView();const html=element('#content').innerHTML;
 assert.ok(html.indexOf('Alquimista')<html.indexOf('Pirata'));assert.ok(html.indexOf('Pirata')<html.indexOf('Zelador'));
 assert.match(html,/&lt;script&gt;perigo&lt;\/script&gt;/);assert.match(html,/A &amp; B/);
 assert.match(html,/&lt;Ilusionista&gt;/);assert.match(html,/&lt;img onerror=&quot;x&quot;&gt;/);assert.doesNotMatch(html,/<script>|<img onerror/);
});
test('homebrew player cannot open the create form or management view',()=>{
 const {a,element,calls}=fixture();a.state.tables=[];
 a.newHomebrewClass();assert.equal(element('#dialog').open,undefined);
 a.homebrewView();assert.doesNotMatch(element('#content').innerHTML,/new-homebrew|data-add-subclass/);assert.equal(calls.length,0);
});
test('homebrew form keeps input after RPC failure and blocks duplicate submit',async()=>{
 const {a,element,calls,setError}=fixture();a.newHomebrewClass();
 const form=element('#dialog').querySelector('form');
 form.data=new Map(Object.entries({name:'Navegante',description:'História',hit_die:'10',subclass_level:'3',subclasses:'Corsário\nBucaneiro'}));
 const button=form.querySelector('.primary');setError({message:'Falha ao salvar'});
 const saving=form.onsubmit({preventDefault(){},target:form});assert.equal(button.disabled,true);
 await form.onsubmit({preventDefault(){},target:form});await saving;
 assert.equal(calls.length,1);assert.equal(button.disabled,false);assert.equal(element('#dialog').open,true);
 assert.equal(form.data.get('name'),'Navegante');assert.equal(element('#modal-error').textContent,'Falha ao salvar');
 assert.equal(calls[0].name,'dnd_create_homebrew_class');assert.equal(calls[0].args.p_table_id,'t1');
 assert.equal(calls[0].args.p_subclasses.length,2);
 setError(null);await form.onsubmit({preventDefault(){},target:form});assert.equal(element('#dialog').open,false);
});
test('homebrew form adds a subclass only to an owned homebrew class',async()=>{
 const {a,element,calls}=fixture();a.newHomebrewSubclass('w');assert.equal(element('#dialog').open,undefined);
 a.newHomebrewSubclass('p2');assert.equal(element('#dialog').open,undefined);
 a.newHomebrewSubclass('p1');assert.equal(element('#dialog').open,true);
 const form=element('#dialog form');form.data=new Map(Object.entries({name:'Capitão',description:'Comanda o navio'}));
 await form.onsubmit({preventDefault(){},target:form});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'dnd_add_homebrew_subclass');
 assert.equal(calls[0].args.p_class_id,'p1');assert.equal(calls[0].args.p_description,'Comanda o navio');
});
test('homebrew level uses its hit die, subclass threshold and own subclasses',async()=>{
 const {a,element}=fixture();element('#dialog form [name=class_id]').value='p1';await a.openLevelUp();
 const form=element('#dialog form');form.querySelector('[name=class_id]').value='p1';
 // A real browser selects the first option before refresh; fire change after assigning its fake value.
 form.querySelector('[name=class_id]').onchange();
 assert.equal(form.querySelector('[name=hp_gain]').value,6);
 assert.match(form.querySelector('[name=subclass_id]').innerHTML,/Corsário/);
 assert.doesNotMatch(form.querySelector('[name=subclass_id]').innerHTML,/Tempestade/);
 assert.equal(form.querySelector('[name=subclass_id]').required,true);
});
test('homebrew level respects a custom threshold and a different hit die',async()=>{
 const {a,element}=fixture();Object.assign(a.state.classes[1],{subclass_level:5,hit_die:12});
 element('#dialog form [name=class_id]').value='p1';await a.openLevelUp();
 const form=element('#dialog form');
 assert.equal(form.querySelector('[name=hp_gain]').value,7);
 assert.equal(element('#subclass-label').hidden,true);assert.equal(form.querySelector('[name=subclass_id]').required,false);
 a.state.sheet.data.level=4;form.querySelector('[name=class_id]').onchange();
 assert.equal(element('#subclass-label').hidden,false);assert.equal(form.querySelector('[name=subclass_id]').required,true);
});
