import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyRealtimeChange,preserveDirtySheet} from '../dist/realtime-cache.js';

test('INSERT and UPDATE append or replace exactly one matching realtime row',()=>{
 const first={id:'one',name:'Primeira'},second={id:'two',name:'Segunda'};
 const inserted=applyRealtimeChange([first],{eventType:'INSERT',new:second});
 assert.deepEqual(inserted.rows,[first,second]);
 const updated=applyRealtimeChange(inserted.rows,{eventType:'UPDATE',new:{id:'one',name:'Atualizada'}});
 assert.deepEqual(updated.rows,[{id:'one',name:'Atualizada'},second]);
 assert.equal(updated.rows.filter(row=>row.id==='one').length,1);
});

test('DELETE removes only the row named by old id',()=>{
 const result=applyRealtimeChange([{id:'one'},{id:'two'}],{eventType:'DELETE',old:{id:'one'}});
 assert.deepEqual(result.rows,[{id:'two'}]);
});

test('table settings use table_id as their realtime cache key',()=>{
 const result=applyRealtimeChange([{table_id:'mesa',level_up_policy:'gm_only'}],{eventType:'UPDATE',new:{table_id:'mesa',level_up_policy:'anyone'}},'table_id');
 assert.deepEqual(result.rows,[{table_id:'mesa',level_up_policy:'anyone'}]);
});

test('malformed payloads leave state unchanged and request recovery',()=>{
 const rows=[{id:'one'}];
 for(const payload of [{eventType:'UPDATE',new:{}},{eventType:'DELETE',old:null},{eventType:'UNKNOWN',new:{id:'one'}}]){
  const result=applyRealtimeChange(rows,payload);
  assert.equal(result.handled,false);assert.strictEqual(result.rows,rows);
 }
});

test('dirty or saving selected sheets survive remote updates',()=>{
 const local={id:'sheet',data:{history:'digitando'}};
 const remote={eventType:'UPDATE',new:{id:'sheet',data:{history:'remoto'}}};
 assert.strictEqual(preserveDirtySheet(local,remote,{dirty:true}),local);
 assert.strictEqual(preserveDirtySheet(local,remote,{saving:true}),local);
 assert.deepEqual(preserveDirtySheet(local,remote),remote.new);
});

test('performance refresh does not add persistent browser storage and clears memory on sign-out',()=>{
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/localStorage\s*\./);
 assert.match(source,/sheets:\[\]/);
 assert.match(source,/setInterval\(pollSceneState,30000\)/);
 assert.match(source,/table:'dnd_level_ups'\},changed/);
});
