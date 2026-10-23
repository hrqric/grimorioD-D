import test from 'node:test';
import assert from 'node:assert/strict';
import * as p from '../dist/progression.js';
const catalog=[{id:'w',name:'Mago'},{id:'p1',name:'Pirata',table_id:'t1',hit_die:10,subclass_level:3},{id:'p2',name:'Pirata',table_id:'t2',hit_die:8,subclass_level:2}];
const input={name:' Pirata ',description:' No mar ',hit_die:10,subclass_level:3,subclasses:[{name:' Corsário ',description:''}]};
test('table catalog contains globals and only the chosen table homebrew',()=>{
 assert.deepEqual(p.classesForTable(catalog,'t1').map(x=>x.id),['w','p1']);
 assert.deepEqual(p.classesForTable(catalog,'t2').map(x=>x.id),['w','p2']);
 assert.deepEqual(p.classesForTable(catalog,null).map(x=>x.id),['w']);
 assert.equal(p.findClass({table_id:'t2',data:{class:' PIRATA '}},catalog).id,'p2');
 assert.equal(p.findClass({table_id:'t3',data:{class:'Pirata'}},catalog),undefined);
});
test('table progression never resolves a foreign class link or legacy name',()=>{
 const sheet={id:'s',table_id:'t2',data:{class:'Pirata',level:1}};
 assert.equal(p.characterProgression(sheet,catalog,[])[0].catalog.id,'p2');
 assert.equal(p.characterProgression(sheet,catalog,[{sheet_id:'s',class_id:'p1',class_level:1}],[]).length,0);
 assert.equal(p.classReviewState({...sheet,table_id:'t3'},catalog),'pending');
});
test('homebrew validation trims values and accepts the allowed hit dice and boundary levels',()=>{
 for(const die of [6,8,10,12])for(const level of [1,20]){
  const value=p.validateHomebrewClass({...input,hit_die:die,subclass_level:level},catalog,'t3');
  assert.equal(value.name,'Pirata');assert.equal(value.description,'No mar');
  assert.equal(value.hit_die,die);assert.equal(value.subclasses[0].name,'Corsário');
 }
});
test('homebrew validation rejects each invalid input and same-table or global duplicates',()=>{
 for(const invalid of [{name:' '},{name:'x'.repeat(101)},{description:'x'.repeat(5001)},{hit_die:4},{hit_die:NaN},{subclass_level:0},{subclass_level:21},{subclass_level:1.5},{subclasses:[]},{subclasses:[{name:' '}]},{subclasses:[{name:'x'.repeat(101)}]},{subclasses:[{name:'A',description:'x'.repeat(5001)}]},{subclasses:[{name:'A'},{name:' a '}]},{subclasses:null}]){
  assert.throws(()=>p.validateHomebrewClass({...input,...invalid},catalog,'t3'),JSON.stringify(invalid));
 }
 assert.throws(()=>p.validateHomebrewClass(input,catalog,'t1'),/existe/i);
 assert.throws(()=>p.validateHomebrewClass({...input,name:'mago'},catalog,'t3'),/existe/i);
 assert.doesNotThrow(()=>p.validateHomebrewClass(input,catalog,'t3'));
});
