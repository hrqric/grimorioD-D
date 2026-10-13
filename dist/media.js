export const MEDIA={portrait:{bucket:'dnd-portraits',max:5*1024*1024},map:{bucket:'dnd-table-scenes',max:30*1024*1024},cutscene:{bucket:'dnd-table-scenes',max:30*1024*1024}};
export function mediaExtension(type){return {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[type]||null}
export function validateMedia(file,kind){const rule=MEDIA[kind],ext=mediaExtension(file?.type);if(!rule||!file||!ext||(kind==='portrait'&&ext==='gif'))throw Error('Use uma imagem JPEG, PNG ou WebP.');if(file.size<=0||file.size>rule.max)throw Error(`A imagem deve ter no máximo ${rule.max/1024/1024} MB.`);return ext}
export function mediaPath(kind,tableId,sheetId,assetId,ext){return kind==='portrait'?`${tableId}/${sheetId}/${assetId}.${ext}`:`${tableId}/${assetId}.${ext}`}
export function imageDimensions(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight})};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível ler a imagem.'))};img.src=url})}

