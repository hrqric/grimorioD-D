import test from 'node:test';
import assert from 'node:assert/strict';
import {findClass,classReviewState,characterProgression,levelFeatures,existingSubclass,classLevelLabel,proficiencyBonus,catalogConditions,activeConditions,updateActiveCondition,conditionVisual} from '../dist/progression.js';
const classes=[{id:'wizard',name:'Mago'},{id:'fighter',name:'Guerreiro'}];
const sheet={id:'sheet',data:{class:'  MAGO ',level:2}};
test('bônus de proficiência segue as faixas do nível total de 1 a 20',()=>{
 const expected=[2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6];
 assert.deepEqual(expected.map((_,index)=>proficiencyBonus(index+1)),expected);
});
test('condições ativas usam somente opções válidas do glossário',()=>{
 const rules=[
  {kind:'condition',slug:'condition-cego',name:'Cego'},
  {kind:'condition',slug:'condition-caido',name:'Caído'},
  {kind:'spell',slug:'spell-luz',name:'Luz'}
 ];
 assert.deepEqual(catalogConditions(rules).map(x=>x.slug),['condition-caido','condition-cego']);
 assert.deepEqual(activeConditions({data:{active_conditions:['condition-cego','condition-inexistente','condition-cego']}},rules).map(x=>x.slug),['condition-cego']);
});
test('marcar e desmarcar condição preserva as demais sem duplicar',()=>{
 const rules=[{kind:'condition',slug:'condition-cego',name:'Cego'},{kind:'condition',slug:'condition-caido',name:'Caído'}];
 const data={active_conditions:['condition-cego']};
 updateActiveCondition(data,'condition-caido',true,rules);
 updateActiveCondition(data,'condition-caido',true,rules);
 assert.deepEqual(data.active_conditions,['condition-cego','condition-caido']);
 updateActiveCondition(data,'condition-cego',false,rules);
 assert.deepEqual(data.active_conditions,['condition-caido']);
 assert.throws(()=>updateActiveCondition(data,'condition-falsa',true,rules),/Condição inválida/);
});
test('cada condição do glossário recebe um símbolo mnemônico e uma identidade cromática',()=>{
 const slugs=['condition-amedrontado','condition-agarrado','condition-acorrentado-imobilizado','condition-caido','condition-cego','condition-enfeiticado','condition-envenenado','condition-incapacitado','condition-inconsciente','condition-invisivel','condition-paralisado','condition-petrificado','condition-surdo','condition-exaustao'];
 const visuals=slugs.map(conditionVisual);
 assert.equal(new Set(visuals.map(x=>x.icon)).size,14);
 assert.ok(new Set(visuals.map(x=>x.tone)).size>=6);
 assert.deepEqual(conditionVisual('condition-cego'),{icon:'◉',tone:'sight'});
 assert.deepEqual(conditionVisual('condition-envenenado'),{icon:'☠',tone:'poison'});
 assert.deepEqual(conditionVisual('condition-inconsciente'),{icon:'☾',tone:'sleep'});
});
test('nível atual e próximo ficam explícitos: sistema começa em 1',()=>{
 assert.equal(classLevelLabel('Druida',1),'Druida · nível atual 1 → próximo 2');
 assert.equal(classLevelLabel('Guerreiro',4),'Guerreiro · nível atual 4 → próximo 5');
});
test('subclasse legada reconhece caixa e espaços, mantendo classe e nível',()=>{
 const c={id:'fighter',name:'Guerreiro',subclass_level:3};
 const s={id:'s',data:{class:'Guerreiro',subclass:'Cavaleiro místico ',level:4}};
 const subs=[{id:'ek',class_id:'fighter',name:'Cavaleiro Místico'}];
 assert.equal(existingSubclass(s,c,null,subs,4).id,'ek');
 const p=characterProgression(s,[c],[],subs)[0];
 assert.equal(p.class_level,4);assert.equal(p.subclass_id,'ek');
 assert.equal(existingSubclass(s,c,null,subs,2).unresolved,true);
 assert.equal(existingSubclass(s,c,null,[{...subs[0],class_id:'wizard'}],4).unresolved,true);
 assert.equal(existingSubclass(s,c,{subclass_id:'fixed'},subs,4).id,'fixed');
});
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
