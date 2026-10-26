import fs from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {pipeline,env} from '@huggingface/transformers';
if(!process.argv[2])throw new Error('Pass a 16kHz mono PCM16 WAV fixture path');
const bytes=await fs.readFile(process.argv[2]);let offset=12,data;
while(offset+8<=bytes.length){const id=bytes.toString('ascii',offset,offset+4),size=bytes.readUInt32LE(offset+4);if(id==='fmt '&&(bytes.readUInt16LE(offset+8)!==1||bytes.readUInt16LE(offset+10)!==1||bytes.readUInt32LE(offset+12)!==16000||bytes.readUInt16LE(offset+22)!==16))throw Error('16kHz mono PCM16 required');if(id==='data'){data=bytes.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
if(!data)throw Error('Missing WAV data');const audio=new Float32Array(Math.min(data.length/2,80000));for(let i=0;i<audio.length;i++)audio[i]=data.readInt16LE(i*2)/32768;
env.allowRemoteModels=false;env.localModelPath=fileURLToPath(new URL('../public/models/',import.meta.url));const start=performance.now();
const asr=await pipeline('automatic-speech-recognition','Xenova/whisper-base',{device:'cpu',dtype:'q8',local_files_only:true});
const loaded=performance.now(),result=await asr(audio,{language:'ko',task:'transcribe',return_timestamps:'word',max_new_tokens:96,num_beams:1,do_sample:false});
console.log(JSON.stringify({runtime:'native CPU (not browser WASM)',duration_s:audio.length/16000,load_ms:Math.round(loaded-start),inference_ms:Math.round(performance.now()-loaded),text:result.text,chunks:result.chunks}));await asr.dispose();
