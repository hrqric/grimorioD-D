import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {goldThreshold,currencyProgress,validateCurrencyDistribution,currencyGainMessage} from '../dist/currency.js';

test('metas de ouro seguem a tabela e permanecem 150 do nível 15 ao 19',()=>{
 assert.deepEqual(Array.from({length:20},(_,i)=>goldThreshold(i+1)),[10,10,10,25,35,40,55,70,70,100,110,120,120,120,150,150,150,150,150,0]);
});
test('progresso limita excedente e sinaliza level-up sem carregar outra faixa',()=>{
 assert.deepEqual(currencyProgress({gold_progress:150},1),{current:10,goal:10,remaining:0,percent:100,ready:true});
 assert.deepEqual(currencyProgress({gold_progress:35},7),{current:35,goal:55,remaining:20,percent:64,ready:false});
});
test('distribuição aceita divisão desigual exata entre personagens',()=>{
 const result=validateCurrencyDistribution({cp:3,sp:0,gp:150},[
  {sheet_id:'a',cp:1,sp:0,gp:60},{sheet_id:'b',cp:1,sp:0,gp:50},{sheet_id:'c',cp:1,sp:0,gp:40}
 ]);
 assert.equal(result.allocations[0].gp,60);assert.equal(result.totals.gp,150);
});
test('distribuição recusa totais inexatos, repetição, fração e parcela vazia',()=>{
 assert.throws(()=>validateCurrencyDistribution({cp:0,sp:0,gp:150},[{sheet_id:'a',cp:0,sp:0,gp:149}]),/igual/);
 assert.throws(()=>validateCurrencyDistribution({cp:0,sp:0,gp:2},[{sheet_id:'a',cp:0,sp:0,gp:1},{sheet_id:'a',cp:0,sp:0,gp:1}]),/repita/);
 assert.throws(()=>validateCurrencyDistribution({cp:0,sp:0,gp:1.5},[{sheet_id:'a',cp:0,sp:0,gp:1.5}]),/inteiros/);
 assert.throws(()=>validateCurrencyDistribution({cp:1,sp:0,gp:0},[{sheet_id:'a',cp:0,sp:0,gp:0}]),/alguma moeda/);
});
test('notificação destaca ouro e avisa quando a meta é alcançada',()=>{
 assert.equal(currencyGainMessage({gp_amount:50,sp_amount:8,cp_amount:3},true),'Você recebeu 50 PO, 8 PP e 3 PC. Meta de ouro alcançada.');
});
test('migração restringe escrita, execução e integra ouro ao level-up',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261027152229_gm_currency_gold_progression.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.dnd_sheet_wallets.*from public,anon,authenticated/is);
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/Somente o mestre pode distribuir moedas/);
 assert.match(sql,/dnd_level_up_requires_gold/);
 assert.match(sql,/dnd_reset_gold_progress/);
});
