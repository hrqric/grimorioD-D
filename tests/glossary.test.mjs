import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const entries=JSON.parse(readFileSync(new URL('../supabase/seeds/spells_2024.json',import.meta.url),'utf8'));
const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
const nodes=Object.fromEntries(['#content','#glossary-search','#glossary-kind','#glossary-class','#glossary-results'].map(k=>[k,{value:'',innerHTML:''}]));
const context=vm.createContext({createClient:()=>({}),document:{querySelector:s=>nodes[s]},console});
vm.runInContext(source+'\nglobalThis.api={state,isCantrip,matchesGlossary,glossaryView};',context);
const {api}=context;
api.state.classes=[{id:'wizard',slug:'wizard',name:'Mago'},{id:'druid',slug:'druid',name:'Druida'}];
test('classe combina com categoria e busca sem confundir menções no texto',()=>{
 const druids=entries.filter(e=>api.matchesGlossary(e,'cantrip','','druid'));
 assert.ok(druids.length>0);assert.ok(druids.every(e=>e.metadata.classes.includes('Druida')));
 assert.equal(api.matchesGlossary({kind:'rule',name:'Mago',metadata:{}},'','','wizard'),false);
 for(const metadata of [{class_id:'wizard'},{class_slug:'wizard'},{class_name:'Mago'},{classes:['Mago','Druida']}])assert.equal(api.matchesGlossary({kind:'rule',metadata},'','','wizard'),true);
 assert.equal(api.matchesGlossary(druids[0],'cantrip','inexistente','druid'),false);
 assert.equal(api.matchesGlossary(druids[0],'cantrip','','invalid'),false);
});
test('catálogo importado completo e sem chaves duplicadas',()=>{
 assert.equal(entries.length,179);
 assert.equal(new Set(entries.map(e=>e.kind+':'+e.slug)).size,179);
 assert.equal(entries.filter(e=>e.kind==='spell').length,139);
 assert.equal(entries.filter(e=>api.isCantrip(e)).length,34);
 assert.equal(entries.filter(e=>e.kind==='spell'&&!api.isCantrip(e)).length,105);
 for(const e of entries){assert.ok(e.source_page);assert.ok(e.metadata.source_sha256);assert.ok(e.content);}
});
test('filtro Truques exclui magias de outros círculos e referências de subclasses',()=>{
 assert.equal(entries.filter(e=>api.matchesGlossary(e,'cantrip','')).length,34);
 assert.equal(entries.filter(e=>api.matchesGlossary(e,'spell','')).length,139);
 const cantrip=entries.find(e=>e.metadata.spell_level===0);
 assert.equal(api.matchesGlossary(cantrip,'cantrip',cantrip.name.toUpperCase()),true);
 assert.equal(api.matchesGlossary(cantrip,'cantrip','inexistente'),false);
});
test('glossário renderiza tag e oferece filtro Truques',()=>{
 api.state.rules=entries;api.glossaryView();
 assert.match(nodes['#content'].innerHTML,/<option value="cantrip">Truques<\/option>/);
 nodes['#glossary-kind'].value='cantrip';nodes['#glossary-kind'].onchange();
 assert.equal((nodes['#glossary-results'].innerHTML.match(/class="panel glossary-entry"/g)||[]).length,34);
 assert.equal((nodes['#glossary-results'].innerHTML.match(/class="badge">Truques/g)||[]).length,34);
 assert.match(nodes['#content'].innerHTML,/id="glossary-class"/);
 nodes['#glossary-class'].value='druid';nodes['#glossary-class'].onchange();
 const expected=entries.filter(e=>api.matchesGlossary(e,'cantrip','','druid')).length;
 assert.equal((nodes['#glossary-results'].innerHTML.match(/class="panel glossary-entry"/g)||[]).length,expected);
 nodes['#glossary-class'].value='';nodes['#glossary-class'].onchange();
 assert.equal((nodes['#glossary-results'].innerHTML.match(/class="panel glossary-entry"/g)||[]).length,34);
});
