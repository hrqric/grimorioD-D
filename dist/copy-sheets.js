export function copySheetName(name){return [...String(name||'')].slice(0,142).join('')+' (cópia)'}
export async function requestSheetCopy(db,sheet,name,isGm){
 if(!isGm||!sheet?.id)throw Error('Somente o mestre pode copiar fichas.');
 const clean=String(name??'').trim();
 if(!clean||[...clean].length>150)throw Error('Informe um nome entre 1 e 150 caracteres.');
 const {data,error}=await db.rpc('dnd_copy_sheet',{p_sheet_id:sheet.id,p_name:clean});
 if(error)throw error;
 return data;
}
