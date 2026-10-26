import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('public/ort/',root);await fs.mkdir(out,{recursive:true});
for(const name of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await fs.copyFile(new URL('node_modules/@huggingface/transformers/dist/'+name,root),new URL(name,out));
for(const [folder,target] of [['@huggingface/transformers','Transformers.js-Apache-2.0.txt'],['onnxruntime-web','ONNX-Runtime-MIT.txt']]){await fs.copyFile(new URL('node_modules/'+folder+'/LICENSE',root),new URL('public/licenses/'+target,root)).catch(()=>{});}
console.log('Bundled local ONNX/WASM runtime');
