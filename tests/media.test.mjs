import test from 'node:test';import assert from 'node:assert/strict';
import {validateMedia,mediaPath} from '../dist/media.js';
test('validates media MIME and limits',()=>{assert.equal(validateMedia({type:'image/jpeg',size:100},'portrait'),'jpg');assert.throws(()=>validateMedia({type:'image/svg+xml',size:100},'portrait'),/JPEG/);assert.throws(()=>validateMedia({type:'image/png',size:6*1024*1024},'portrait'),/5 MB/)});
test('uses scoped opaque paths',()=>{assert.equal(mediaPath('portrait','t','s','a','webp'),'t/s/a.webp');assert.equal(mediaPath('map','t',null,'a','png'),'t/a.png')});
