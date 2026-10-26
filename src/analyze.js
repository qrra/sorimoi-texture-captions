import * as tf from '@tensorflow/tfjs';
import {framesToCues} from './core.mjs';
let modelPromise;
export async function loadYamnet(){
 if(!modelPromise)modelPromise=(async()=>{
  try{if(!await tf.setBackend('webgl'))await tf.setBackend('cpu');await tf.ready();}catch{await tf.setBackend('cpu');await tf.ready();}
  return tf.loadGraphModel(new URL('models/yamnet/model.json',document.baseURI).href);
 })().catch(e=>{modelPromise=null;throw e;});
 return modelPromise;
}
export async function decodeFile(file){
 const context=new AudioContext({sampleRate:16000});
 try{const audio=await context.decodeAudioData(await file.arrayBuffer());
  if(audio.duration>300)throw new Error('시제품은 최대 5분까지 분석합니다. 짧은 파일을 선택해주세요.');
  const render=new OfflineAudioContext(1,Math.ceil(audio.duration*16000),16000),source=render.createBufferSource();source.buffer=audio;source.connect(render.destination);source.start();
  return (await render.startRendering()).getChannelData(0).slice();
 }finally{await context.close();}
}
export async function analyzeAudio(samples,{threshold=.25,onProgress=()=>{},signal}={}){
 const model=await loadYamnet();
 const response=await fetch(new URL('models/yamnet/classes.csv',document.baseURI));if(!response.ok)throw new Error('소리 분류표를 읽을 수 없습니다.');
 const labels=(await response.text()).trim().split(/\r?\n/).slice(1).map(l=>{const m=l.match(/^\d+,[^,]+,"?(.*?)"?$/);return m?m[1]:l;});
 const frames=[],hop=7680,frameLength=15600,batch=20,chunkLength=frameLength+hop*(batch-1);
 for(let offset=0;offset<samples.length;offset+=hop*batch){
  if(signal?.aborted)throw new DOMException('분석 취소','AbortError');
  const chunk=new Float32Array(chunkLength);chunk.set(samples.subarray(offset,offset+chunkLength));
  const input=tf.tensor1d(chunk);let outputs;
  try{
   outputs=await model.executeAsync(input);const tensors=Array.isArray(outputs)?outputs:Object.values(outputs);
   const scores=tensors.find(t=>t.shape.at(-1)===521);if(!scores)throw new Error('YAMNet 출력 형식이 예상과 다릅니다.');
   const values=await scores.data(),rows=Math.min(batch,scores.shape[0]);
   for(let row=0;row<rows;row++){
    const start=offset+row*hop;if(start>=samples.length)break;
    let first=-1,second=-1,score=-1,runnerUp=-1;
    for(let k=0;k<521;k++){const s=values[row*521+k];if(s>score){second=first;runnerUp=score;first=k;score=s;}else if(s>runnerUp){second=k;runnerUp=s;}}
    const end=Math.min(samples.length,start+frameLength);let sum=0;for(let k=start;k<end;k++)sum+=samples[k]*samples[k];const rms=Math.sqrt(sum/Math.max(1,end-start));
    frames.push({start_ms:Math.round(start/16),end_ms:Math.round(end/16),label:labels[first],score,runnerUp,secondLabel:labels[second],rms,strength:Math.max(0,Math.min(1,(20*Math.log10(rms+1e-8)+55)/45))});
   }
  }finally{input.dispose();if(outputs)tf.dispose(outputs);}
  onProgress(Math.min(1,(offset+hop*batch)/samples.length));await tf.nextFrame();
 }
 return {cues:framesToCues(frames,{threshold}),frames,backend:tf.getBackend()};
}
