const norm = x => String(x || '').trim().toLocaleLowerCase('pt-BR');
export function sheetClassNames(sheet, classes, characterClasses) {
  const linked=(characterClasses||[]).filter(c=>c.sheet_id===sheet.id).map(c=>(classes||[]).find(x=>x.id===c.class_id)?.name).filter(Boolean);
  return [...new Set([...linked, sheet.data?.class].filter(Boolean).map(norm))];
}
export function sheetSpellCatalog(sheet, classes, characterClasses, rules, tableSpells) {
  const names=sheetClassNames(sheet,classes,characterClasses), active=(classes||[]).filter(c=>names.includes(norm(c.name)));
  const matches=m=>[...(Array.isArray(m?.classes)?m.classes:[]),m?.class_name].some(n=>(names.includes(norm(n))&&norm(n))||active.some(c=>c.id===n)) || active.some(c=>(m?.class_id&&m.class_id===c.id)||(m?.class_slug&&m.class_slug===c.slug));
  const official=(rules||[]).filter(r=>r.kind==='spell'&&r.id&&matches(r.metadata)).map(r=>({key:`official:${r.id}`,name:r.name,level:Number.isInteger(r.metadata?.spell_level)?r.metadata.spell_level:null,description:r.content||r.summary||'',summary:r.summary||''}));
  const custom=(tableSpells||[]).filter(r=>r.table_id===sheet.table_id&&r.status==='approved'&&r.id&&matches(r)).map(r=>({key:`table:${r.id}`,name:r.name,level:Number.isInteger(r.spell_level)?r.spell_level:null,description:r.description||'',summary:r.summary||''}));
  return [...official,...custom].sort((a,b)=>(a.level??99)-(b.level??99)||String(a.name).localeCompare(String(b.name),'pt-BR'));
}
export function selectedSpells(data) {
  return Array.isArray(data?.prepared_spells)?data.prepared_spells.filter(x=>x&&typeof x.key==='string'&&typeof x.name==='string'):[];
}
export function togglePreparedSpell(data, spell) {
  const previous=selectedSpells(data), exists=previous.some(x=>x.key===spell.key);
  data.prepared_spells=exists?previous.filter(x=>x.key!==spell.key):[...previous,{key:spell.key,name:spell.name}];
  return !exists;
}

export function preparedSpellsPrintHtml(data) {
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const spells=selectedSpells(data);
  return spells.length?'<ul>'+spells.map(spell=>'<li>'+escape(spell.name)+'</li>').join('')+'</ul>':'<p>Nenhuma magia selecionada.</p>';
}
