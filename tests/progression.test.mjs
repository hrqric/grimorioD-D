import test from 'node:test';
import assert from 'node:assert/strict';
import {findClass,classReviewState,characterProgression,levelFeatures} from '../dist/progression.js';
const classes=[{id:'wizard',name:'Mago'},{id:'fighter',name:'Guerreiro'}];
const sheet={id:'sheet',data:{class:'  MAGO ',level:2}};
test('reconhece apenas nomes de catálogo, ignorando caixa e espaços',()=>{
 assert.equal(findClass(sheet,classes).id,'wizard');
 assert.equal(classReviewState({...sheet,data:{class:'Mage'}},classes),'pending');
 assert.equal(classReviewState({...sheet,data:{}},classes),'empty');
});
test('aprovação personalizada vale somente para o nome avaliado',()=>{
 const data={class:'Artífice',class_review:{decision:'keep',name:'Artífice'}};
 assert.equal(classReviewState({...sheet,data},classes),'approved');
 assert.equal(classReviewState({...sheet,data:{...data,class:'Outro'}},classes),'pending');
});
test('ficha legada conhecida recebe o nível atual sem atribuir subclasse textual',()=>{
 const [p]=characterProgression({...sheet,data:{...sheet.data,subclass:'Evocador'}},classes,[]);
 assert.equal(p.class_level,2);assert.equal(p.subclass_id,null);
});
test('progressão usa nível da classe, nunca nível total ou pedido pendente',()=>{
 const links=[{sheet_id:'sheet',class_id:'wizard',class_level:3,subclass_id:'evoker'}, {sheet_id:'sheet',class_id:'fighter',class_level:1}, {sheet_id:'other',class_id:'wizard',class_level:20}];
 const p=characterProgression({...sheet,data:{class:'Mago',level:4}},classes,links);
 assert.deepEqual(p.map(x=>x.class_level),[3,1]);
});
test('filtra por classe, nível e subclasse e não retorna descrições',()=>{
 const rules=[
 {id:1,name:'Mago 3',summary:'descrição longa',content:'conteúdo',metadata:{class_id:'wizard',level:3,grant:'class',features_text:'Subclasse',resources_text:'Espaços: 1º(4)'}},
 {id:2,name:'Evocação',metadata:{class_id:'wizard',subclass_id:'evoker',level:3,grant:'subclass'}},
 {id:3,name:'Outra',metadata:{class_id:'wizard',subclass_id:'other',level:3,grant:'subclass'}},
 {id:4,name:'Futuro',metadata:{class_id:'wizard',level:4,grant:'class'}},
 {id:5,name:'Guerreiro',metadata:{class_id:'fighter',level:3,grant:'class'}}];
 assert.deepEqual(levelFeatures(rules,'wizard',null,3).map(x=>x.id),[1]);
 const result=levelFeatures(rules,'wizard','evoker',3);
 assert.deepEqual(result.map(x=>x.id),[1,2]);
 assert.equal(result[0].resources,'Espaços: 1º(4)');
 assert.equal(JSON.stringify(result).includes('descrição longa'),false);
});
