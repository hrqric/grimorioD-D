import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { applyTheme, DEFAULT_THEME } from '../dist/theme.js';
test('custom palette also colors fixed surfaces and restoring defaults removes overrides', () => {
 const values = new Map(); const root={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
 applyTheme({bg:'#240024',panel:'#590059',gold:'#ffaa00'},root);
 for (const color of ['171e18','2b3226','121711','28352b']) assert.match(values.get('--surface-'+color) || '', /var\(--panel\)/);
 applyTheme(DEFAULT_THEME,root);
 assert.equal(values.has('--surface-171e18'),false);
 for (const [file,color] of [['ux.css','171e18'],['ux.css','2b3226'],['style.css','121711']]) assert.ok(readFileSync(new URL('../dist/'+file,import.meta.url),'utf8').includes('var(--surface-'+color+','));
});
