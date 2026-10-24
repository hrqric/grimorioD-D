// Local PostgreSQL only, no network or production credentials.
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
if(!process.env.PGLITE_MODULE)throw Error('Set PGLITE_MODULE to installed @electric-sql/pglite/dist/index.js');
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
try{
 await db.exec(read('tests/fixtures/homebrew-base.sql'));
 for(const f of readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(f=>f<'20261011070000'))
  await db.exec(read('supabase/migrations/'+f).replace('create extension if not exists pgcrypto;',''));
 await db.exec(read('supabase/migrations/20261023120000_copy_sheets.sql'));
 await db.exec(read('tests/copy-sheets.sql'));
 console.log('copy_preserves, copy_denied, copy_invalid, copy_atomic, copy_level_guard: passed (rolled back)');
}finally{await db.close()}
