// Run with sharp installed: npm install --no-save sharp && node scripts/optimize-assets.mjs
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
import {stat,writeFile} from 'node:fs/promises';
const entries=[];
await createRequire(import.meta.url)('./pack-countryside.cjs')();
entries.push({name:'countryside',url:'assets/countryside.webp',cols:5,rows:2,bytes:(await stat('public/assets/countryside.webp')).size});
for(const [name,cols,rows] of [['terrain',2,2],['props',2,2],['scenery',2,2],['riflemen',4,2],['uaz16',4,4]]){
 const source=`public/assets/${name}.png`,target=`public/assets/${name}.webp`;
 await sharp(source).webp({quality:85,alphaQuality:100,effort:6}).toFile(target);
 entries.push({...(name==='uaz16'?{frames:[[26,108,309,180],[355,72,291,243],[666,69,272,246],[987,68,247,248],[77,366,183,247],[331,363,276,257],[631,366,287,260],[932,388,313,229],[24,707,315,194],[353,685,270,227],[656,690,273,228],[963,686,259,228],[75,973,178,225],[325,972,295,233],[637,978,289,233],[935,998,318,223]]}:{}),name,url:`assets/${name}.webp`,cols,rows,bytes:(await stat(target)).size});
}
await writeFile('public/assets/manifest.json',JSON.stringify(entries,null,2)+'\n');
console.log(entries.map(e=>`${e.name}: ${(e.bytes/1024).toFixed(0)} KB`).join('\n'));
