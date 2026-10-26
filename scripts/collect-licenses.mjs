import fs from 'node:fs/promises';
import path from 'node:path';
const names=['@wxt-dev/browser','vtt.js','@tensorflow/tfjs','@tensorflow/tfjs-core','@tensorflow/tfjs-converter','@tensorflow/tfjs-backend-cpu','@tensorflow/tfjs-backend-webgl','@tensorflow/tfjs-data','@tensorflow/tfjs-layers','seedrandom','long','node-fetch','whatwg-url','tr46','webidl-conversions'];
const out='public/licenses';await fs.mkdir(out,{recursive:true});const records=[];
for(const name of names){const dir=path.join('node_modules',name);try{const pkg=JSON.parse(await fs.readFile(path.join(dir,'package.json'),'utf8'));records.push({name,version:pkg.version,license:pkg.license,author:pkg.author,repository:pkg.repository});
 for(const file of await fs.readdir(dir))if(/^(licen[sc]e|notice|copying)(\.|$)/i.test(file)){const stat=await fs.stat(path.join(dir,file));if(stat.isFile())await fs.copyFile(path.join(dir,file),path.join(out,name.replaceAll('/','-')+'-'+file));}
}catch{}}
await fs.writeFile(path.join(out,'dependencies.json'),JSON.stringify(records,null,2));
