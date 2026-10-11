// Pure catalog projections: pending requests never change acquired levels.
export const normalizeClassName = value => String(value || '').trim().toLocaleLowerCase('pt-BR');
export function findClass(sheet, classes) {
  return classes.find(c => normalizeClassName(c.name) === normalizeClassName(sheet.data.class));
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
