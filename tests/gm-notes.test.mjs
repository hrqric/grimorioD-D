import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyGmNote,normalizeGmNote,gmNoteError} from '../dist/gm-notes.js';

const sheet={id:'sheet-1',table_id:'table-1'};

test('new GM notebook starts empty with revision zero',()=>{
 assert.deepEqual(emptyGmNote(sheet),{sheet_id:'sheet-1',table_id:'table-1',background:'',notes:'',revision:0});
});

test('GM notebook rejects a row from another sheet or table',()=>{
 assert.throws(()=>normalizeGmNote({sheet_id:'other',table_id:'table-1'},sheet),/não pertencem/);
 assert.throws(()=>normalizeGmNote({sheet_id:'sheet-1',table_id:'other'},sheet),/não pertencem/);
});

test('revision conflict remains visible and tells the GM how to recover',()=>{
 assert.match(gmNoteError({message:'revision_conflict'}),/Conflito de edição/);
 assert.match(gmNoteError({message:'revision_conflict'}),/Copie suas alterações/);
});

test('client renders notebook controls only behind the GM check and loads notes on demand',()=>{
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.match(source,/gm\(\)\?`<button class="notebook-button" data-gm-notes=/);
 assert.match(source,/if\(gm\(\)&&\$\('#access'\)\)/);
 assert.match(source,/openGmNotebook[\s\S]*from\('dnd_sheet_gm_notes'\)/);
 assert.doesNotMatch(source,/async function load\(\)[^{]*dnd_sheet_gm_notes/);
 assert.match(source,/p_expected_revision:note\.revision/);
});

test('migration protects notes with GM-only RLS and non-destructive backfill',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261023013000_sheet_gm_notes.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/using\(public\.dnd_is_gm\(table_id\)\)/i);
 assert.match(sql,/not exists\(select 1 from public\.dnd_sheet_gm_notes/i);
 assert.doesNotMatch(sql,/grant (?:insert|update|delete).*dnd_sheet_gm_notes to authenticated/i);
 assert.match(sql,/revision=p_expected_revision/i);
 assert.match(sql,/revision_conflict/);
});
