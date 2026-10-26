import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),modelRoot=new URL('public/models/yamnet/',root);
const expected=new Map((await fs.readFile(new URL('MODEL_SHA256.txt',root),'utf8')).trim().split(/\r?\n/).map(line=>{const [hash,name]=line.split(/\s+/);return [name,hash];}));
const model=JSON.parse(await fs.readFile(new URL('model.json',modelRoot),'utf8'));
await fs.mkdir(modelRoot,{recursive:true});
for(const file of model.weightsManifest.flatMap(group=>group.paths)){
 const target=new URL(file,modelRoot);let data;try{data=await fs.readFile(target);}catch{}
 const digest=b=>createHash('sha256').update(b).digest('hex');
 if(data&&digest(data)===expected.get(file)){console.log('Verified '+file);continue;}
 const response=await fetch('https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1/'+file+'?tfjs-format=file');
 if(!response.ok)throw new Error('Download failed: '+response.status+' '+file);
 data=Buffer.from(await response.arrayBuffer());if(digest(data)!==expected.get(file))throw new Error('SHA256 mismatch: '+file);
 await fs.writeFile(target,data);console.log('Downloaded and verified '+file);
}
if(process.argv.includes('--fixture')){
 const response=await fetch('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');if(!response.ok)throw new Error('Fixture download failed');
 await fs.writeFile(new URL('tests/flower.mp4',root),Buffer.from(await response.arrayBuffer()));console.log('Downloaded MDN CC0 fixture');
}
