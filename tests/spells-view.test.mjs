import test from 'node:test';
import assert from 'node:assert/strict';
import { spellCatalog, filterSpells, proposalDetails } from '../dist/spells-view.js';
const classes=[{id:'d',name:'Druida',slug:'druida'},{id:'m',name:'Mago',slug:'mago'}];
const rules=[{id:'a',kind:'spell',name:'Emaranhar',metadata:{spell_level:1,classes:['Druida']},summary:'Plantas'},{id:'b',kind:'spell',name:'Luz',metadata:{spell_level:0,classes:['Mago']}},{id:'n',kind:'rule',name:'Regra'}];
const tableSpells=[{id:'c',table_id:'t',status:'approved',name:'Brilho',spell_level:1,classes:['d'],description:'Luz'},{id:'p',table_id:'t',status:'pending',name:'Segredo',spell_level:1,classes:['d']},{id:'x',table_id:'other',status:'approved',name:'Outra',spell_level:1,classes:['d']}];
test('catálogo reúne magias aprovadas da mesa e associa classes oficiais',()=>{const list=spellCatalog(rules,tableSpells,classes,'t');assert.deepEqual(list.map(x=>x.name),['Luz','Brilho','Emaranhar']);assert.deepEqual(list.find(x=>x.name==='Emaranhar').classes,['d']);});
test('filtros combinam texto, classe e círculo sem incluir propostas',()=>{const list=spellCatalog(rules,tableSpells,classes,'t');assert.deepEqual(filterSpells(list,{classId:'d',circle:'1',query:'plantas'}).map(x=>x.name),['Emaranhar']);assert.deepEqual(filterSpells(list,{classId:'m',circle:'0'}).map(x=>x.name),['Luz']);});
test('nível ausente não vira truque e link inseguro é descartado',()=>{const [spell]=spellCatalog([{id:'a',kind:'spell',name:'X',metadata:{},source_url:'javascript:alert(1)'}],[],classes,'t');assert.equal(spell.level,null);assert.equal(spell.sourceUrl,'');assert.equal(filterSpells([spell],{circle:'0'}).length,0);});

test('revisão exibe todos os dados da proposta e escapa conteúdo',()=>{const html=proposalDetails({classes:['d','m'],school:'Evocação',casting_time:'1 ação',spell_range:'9 metros',components:'V, S',duration:'1 minuto',description:'<script>alert(1)</script>'},new Map(classes.map(c=>[c.id,c.name])));for(const value of ['Druida, Mago','Evocação','1 ação','9 metros','V, S','1 minuto','&lt;script&gt;'])assert.ok(html.includes(value),value);assert.ok(!html.includes('<script>'));});
