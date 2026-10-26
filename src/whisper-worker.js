import {pipeline,env} from '@huggingface/transformers';
import {cleanTranscript} from './live-core.mjs';
export function installSpeechWorker(){
let transcriber,loading,busy=false;
self.onmessage=async({data})=>{
 try{
  if(data.type==='load'){
   if(!loading)loading=(async()=>{
    env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=data.modelRoot;env.useBrowserCache=true;
    env.backends.onnx.wasm.wasmPaths=data.wasmRoot;env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
    const started=performance.now();transcriber=await pipeline('automatic-speech-recognition','Xenova/whisper-base',{device:'wasm',dtype:'q8',local_files_only:true,progress_callback:p=>{if(p.status==='progress')self.postMessage({type:'progress',file:p.file,progress:p.progress});}});
    self.postMessage({type:'ready',load_ms:Math.round(performance.now()-started)});
   })();await loading;return;
  }
  if(data.type==='transcribe'){
   if(busy||!transcriber){self.postMessage({type:'skipped',requestId:data.requestId,generation:data.generation});return;}
   busy=true;const started=performance.now();
   try{const output=await transcriber(data.audio,{language:data.language==='auto'?undefined:(data.language||'ko'),task:'transcribe',return_timestamps:'word',max_new_tokens:96,num_beams:1,do_sample:false});
    self.postMessage({type:'text',text:cleanTranscript(output.text),chunks:output.chunks,clipId:data.clipId,mediaStart:data.mediaStart,rate:data.rate,duration:data.audio.length/16000,requestId:data.requestId,generation:data.generation,finishedAt:Date.now(),elapsed_ms:Math.round(performance.now()-started),capturedAt:data.capturedAt});
   }finally{busy=false;}
  }
 }catch(error){self.postMessage({type:'error',message:error.message,generation:data.generation,requestId:data.requestId});loading=null;}
};
}
