const heroes=[
 {id:'yuri',name:'Yuri Kenpachi',level:7,current:35,goal:55,cp:18,sp:12,gp:84},
 {id:'kel',name:'Kel Thuzad',level:5,current:12,goal:35,cp:4,sp:20,gp:37},
 {id:'glx',name:'Glx',level:3,current:4,goal:10,cp:25,sp:5,gp:19},
 {id:'samurai',name:'Samurai',level:9,current:58,goal:70,cp:0,sp:7,gp:102},
 {id:'cillian',name:'Cillian Liel',level:4,current:8,goal:25,cp:9,sp:14,gp:28}
];
const $=selector=>document.querySelector(selector);
const money=(hero,key)=>`${hero[key]} ${key.toUpperCase()}`;
function drawParty(){
 $('#party').innerHTML=heroes.map(hero=>{
  const ready=hero.current>=hero.goal,percent=Math.min(100,hero.current/hero.goal*100);
  return `<article class="hero"><div class="hero-head"><div><span class="hero-level">NÍVEL ${hero.level}</span><h3>${hero.name}</h3></div><button data-open-sheet="${hero.id}">Ver ficha</button></div><p class="${ready?'ready':''}">${ready?'Meta alcançada — level-up disponível':`Faltam ${hero.goal-hero.current} PO para o nível ${hero.level+1}`}</p><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${hero.goal}" aria-valuenow="${hero.current}"><i style="width:${percent}%"></i></div><div class="mini-wallet"><span><b>${hero.cp}</b> PC</span><span><b>${hero.sp}</b> PP</span><span><b>${hero.gp}</b> PO</span></div></article>`;
 }).join('');
 document.querySelectorAll('[data-open-sheet]').forEach(button=>button.onclick=()=>openSheet(button.dataset.openSheet));
}
function drawRows(){
 $('#distribution-rows').innerHTML=heroes.map(hero=>`<div class="distribution-row" data-hero="${hero.id}"><label><input type="checkbox">${hero.name}</label><input data-coin="cp" type="number" min="0" step="1" value="0" disabled><input data-coin="sp" type="number" min="0" step="1" value="0" disabled><input data-coin="gp" type="number" min="0" step="1" value="0" disabled></div>`).join('');
 document.querySelectorAll('.distribution-row input').forEach(input=>input.oninput=()=>{if(input.type==='checkbox')input.closest('.distribution-row').querySelectorAll('[data-coin]').forEach(field=>field.disabled=!input.checked);calculate()});
}
function calculate(){
 const totals={cp:Number($('#total-cp').value),sp:Number($('#total-sp').value),gp:Number($('#total-gp').value)},used={cp:0,sp:0,gp:0};let invalid=false;
 document.querySelectorAll('.distribution-row').forEach(row=>{if(!row.querySelector('[type=checkbox]').checked)return;row.querySelectorAll('[data-coin]').forEach(input=>{const value=Number(input.value);if(!Number.isInteger(value)||value<0)invalid=true;else used[input.dataset.coin]+=value})});
 const left={cp:totals.cp-used.cp,sp:totals.sp-used.sp,gp:totals.gp-used.gp};
 if(Object.values(totals).some(value=>!Number.isInteger(value)||value<0))invalid=true;
 $('#remaining').innerHTML=`Restante: <strong>${left.cp} PC · ${left.sp} PP · ${left.gp} PO</strong>`;
 $('#error').textContent=invalid?'Use somente moedas inteiras e não negativas.':Object.values(left).some(value=>value<0)?'A divisão ultrapassa o tesouro informado.':'';
 return {left,invalid:invalid||Object.values(left).some(value=>value!==0)};
}
function openSheet(id){
 const hero=heroes.find(item=>item.id===id),percent=Math.min(100,hero.current/hero.goal*100);
 $('#sheet-name').textContent=hero.name;$('#sheet-level').textContent=hero.level;$('#sheet-current').textContent=hero.current;$('#sheet-goal').textContent=hero.goal;$('#wallet-cp').textContent=hero.cp;$('#wallet-sp').textContent=hero.sp;$('#wallet-gp').textContent=hero.gp;$('#sheet-bar').style.width=`${percent}%`;$('#sheet-message').textContent=hero.current>=hero.goal?'Ouro necessário alcançado — concluir subida de nível':`Faltam ${hero.goal-hero.current} PO para o nível ${hero.level+1}`;showPage('sheets');
}
function showPage(page){$('#progress-page').hidden=page!=='progress';$('#sheets-page').hidden=page!=='sheets';document.querySelectorAll('[data-page]').forEach(button=>button.classList.toggle('active',button.dataset.page===page))}
function toast(message){const element=$('#toast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),5000)}
drawParty();drawRows();calculate();
document.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>showPage(button.dataset.page));
['#total-cp','#total-sp','#total-gp'].forEach(id=>$(id).oninput=calculate);
$('#open-distribution').onclick=()=>$('#distribution').showModal();
$('#equal').onclick=()=>{const selected=[...document.querySelectorAll('.distribution-row')].filter(row=>row.querySelector('[type=checkbox]').checked);if(!selected.length)return toast('Selecione pelo menos um personagem.');const total=Number($('#total-gp').value),base=Math.floor(total/selected.length);selected.forEach((row,index)=>row.querySelector('[data-coin=gp]').value=base+(index===0?total-base*selected.length:0));calculate()};
$('#confirm').onclick=()=>{const result=calculate();if(result.invalid){$('#error').textContent=$('#error').textContent||'Distribua todo o tesouro antes de confirmar.';return}const received=[];document.querySelectorAll('.distribution-row').forEach(row=>{if(!row.querySelector('[type=checkbox]').checked)return;const hero=heroes.find(item=>item.id===row.dataset.hero),values={};row.querySelectorAll('[data-coin]').forEach(input=>values[input.dataset.coin]=Number(input.value));hero.cp+=values.cp;hero.sp+=values.sp;hero.gp+=values.gp;hero.current=Math.min(hero.goal,hero.current+values.gp);if(values.cp||values.sp||values.gp)received.push(`${hero.name}: ${values.cp} PC, ${values.sp} PP e ${values.gp} PO`)});$('#distribution').close();drawParty();toast(`Distribuição concluída. ${received.join(' · ')}`)};
$('#role').onclick=()=>{const player=document.body.classList.toggle('player');document.querySelectorAll('.gm-only').forEach(element=>element.hidden=player);$('#role-label').textContent=player?'Visão do jogador':'Visão do mestre';$('#role').textContent=player?'Ver como mestre':'Ver como jogador';toast(player?'Você recebeu 50 PO. Seu progresso foi atualizado.':'Controles do mestre restaurados.')};
