import fs from 'node:fs/promises';
import * as tf from '@tensorflow/tfjs';
import {synthesizeDemo} from '../src/demo.mjs';
const root=new URL('../public/models/yamnet/',import.meta.url),json=JSON.parse(await fs.readFile(new URL('model.json',root),'utf8'));
const buffers=await Promise.all(json.weightsManifest[0].paths.map(p=>fs.readFile(new URL(p,root))));const buffer=Buffer.concat(buffers);
await tf.setBackend('cpu');
const model=await tf.loadGraphModel(tf.io.fromMemory({modelTopology:json.modelTopology,weightSpecs:json.weightsManifest[0].weights,weightData:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength)}));
for(const [name,audio] of [['silence',new Float32Array(15600)],['synthetic-paper',synthesizeDemo().slice(8000,23600)]]){
 const input=tf.tensor1d(audio),output=await model.executeAsync(input),scores=output.find(t=>t.shape.at(-1)===521),values=await scores.data();
 if(!values.length||!values.every(Number.isFinite))throw new Error('Invalid scores');
 console.log(JSON.stringify({input:name,shape:scores.shape,topIndex:values.indexOf(Math.max(...values)),topScore:Math.max(...values)}));tf.dispose(output);input.dispose();
}
model.dispose();console.log('YAMNet local inference passed');
