export const DEFAULT_THEME=Object.freeze({bg:'#111512',panel:'#191e19',gold:'#d4b778'});
export function normalizeTheme(value){return Object.fromEntries(Object.entries(DEFAULT_THEME).map(([key,fallback])=>[key,typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key])?value[key].toLowerCase():fallback]));}
export const THEMES=Object.freeze({
 original:{name:'Original',...DEFAULT_THEME,ink:'#eeeee4',muted:'#abb5aa',line:'#354036',buttonInk:'#22251c'},
 cyberpunk:{name:'Cyberpunk',bg:'#0d1019',panel:'#191e2a',gold:'#fcee09',ink:'#f5f6e9',muted:'#b7c2c4',line:'#53616b',buttonInk:'#111111'},
 preto:{name:'Preto',bg:'#090909',panel:'#181818',gold:'#ffffff',ink:'#ffffff',muted:'#bfbfbf',line:'#575757',buttonInk:'#111111'},
 branco:{name:'Branco',bg:'#f8f8f8',panel:'#ffffff',gold:'#171717',ink:'#171717',muted:'#505050',line:'#a5a5a5',buttonInk:'#ffffff',light:true},
 roxo:{name:'Roxo',bg:'#1b1027',panel:'#2d1b3d',gold:'#d6aaff',ink:'#f8f1ff',muted:'#c6b7d2',line:'#725783',buttonInk:'#24122f'},
 vermelho:{name:'Vermelho',bg:'#230e12',panel:'#3b1c20',gold:'#f4b4a2',ink:'#fff2ed',muted:'#d7b8b1',line:'#815054',buttonInk:'#2b1112'},
 neon:{name:'Neon',bg:'#0b0d1d',panel:'#19162c',gold:'#62ffe0',ink:'#f8efff',muted:'#c5b8d6',line:'#6b5086',buttonInk:'#101421'}
});
export function resolveTheme(id){return typeof id==='string'&&Object.hasOwn(THEMES,id)?THEMES[id]:THEMES.original;}
const SURFACES=["242b22","303629","22251c","3b4237","121711","151a15","20261e","181e18","222b20","31372d","4a503f","414936","30372d","151d16","1b211a","4e563f","24281d","293323","0b0e0b","090b09","1d221a","1d261d","171d18","354238","151b16","28342b","596353","171e18","2b3226","566047","28352b","53634b","35402e","141c16","364139","141d17","263428","191c17","465043","263026","171713"];
export function applyTheme(value,root=document.documentElement){
 const legacy=typeof value==='object'&&value!==null;const theme=legacy?{...THEMES.original,...normalizeTheme(value)}:resolveTheme(value);
 for(const [key,color] of Object.entries({bg:theme.bg,panel:theme.panel,gold:theme.gold,ink:theme.ink,muted:theme.muted,line:theme.line,'button-ink':theme.buttonInk,green:theme.light?'#226b3d':'#a6c7ab',red:theme.light?'#a62e2e':'#efaaa0'}))root.style.setProperty('--'+key,color);
 const custom=legacy?(theme.bg!==DEFAULT_THEME.bg||theme.panel!==DEFAULT_THEME.panel):value!=='original'&&typeof value==='string'&&Object.hasOwn(THEMES,value);
 for(const hex of SURFACES){const name='--surface-'+hex;if(custom){const brightness=parseInt(hex.slice(2,4),16);const amount=Math.min(75,Math.max(0,Math.round((brightness-30)*1.2)));root.style.setProperty(name,brightness<30?`color-mix(in srgb, var(--panel) 85%, ${theme.light?'white':'black'})`:`color-mix(in srgb, var(--panel), ${theme.light?'black':'white'} ${amount}%)`)}else root.style.removeProperty(name)}return theme;
}
