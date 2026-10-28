import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to @electric-sql/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite(),root=path.resolve(import.meta.dirname,'..'),read=p=>readFileSync(path.join(root,p),'utf8');
try{
 await db.exec(read('tests/fixtures/homebrew-base.sql'));
 for(const f of readdirSync(path.join(root,'supabase/migrations')).filter(f=>f<'20261011070000')) await db.exec(read('supabase/migrations/'+f).replace('create extension if not exists pgcrypto;',''));
 const media=read('supabase/migrations/20261011070000_table_media.sql');
 await db.exec(media.slice(media.indexOf('create or replace function public.dnd_is_table_member'),media.indexOf('create policy "members read media"')));
 await db.exec(read('supabase/migrations/20261019120000_table_homebrew_classes.sql'));
 await db.exec(read('supabase/migrations/20261028132645_table_spells.sql'));
 await db.exec(read('tests/table-spells.sql'));
 console.log('Table spells SQL checks passed (fixtures rolled back).');
}finally{await db.close()}
