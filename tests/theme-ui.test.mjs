import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {THEMES} from '../dist/theme.js';
function fixture(){
 const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').split('window.addEventListener')[0].replace(/^import .*;\r?\n/gm,'');
 let change,close,fail=false;const applied=[],writes=[];const button={disabled:false},error={textContent:''},cancel={};
 const form={elements:{theme:{value:'roxo'}},addEventListener:(name,fn)=>{if(name==='change')change=fn},querySelector:()=>button};
 const dialog={innerHTML:'',querySelector:s=>s==='form'?form:s==='#theme-cancel'?cancel:error,addEventListener:(name,fn)=>{if(name==='close')close=fn},showModal(){},close(){close()}};
 const db={auth:{updateUser:async payload=>{writes.push(payload);return fail?{error:Error('falhou')}:{data:{user:{id:'one',user_metadata:{grimorio_theme:payload.data.grimorio_theme}}}}}}};
 const ctx=vm.createContext({createLatestRequestGate:()=>({}),THEMES,applyTheme:t=>applied.push(t),createClient:()=>db,document:{querySelector:s=>s==='#dialog'?dialog:null},console,setTimeout(){},clearTimeout(){},Object});
 vm.runInContext(source+'\nglobalThis.api={state,openThemeSettings};toast=()=>{};',ctx);ctx.api.state.user={id:'one',user_metadata:{grimorio_theme:'preto'}};ctx.api.openThemeSettings();return {api:ctx.api,form,cancel,applied,writes,error,change:()=>change(),setFail:()=>fail=true};
}
test('preview can be cancelled without writing account preference',()=>{const f=fixture();f.change();f.cancel.onclick();assert.deepEqual(f.applied,['roxo','preto']);assert.equal(f.writes.length,0)});
test('saving persists the selected theme and restores it after closing',async()=>{const f=fixture();await f.form.onsubmit({preventDefault(){}});assert.equal(f.writes[0].data.grimorio_theme,'roxo');assert.equal(f.api.state.user.user_metadata.grimorio_theme,'roxo');assert.deepEqual(f.applied,['roxo','roxo'])});
test('failure remains visible and does not overwrite the account preference',async()=>{const f=fixture();f.setFail();await f.form.onsubmit({preventDefault(){}});assert.equal(f.error.textContent,'falhou');assert.equal(f.api.state.user.user_metadata.grimorio_theme,'preto')});

test('personalization is accessible from the main navigation',()=>{const source=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');assert.match(source,/<nav aria-label="Navegação principal">[\s\S]*?<button id="theme-settings">[^<]*Personalizar<\/button>[\s\S]*?<\/nav>/);assert.doesNotMatch(source,/<header class="topbar">[^`]*id="theme-settings"/)});
