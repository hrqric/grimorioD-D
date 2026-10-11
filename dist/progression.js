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
export function characterProgression(sheet, classes, links) {
  const linked = links.filter(c => c.sheet_id === sheet.id);
  if (linked.length) return linked.map(link => ({ ...link, catalog: classes.find(c => c.id === link.class_id) })).filter(c => c.catalog);
  const catalog = findClass(sheet, classes);
  return catalog ? [{ catalog, class_id: catalog.id, class_level: Number(sheet.data.level || 1), subclass_id: null, is_primary: true }] : [];
}
export function levelFeatures(rules, classId, subclassId, level) {
  return rules.filter(r => r.metadata?.class_id === classId && Number(r.metadata.level) === level &&
    (r.metadata.grant === 'class' || (subclassId && r.metadata.grant === 'subclass' && r.metadata.subclass_id === subclassId)))
    .map(r => ({ id: r.id, names: r.metadata.features_text || r.name, resources: r.metadata.resources_text || '', subclass: r.metadata.grant === 'subclass' }));
}
