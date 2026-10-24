import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copySheetName,requestSheetCopy} from '../dist/copy-sheets.js';
test('copy default name fits 150 characters including Unicode',()=>{
 assert.equal(copySheetName('Mago'),'Mago (cópia)');assert.equal([...copySheetName('🐉'.repeat(160))].length,150);
});
test('copy refuses player and invalid names before contacting database',async()=>{
 const db={rpc:()=>{throw Error('unexpected RPC')}};
 await assert.rejects(requestSheetCopy(db,{id:'s'},'Cópia',false),/Somente o mestre/);
 for(const name of ['', '  ', 'x'.repeat(151)])await assert.rejects(requestSheetCopy(db,{id:'s'},name,true),/1 e 150/);
});
test('copy calls authorized RPC and propagates persistence failure',async()=>{
 const sheet={id:'s'},saved={id:'new'};let args;
 const db={rpc:async(...a)=>{args=a;return {data:saved}}};
 assert.equal(await requestSheetCopy(db,sheet,' Cópia ',true),saved);
 assert.deepEqual(args,['dnd_copy_sheet',{p_sheet_id:'s',p_name:'Cópia'}]);
 await assert.rejects(requestSheetCopy({rpc:async()=>({error:Error('negado')})},sheet,'Cópia',true),/negado/);
});
test('copy UI is restricted to GM and failure remains in modal',()=>{
 const app=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(app,/gm\(\)\?`<button data-copy-sheet=/);
 assert.match(app,/requestSheetCopy\(db,sheet,f.get\('name'\),gm\(\)\)/);
 assert.match(app,/if\(b.disabled\)return/);assert.match(app,/\$\('#modal-error'\).textContent=err.message/);
});
