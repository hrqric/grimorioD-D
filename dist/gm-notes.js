export const emptyGmNote=sheet=>({sheet_id:sheet.id,table_id:sheet.table_id,background:'',notes:'',revision:0});

export function normalizeGmNote(value,sheet){
 if(!value)return emptyGmNote(sheet);
 if(value.sheet_id!==sheet.id||value.table_id!==sheet.table_id)throw Error('As anotações recebidas não pertencem a esta ficha.');
 return {...emptyGmNote(sheet),...value,background:String(value.background??''),notes:String(value.notes??''),revision:Number(value.revision)||0};
}

export function gmNoteError(error){
 const message=error?.message||'';
 if(message.includes('revision_conflict'))return 'Conflito de edição: este caderno mudou em outra tela. Copie suas alterações, feche e abra novamente antes de salvar.';
 if(message.includes('not_authorized'))return 'Somente o mestre desta mesa pode acessar este caderno.';
 return message||'Não foi possível salvar o caderno do mestre.';
}
