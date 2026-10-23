// Pure catalog projections: pending requests never change acquired levels.
export const normalizeClassName = value => String(value || '').trim().toLocaleLowerCase('pt-BR');
export const classesForTable = (classes, tableId) => classes.filter(c => c.table_id == null || (tableId && c.table_id === tableId));
export function validateHomebrewClass(input, classes=[], tableId=null) {
  const text=(value,label,max)=>{if(typeof value!=='string'||value.trim().length>max)throw Error(`${label}: máximo de ${max} caracteres.`);return value.trim();};
  const name=text(input.name,'Nome',100),description=text(input.description??'','Descrição',5000);
  if(!name)throw Error('Informe o nome da classe.');
  if(classesForTable(classes,tableId).some(c=>normalizeClassName(c.name)===normalizeClassName(name)))throw Error('Já existe uma classe com este nome nesta mesa.');
  const hit_die=Number(input.hit_die),subclass_level=Number(input.subclass_level);
  if(![6,8,10,12].includes(hit_die))throw Error('Selecione um dado de vida: d6, d8, d10 ou d12.');
  if(!Number.isInteger(subclass_level)||subclass_level<1||subclass_level>20)throw Error('O nível de subclasse deve estar entre 1 e 20.');
  if(!Array.isArray(input.subclasses)||input.subclasses.length<1||input.subclasses.length>100)throw Error('Cadastre de 1 a 100 subclasses.');
  const seen=new Set();
  const subclasses=input.subclasses.map(s=>{
    const name=text(s?.name,'Nome da subclasse',100),description=text(s?.description??'','Descrição da subclasse',5000),key=normalizeClassName(name);
    if(!name)throw Error('Informe o nome de cada subclasse.');
    if(seen.has(key))throw Error('Não repita nomes de subclasses.');
    seen.add(key);return {name,description};
  });
  return {name,description,hit_die,subclass_level,subclasses};
}
export const proficiencyBonus = level => 2 + Math.floor((Math.min(20,Math.max(1,Number(level)||1))-1)/4);
const conditionVisuals={
  'condition-amedrontado':{icon:'!',tone:'fear'},
  'condition-agarrado':{icon:'≋',tone:'restraint'},
  'condition-acorrentado-imobilizado':{icon:'⊠',tone:'restraint'},
  'condition-caido':{icon:'↘',tone:'impact'},
  'condition-cego':{icon:'◉',tone:'sight'},
  'condition-enfeiticado':{icon:'♥',tone:'charm'},
  'condition-envenenado':{icon:'☠',tone:'poison'},
  'condition-incapacitado':{icon:'×',tone:'disabled'},
  'condition-inconsciente':{icon:'☾',tone:'sleep'},
  'condition-invisivel':{icon:'◇',tone:'arcane'},
  'condition-paralisado':{icon:'║',tone:'disabled'},
  'condition-petrificado':{icon:'◆',tone:'stone'},
  'condition-surdo':{icon:'∿',tone:'sound'},
  'condition-exaustao':{icon:'−',tone:'fatigue'}
};
export const conditionVisual = slug => conditionVisuals[slug] || {icon:'?',tone:'neutral'};
const conditionTonePriority={disabled:100,sleep:95,stone:90,restraint:80,poison:70,fatigue:65,fear:60,charm:55,sight:50,sound:45,impact:40,arcane:30,neutral:0};
export const dominantCondition = conditions => (conditions||[]).reduce((dominant,condition)=>conditionTonePriority[conditionVisual(condition.slug).tone]>conditionTonePriority[conditionVisual(dominant?.slug).tone]?condition:dominant,null);
export function catalogConditions(rules) {
  return rules.filter(r => r.kind === 'condition' && r.slug && r.name).sort((a,b) => a.name.localeCompare(b.name,'pt-BR'));
}
export function activeConditions(sheet, rules) {
  const active = new Set(Array.isArray(sheet?.data?.active_conditions) ? sheet.data.active_conditions : []);
  return catalogConditions(rules).filter(condition => active.has(condition.slug));
}
export function updateActiveCondition(data, slug, checked, rules) {
  const allowed = new Set(catalogConditions(rules).map(condition => condition.slug));
  if (!allowed.has(slug)) throw Error('Condição inválida.');
  const active = [...new Set(Array.isArray(data.active_conditions) ? data.active_conditions.filter(item => allowed.has(item)) : [])];
  data.active_conditions = checked ? [...active.filter(item => item !== slug),slug] : active.filter(item => item !== slug);
  return data.active_conditions;
}
export function findClass(sheet, classes) {
  return classesForTable(classes,sheet.table_id).find(c => normalizeClassName(c.name) === normalizeClassName(sheet.data.class));
}
export function classReviewState(sheet, classes) {
  if (!normalizeClassName(sheet.data.class)) return 'empty';
  if (findClass(sheet, classes)) return 'known';
  const review = sheet.data.class_review;
  return review?.decision === 'keep' && review.name === sheet.data.class ? 'approved' : 'pending';
}
export function existingSubclass(sheet, catalog, link, subclasses, level) {
  if (link?.subclass_id) return {id:link.subclass_id, unresolved:false};
  const legacy = (link?.is_primary || (!link && normalizeClassName(sheet.data.class)===normalizeClassName(catalog.name))) ? String(sheet.data.subclass || '').trim() : '';
  if (!legacy) return {id:null, unresolved:false};
  const matches=subclasses.filter(s=>s.class_id===catalog.id && normalizeClassName(s.name)===normalizeClassName(legacy));
  if (level < (catalog.subclass_level ?? 3) || matches.length!==1) return {id:null, unresolved:true, name:legacy};
  return {id:matches[0].id, unresolved:false};
}
export function classLevelLabel(name, level) {return `${name} · nível atual ${level} → próximo ${level+1}`;}
export function characterProgression(sheet, classes, links, subclasses=[]) {
  classes=classesForTable(classes,sheet.table_id);
  const linked = links.filter(c => c.sheet_id === sheet.id);
  if (linked.length) return linked.map(link => ({ ...link, catalog: classes.find(c => c.id === link.class_id) })).filter(c => c.catalog).map(c=>({...c,subclass_id:existingSubclass(sheet,c.catalog,c,subclasses,c.class_level).id}));
  const catalog = findClass(sheet, classes);
  const level=Number(sheet.data.level || 1);
  return catalog ? [{ catalog, class_id: catalog.id, class_level: level, subclass_id: existingSubclass(sheet,catalog,null,subclasses,level).id, is_primary: true }] : [];
}
export function levelFeatures(rules, classId, subclassId, level) {
  return rules.filter(r => r.metadata?.class_id === classId && Number(r.metadata.level) === level &&
    (r.metadata.grant === 'class' || (subclassId && r.metadata.grant === 'subclass' && r.metadata.subclass_id === subclassId)))
    .map(r => ({ id: r.id, names: r.metadata.features_text || r.name, resources: r.metadata.resources_text || '', subclass: r.metadata.grant === 'subclass' }));
}
