import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const revision='64da57285918e20ea79ea5c88eed7197933abaa8';
const root=new URL('../public/models/Xenova/whisper-base/',import.meta.url);await fs.mkdir(new URL('onnx/',root),{recursive:true});
let expected=new Map();try{expected=new Map(JSON.parse(await fs.readFile(new URL('artifact-manifest.json',root),'utf8')).files.map(f=>[f.file,f.sha256]));}catch{}
const files=['config.json','generation_config.json','preprocessor_config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/encoder_model_quantized.onnx','onnx/decoder_model_merged_quantized.onnx'];
const manifest=[];
for(const file of files){const target=new URL(file,root),digest=bytes=>createHash('sha256').update(bytes).digest('hex');let bytes;try{bytes=await fs.readFile(target);if(expected.has(file)&&digest(bytes)!==expected.get(file))bytes=null;}catch{}if(!bytes){const r=await fetch(`https://huggingface.co/Xenova/whisper-base/resolve/${revision}/${file}`);if(!r.ok)throw new Error(`${file}: ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());if(expected.has(file)&&digest(bytes)!==expected.get(file))throw new Error('Model SHA256 mismatch: '+file);await fs.writeFile(target,bytes);}manifest.push({file,bytes:bytes.length,sha256:digest(bytes)});console.log(file+' '+bytes.length);}
await fs.writeFile(new URL('artifact-manifest.json',root),JSON.stringify({model:'Xenova/whisper-base',revision,license:'Apache-2.0',files:manifest},null,2));
