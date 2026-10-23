// Optional isolated SQL verification. No connection string or production access.
// PGLITE_MODULE points to an externally installed @electric-sql/pglite module.
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const root=path.resolve(import.meta.dirname,'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
try{
 await db.exec(read('tests/fixtures/homebrew-base.sql'));
 const migrations=readdirSync(path.join(root,'supabase/migrations')).filter(f=>f<'20261011070000');
 for(const file of migrations){
  // PostgreSQL core supplies gen_random_uuid; PGlite does not bundle pgcrypto.
  await db.exec(read('supabase/migrations/'+file).replace('create extension if not exists pgcrypto;',''));
 }
 const media=read('supabase/migrations/20261011070000_table_media.sql');
 await db.exec(media.slice(media.indexOf('create or replace function public.dnd_is_table_member'),media.indexOf('create policy "members read media"')));
 await db.exec(read('supabase/migrations/20261019120000_table_homebrew_classes.sql'));
 for(const file of ['homebrew.sql','class-review.sql']){
  await db.exec(read('tests/'+file));console.log(file+': passed (rolled back)');
 }
 console.log('Local PostgreSQL checks passed; original core schema is simulated by tests/fixtures/homebrew-base.sql.');
}finally{await db.close();}
