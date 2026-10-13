export function sceneHistoryForTable(entries,tableId){
 return (entries||[])
  .filter(entry=>entry.table_id===tableId&&!entry.removed_at)
  .map(entry=>({...entry,title:entry.title?.trim()||null}))
  .sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
}

export function createLatestRequestGate(){
 let latest=0;
 return {begin:()=>++latest,isLatest:request=>request===latest};
}

export async function historyOrPrevious(promise,previous){
 try{return{entries:await promise,error:''}}
 catch{return{entries:previous,error:'Não foi possível atualizar o histórico. Tente novamente.'}}
}
