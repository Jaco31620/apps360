const path=require('path');
const sharp=require(path.join(__dirname,'..','..','node_modules','sharp'));
process.chdir(path.join(__dirname,'..'));  // chemins relatifs à brand/
const fs=require('fs');
const O='out';
const png=async(src,dst,w,h,bg)=>{let s=sharp(fs.readFileSync(src),{density:600}).resize(w,h||null,{fit:'contain',background:bg||{r:0,g:0,b:0,alpha:0}});await s.png().toFile(dst);};
(async()=>{
  // logos en PNG transparent, 2000 px de large
  for(const n of ['apps360-logo','apps360-logo-fond-sombre','apps360-logo-bleu','apps360-logo-blanc']) await png(`${O}/logo/${n}.svg`,`${O}/logo/${n}.png`,2000);
  for(const n of ['apps360-symbole','apps360-symbole-fond-sombre','apps360-symbole-bleu','apps360-symbole-blanc']) await png(`${O}/symbole/${n}.svg`,`${O}/symbole/${n}.png`,1024,1024);
  // icônes
  for(const s of [1024,512,192,48,32,16]) await png(`${O}/icones/apps360-icone.svg`,`${O}/icones/apps360-icone-${s}.png`,s,s);
  for(const s of [512,192,180]) await png(`${O}/icones/apps360-icone-carree.svg`,`${O}/icones/apps360-icone-carree-${s}.png`,s,s);
  // favicon.ico (16, 32, 48) — conteneur ICO avec images PNG
  const sizes=[16,32,48]; const imgs=sizes.map(s=>fs.readFileSync(`${O}/icones/apps360-icone-${s}.png`));
  const head=Buffer.alloc(6+16*sizes.length); head.writeUInt16LE(0,0); head.writeUInt16LE(1,2); head.writeUInt16LE(sizes.length,4);
  let off=head.length; sizes.forEach((s,i)=>{const e=6+16*i; head.writeUInt8(s,e); head.writeUInt8(s,e+1); head.writeUInt16LE(1,e+4); head.writeUInt16LE(32,e+6); head.writeUInt32LE(imgs[i].length,e+8); head.writeUInt32LE(off,e+12); off+=imgs[i].length;});
  fs.writeFileSync(`${O}/icones/favicon.ico`,Buffer.concat([head,...imgs]));
  // réseaux
  await png(`${O}/reseaux/apps360-avatar.svg`,`${O}/reseaux/apps360-avatar-1080.png`,1080,1080);
  await png(`${O}/reseaux/apps360-avatar.svg`,`${O}/reseaux/apps360-avatar-320.png`,320,320);
  await png(`${O}/reseaux/apps360-partage-1200x630.svg`,`${O}/reseaux/apps360-partage-1200x630.png`,1200,630);
  if (fs.existsSync(`${O}/reseaux/apps360-post-manifeste.svg`)) await png(`${O}/reseaux/apps360-post-manifeste.svg`,`${O}/reseaux/apps360-post-manifeste.png`,1080,1350);
  console.log('ok');
})();
