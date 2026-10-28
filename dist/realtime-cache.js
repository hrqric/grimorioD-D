export function applyRealtimeChange(rows,payload,key='id'){
 const current=Array.isArray(rows)?rows:[];
 const event=payload?.eventType;
 const row=event==='DELETE'?payload?.old:payload?.new;
 if(!['INSERT','UPDATE','DELETE'].includes(event)||!row||typeof row[key]!=='string'||!row[key])return{handled:false,rows:current};
 const index=current.findIndex(item=>item?.[key]===row[key]);
 if(event==='DELETE')return{handled:true,rows:index<0?current:current.filter(item=>item?.[key]!==row[key])};
 const next=[...current];
 if(index<0)next.push(row);else next[index]=row;
 return{handled:true,rows:next};
}

export function preserveDirtySheet(sheet,payload,{dirty=false,saving=false}={}){
 if(!sheet||dirty||saving)return sheet;
 const result=applyRealtimeChange([sheet],payload);
 if(!result.handled)return sheet;
 return result.rows[0]||null;
}
