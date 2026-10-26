import * as tf from '@tensorflow/tfjs';
import {AudioRing,audioFeatures,acceptSpeechResult} from '../../src/live-core.mjs';
import {soundStyle} from '../../src/core.mjs';
import {loadYamnet} from '../../src/analyze.js';
let session=null;
async function emit(s,payload={},state){if(session!==s||s.stopped)return;await chrome.runtime.sendMessage({target:'background',type:'LIVE_UPDATE',tabId:s.tabId,payload,state}).catch(()=>{});}
async function stop(){const old=session;session=null;if(!old)return;old.stopped=true;old.worker?.terminate();old.stream?.getTracks().forEach(t=>t.stop());old.source?.disconnect();old.worklet?.disconnect();await old.context?.close().catch(()=>{});old.ring.clear();}
function reset(s,generation){s.generation=generation;s.ring.clear();s.speechEvidence=0;s.lastASR=0;s.lastSound=0;s.requestId++;}
async function start(message){
 await stop();const s={tabId:message.tabId,generation:0,ring:new AudioRing(),stopped:false,paused:false,hasNative:false,asrBusy:false,soundBusy:false,lastASR:0,lastSound:0,requestId:0,ready:false,level:0,speechEvidence:0,lastSignal:Date.now(),silentNotice:false};session=s;
 try{
  s.stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
  s.context=new AudioContext({sampleRate:16000});await s.context.resume();
  if(s.context.sampleRate!==16000)throw new Error('이 브라우저가 16kHz 오디오 분석을 지원하지 않습니다.');
  s.source=s.context.createMediaStreamSource(s.stream);s.source.connect(s.context.destination);
  await s.context.audioWorklet.addModule(chrome.runtime.getURL('/audio/pcm-worklet.js'));
  s.worklet=new AudioWorkletNode(s.context,'sorimoi-pcm');const silent=s.context.createGain();silent.gain.value=0;s.source.connect(s.worklet);s.worklet.connect(silent);silent.connect(s.context.destination);
  s.stream.getAudioTracks()[0].onended=()=>{if(session===s){emit(s,{phase:'소리 연결이 끝났습니다.'},{phase:'ended',text:'소리 연결이 끝났습니다. 다시 켜주세요.'});stop();}};
  const response=await fetch(chrome.runtime.getURL('/models/yamnet/classes.csv'));s.labels=(await response.text()).trim().split(/\r?\n/).slice(1).map(l=>l.match(/^\d+,[^,]+,"?(.*?)"?$/)?.[1]||'');
  s.modelPromise=loadYamnet().catch(e=>{emit(s,{phase:'효과음 모델 오류'},{soundError:e.message});return null;});
  s.worker=new Worker(chrome.runtime.getURL('/speech-worker.js'));
  s.worker.onmessage=({data})=>{
   if(session!==s)return;
   if(data.type==='ready'){s.ready=true;emit(s,{phase:'소리를 듣는 중'},{phase:'listening',text:'재생 소리를 인식 중입니다.',modelLoadMs:data.load_ms});}
   if(data.type==='error'){s.asrBusy=false;emit(s,{phase:'YouTube 자막·효과음 표시 중'},{speechError:data.message,text:'음성 모델 오류: '+data.message});}
   if(data.type==='skipped'){s.asrBusy=false;}
   if(data.type==='text'){s.asrBusy=false;if(!acceptSpeechResult(data,s.generation,s))return;const lag=Date.now()-data.capturedAt;
    if(data.text&&lag<14000)emit(s,{text:data.text,generation:s.generation,lag_ms:lag,phase:'소리를 듣는 중'},{phase:'listening',text:`음성 인식 중 · 최근 처리 ${(data.elapsed_ms/1000).toFixed(1)}초`,asrMs:data.elapsed_ms,lagMs:lag});
   }
  };
  s.worker.onerror=e=>{s.asrBusy=false;emit(s,{phase:'음성 모델을 시작하지 못했습니다.'},{speechError:e.message,text:e.message});};
  s.worker.postMessage({type:'load',modelRoot:chrome.runtime.getURL('/models/'),wasmRoot:chrome.runtime.getURL('/ort/')});
  s.worklet.port.onmessage=({data})=>{
   if(session!==s||s.stopped)return;const features=audioFeatures(data);s.level=features.level;
   if(features.rms>.001){s.lastSignal=Date.now();if(s.silentNotice){s.silentNotice=false;emit(s,{phase:'소리를 듣는 중'},{text:'재생 소리를 인식 중입니다.'});}}
   else if(!s.paused&&!s.silentNotice&&Date.now()-s.lastSignal>4000){s.silentNotice=true;emit(s,{phase:'소리가 작습니다 · 영상 음소거 확인'},{text:'소리 입력이 작거나 없습니다. 영상·탭 음소거를 확인해주세요.'});}
   emit(s,{generation:s.generation,level:s.paused?0:features.level});
   if(s.paused)return;s.ring.push(data);const now=Date.now();
   if(!s.soundBusy&&s.ring.available>=15600&&now-s.lastSound>850){s.lastSound=now;classify(s,s.ring.latest(15600),s.generation);}
   if(s.ready&&!s.hasNative&&!s.asrBusy&&s.ring.available>=48000&&now-s.lastASR>3000&&features.rms>.003&&s.speechEvidence>now-4500){
    const audio=s.ring.latest(80000);s.asrBusy=true;s.lastASR=now;const requestId=++s.requestId;s.worker.postMessage({type:'transcribe',audio,generation:s.generation,requestId,capturedAt:now,language:'ko'},[audio.buffer]);
   }
  };
  await emit(s,{phase:'음성 모델 준비 중 · YouTube 자막은 바로 표시'},{phase:'warming',text:'로컬 음성 모델을 준비합니다. YouTube 자막이 있으면 먼저 표시합니다.'});return {ok:true};
 }catch(error){await stop();return {ok:false,error:error.message};}
}
async function classify(s,audio,generation){s.soundBusy=true;let input,output;
 try{const model=await s.modelPromise;if(!model||session!==s||generation!==s.generation)return;
  input=tf.tensor1d(audio);output=await model.executeAsync(input);const scores=(Array.isArray(output)?output:Object.values(output)).find(t=>t.shape.at(-1)===521),values=await scores.data();
  if(session!==s||generation!==s.generation)return;
  let speechScore=0,top=-1,index=-1;for(let i=0;i<521;i++){if(values[i]>top){top=values[i];index=i;}if(i<=12)speechScore=Math.max(speechScore,values[i]);}
  if(speechScore>.08)s.speechEvidence=Date.now();
  const style=soundStyle(s.labels[index]||'');const payload={generation,feel:index===12?'air':'velvet'};
  if(style&&top>.2){payload.sound=style.text;payload.texture=style.texture;payload.feel=style.texture;}
  await emit(s,payload);
 }catch(e){await emit(s,{}, {soundError:e.message});}finally{input?.dispose();if(output)tf.dispose(output);s.soundBusy=false;}
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
 if(message?.target!=='offscreen')return;
 if(message.type==='START'){start(message).then(respond,error=>respond({ok:false,error:error.message}));return true;}
 if(message.type==='STOP'){stop().then(()=>respond({ok:true}));return true;}
 if(message.type==='CONTEXT'&&session){const s=session;if(s.generation!==message.generation||s.paused!==message.paused)reset(s,message.generation);s.paused=!!message.paused;s.hasNative=!!message.hasNative;respond({ok:true});}
});
