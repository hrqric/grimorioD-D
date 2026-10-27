export const GOLD_THRESHOLDS=Object.freeze([10,10,10,25,35,40,55,70,70,100,110,120,120,120,150]);
export function goldThreshold(level){
 const value=Number(level);
 if(!Number.isInteger(value)||value<1)return GOLD_THRESHOLDS[0];
 if(value>=20)return 0;
 return GOLD_THRESHOLDS[Math.min(value,15)-1];
}
export function currencyProgress(wallet,level){
 const goal=goldThreshold(level),current=goal?Math.min(goal,Math.max(0,Number(wallet?.gold_progress)||0)):0;
 return {current,goal,remaining:Math.max(0,goal-current),percent:goal?Math.round(current/goal*100):100,ready:goal>0&&current>=goal};
}
export function validateCurrencyDistribution(totals,allocations){
 const coins=['cp','sp','gp'],cleanTotals={};
 for(const coin of coins){const value=Number(totals?.[coin]);if(!Number.isSafeInteger(value)||value<0)throw Error('Use somente totais inteiros e não negativos.');cleanTotals[coin]=value;}
 if(!Object.values(cleanTotals).some(Boolean))throw Error('Informe ao menos uma moeda para distribuir.');
 if(!Array.isArray(allocations)||!allocations.length||allocations.length>100)throw Error('Selecione de 1 a 100 personagens.');
 const seen=new Set(),sums={cp:0,sp:0,gp:0};
 const clean=allocations.map(allocation=>{
  if(!allocation?.sheet_id||seen.has(allocation.sheet_id))throw Error('Não repita personagens na mesma distribuição.');seen.add(allocation.sheet_id);
  const row={sheet_id:allocation.sheet_id};
  for(const coin of coins){const value=Number(allocation[coin]);if(!Number.isSafeInteger(value)||value<0)throw Error('Use somente parcelas inteiras e não negativas.');row[coin]=value;sums[coin]+=value;}
  if(!coins.some(coin=>row[coin]>0))throw Error('Cada personagem selecionado precisa receber alguma moeda.');
  return row;
 });
 if(coins.some(coin=>sums[coin]!==cleanTotals[coin]))throw Error('A soma das parcelas deve ser igual ao tesouro informado.');
 return {totals:cleanTotals,allocations:clean};
}
export function currencyGainMessage(allocation,ready=false){
 const parts=[['gp_amount','PO'],['sp_amount','PP'],['cp_amount','PC']].filter(([key])=>Number(allocation?.[key])>0).map(([key,label])=>`${Number(allocation[key])} ${label}`);
 return `Você recebeu ${parts.join(', ').replace(/, ([^,]*)$/,' e $1')}.${ready?' Meta de ouro alcançada.':''}`;
}
