import test from 'node:test';
import assert from 'node:assert/strict';
import {sheetSpellCatalog,togglePreparedSpell,selectedSpells,preparedSpellsPrintHtml} from '../dist/sheet-spells.js';
const sheet={id:'s',table_id:'t',data:{class:'Druida',spells:'Anotações antigas'}};
const classes=[{id:'d',name:'Druida',slug:'druida'},{id:'m',name:'Mago',slug:'mago'}];
const rules=[{id:'a',kind:'spell',name:'Arte',metadata:{spell_level:0,classes:['Druida']}},{id:'b',kind:'spell',name:'Bola',metadata:{spell_level:3,classes:['Mago']}}];
test('catálogo respeita classes vinculadas, mesa e aprovação',()=>{
 const custom=[{id:'x',table_id:'t',status:'approved',name:'Raiz',spell_level:1,classes:['d']},{id:'y',table_id:'t',status:'pending',name:'Pendente',classes:['Druida']},{id:'z',table_id:'outra',status:'approved',name:'Outra',classes:['Druida']}];
 assert.deepEqual(sheetSpellCatalog(sheet,classes,[],rules,custom).map(x=>x.name),['Arte','Raiz']);
 assert.deepEqual(sheetSpellCatalog(sheet,classes,[{sheet_id:'s',class_id:'m'}],rules,[]).map(x=>x.name),['Arte','Bola']);
});
test('seleção conserva anotações e referências indisponíveis',()=>{
 const data={spells:'Original',prepared_spells:[{key:'official:old',name:'Antiga'}]};
 togglePreparedSpell(data,{key:'official:a',name:'Arte'});assert.equal(data.spells,'Original');assert.equal(selectedSpells(data).length,2);
 togglePreparedSpell(data,{key:'official:a',name:'Arte'});assert.deepEqual(selectedSpells(data),[{key:'official:old',name:'Antiga'}]);
});

test('impressão inclui nomes selecionados com caracteres seguros e estado vazio',()=>{
 assert.equal(preparedSpellsPrintHtml({}),'<p>Nenhuma magia selecionada.</p>');
 assert.equal(preparedSpellsPrintHtml({prepared_spells:[{key:'table:x',name:'Luz <forte>'},{key:'official:a',name:'Arte'}]}),'<ul><li>Luz &lt;forte&gt;</li><li>Arte</li></ul>');
});
