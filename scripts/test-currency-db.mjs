// Optional isolated PostgreSQL verification. No network or production credentials.
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite(),root=path.resolve(import.meta.dirname,'..'),read=p=>readFileSync(path.join(root,p),'utf8');
try{
 await db.exec(read('tests/fixtures/homebrew-base.sql'));
 for(const file of readdirSync(path.join(root,'supabase/migrations')).filter(file=>file<'20261011070000'))
  await db.exec(read('supabase/migrations/'+file).replace('create extension if not exists pgcrypto;',''));
 const media=read('supabase/migrations/20261011070000_table_media.sql');
 await db.exec(media.slice(media.indexOf('create or replace function public.dnd_is_table_member'),media.indexOf('create policy "members read media"')));
 await db.exec(read('supabase/migrations/20261023120000_copy_sheets.sql'));
 await db.exec(read('supabase/migrations/20261027152229_gm_currency_gold_progression.sql'));
 await db.exec(read('tests/currency.sql'));
 console.log('currency SQL checks passed (all fixtures rolled back)');
}finally{await db.close()}
