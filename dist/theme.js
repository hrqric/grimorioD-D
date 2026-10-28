export const DEFAULT_THEME=Object.freeze({bg:'#111512',panel:'#191e19',gold:'#d4b778'});
export function normalizeTheme(value){return Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key,fallback])=>[key,typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key])?value[key].toLowerCase():fallback]));}
export function applyTheme(value,root=document.documentElement){const theme=normalizeTheme(value);for(const [key,color] of Object.entries(theme))root.style.setProperty('--'+key,color);return theme;}
