import test from 'node:test';
import assert from 'node:assert/strict';
import {sceneHistoryForTable,createLatestRequestGate,historyOrPrevious} from '../dist/scenes.js';

test('projects only visible entries for one table in newest-first order',()=>{
 const entries=[
  {id:'old',table_id:'t',title:'Primeira',created_at:'2026-10-10T10:00:00Z',removed_at:null},
  {id:'other',table_id:'other',title:'Outra',created_at:'2026-10-13T10:00:00Z',removed_at:null},
  {id:'removed',table_id:'t',title:'Removida',created_at:'2026-10-12T10:00:00Z',removed_at:'2026-10-13T10:00:00Z'},
  {id:'new',table_id:'t',title:null,created_at:'2026-10-11T10:00:00Z',removed_at:null}
 ];
 assert.deepEqual(sceneHistoryForTable(entries,'t').map(entry=>entry.id),['new','old']);
});

test('normalizes blank optional titles without mutating source entries',()=>{
 const entries=[{id:'scene',table_id:'t',title:'   ',created_at:'2026-10-11T10:00:00Z',removed_at:null}];
 const projected=sceneHistoryForTable(entries,'t');
 assert.equal(projected[0].title,null);
 assert.equal(entries[0].title,'   ');
});

test('latest request gate rejects a stale history response',()=>{
 const gate=createLatestRequestGate(),older=gate.begin(),newer=gate.begin();
 assert.equal(gate.isLatest(newer),true);
 assert.equal(gate.isLatest(older),false);
});

test('history-only load failure preserves cached entries instead of rejecting',async()=>{
 const cached=[{id:'cached'}];
 const result=await historyOrPrevious(Promise.reject(Error('offline')),cached);
 assert.equal(result.entries,cached);
 assert.match(result.error,/histórico/i);
});
