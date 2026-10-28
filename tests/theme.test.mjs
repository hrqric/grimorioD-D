import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeTheme, DEFAULT_THEME } from '../dist/theme.js';
test('preserves valid account colors and defaults invalid values', () => {
 assert.deepEqual(normalizeTheme({bg:'#123456',panel:'#abcdef',gold:'#987654'}), {bg:'#123456',panel:'#abcdef',gold:'#987654'});
 assert.deepEqual(normalizeTheme({bg:'red',panel:'url(x)',gold:null}), DEFAULT_THEME);
 assert.deepEqual(normalizeTheme(null), DEFAULT_THEME);
});
