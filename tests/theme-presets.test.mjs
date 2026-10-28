import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { THEMES, resolveTheme, applyTheme } from '../dist/theme.js';
test('six requested themes and the original are available',()=>{assert.deepEqual(Object.keys(THEMES),['original','cyberpunk','preto','branco','roxo','vermelho','neon']);assert.equal(resolveTheme('missing'),THEMES.original)});
test('white theme uses dark text and light surfaces; dark themes keep light text',()=>{assert.equal(THEMES.branco.ink,'#171717');for(const id of ['preto','roxo','vermelho','neon','cyberpunk'])assert.notEqual(THEMES[id].ink,THEMES.branco.ink)});
test('applying a theme updates all primary colors and themed surfaces',()=>{const values=new Map();let root={style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};applyTheme('branco',root);assert.equal(values.get('--bg'),THEMES.branco.bg);assert.equal(values.get('--ink'),THEMES.branco.ink);assert.match(values.get('--surface-171e18'),/var\(--panel\)/);applyTheme('original',root);assert.equal(values.has('--surface-171e18'),false)});
