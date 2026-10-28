import * as tf from '@tensorflow/tfjs';
import {AudioRing,audioFeatures} from '../../src/live-core.mjs';
import {ImpactDetector,confidentSound} from '../../src/sound-events.mjs';
import {speechCues,groupSpeech,timelyEvent} from '../../src/timeline.mjs';
import {loadYamnet} from '../../src/analyze.js';
let session=null;
const FAST_ASR_ROOT='http://127.0.0.1:8765';
async function emit(s,payload={},state){if(session!==s||s.stopped)return;await chrome.runtime.sendMessage({target:'background',type:'LIVE_UPDATE',tabId:s.tabId,payload,state}).catch(()=>{});}
async function caption(s,captionState,text,extra={}){s.captionState=captionState;await emit(s,{captionState,captionMessage:text,clipId:s.clipId},{captionState,text,...extra});}
async function emitEvent(s,event){const now=Date.now(),a=s.anchor;if(!a||!timelyEvent(event,{time:a.time+(now-a.wall)/1000*a.rate,now,generation:s.generation,paused:s.paused,rate:a.rate}))return;await emit(s,{generation:s.generation,event});}
function handleTranscript(s,data){
 if(session!==s||data.clipId!==s.clipId||data.generation!==s.generation)return;
 s.asrBusy=false;const cues=groupSpeech(speechCues(data));
 if(cues.length){s.preparedCount+=cues.length;emit(s,{cues,clipId:s.clipId});caption(s,'ready','분석한 구간의 자막이 준비됐어요. 자막과 함께 다시 볼 수 있어요.',{phase:'listening',preparedCount:s.preparedCount,asrMs:data.elapsed_ms});}
 else if(!s.preparedCount)caption(s,'empty','아직 대사를 찾지 못했어요. 소리가 나는 상태로 조금 더 재생해주세요.');
}
async function probeFastBackend(){try{const r=await fetch(`${FAST_ASR_ROOT}/health`,{headers:{'X-Sorimoi-Client':'sorimoi-browser-v1'},signal:AbortSignal.timeout(350)});if(!r.ok)return null;const x=await r.json();return x?.engine==='mlx-whisper'&&x?.ready?x:null;}catch{return null;}}
async function transcribeFast(data){const response=await fetch(`${FAST_ASR_ROOT}/api/transcribe-chunk`,{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Sorimoi-Client':'sorimoi-browser-v1','X-Sample-Rate':'16000','X-Language':data.language||'ko'},body:new Blob([data.audio]),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`로컬 분석 서비스 응답 ${response.status}`);const result=await response.json();return {...result,clipId:data.clipId,generation:data.generation,requestId:data.requestId,capturedAt:data.capturedAt,mediaStart:data.mediaStart,rate:data.rate,duration:data.audio.length/16000};}
function sendBrowserTranscription(s,data){if(!s.browserReady||!s.worker){s.pendingAudio=data;return false;}s.worker.postMessage({type:'transcribe',...data},[data.audio.buffer]);return true;}
async function stop(){const old=session;session=null;if(!old)return;old.stopped=true;old.worker?.terminate();old.stream?.getTracks().forEach(t=>t.stop());old.source?.disconnect();old.worklet?.disconnect();await old.context?.close().catch(()=>{});old.ring.clear();}
function reset(s,generation){s.generation=generation;s.ring.clear();s.speechEvidence=0;s.activeSamples=0;s.lastASR=0;s.lastSound=0;s.requestId++;s.detector.reset();s.soundCandidate=null;s.soundCount=0;s.lastTexture=0;s.anchor=null;s.blockEnd=null;s.onsets=[];s.suppressImpactUntil=0;}
async function start(message){
 await stop();const s={tabId:message.tabId,generation:0,ring:new AudioRing(),stopped:false,paused:false,hasNative:false,asrBusy:false,soundBusy:false,lastASR:0,lastSound:0,requestId:0,ready:false,browserReady:false,fastBackend:null,pendingAudio:null,level:0,speechEvidence:0,activeSamples:0,preparedCount:0,lastSignal:Date.now(),silentNotice:false,detector:new ImpactDetector(),soundCandidate:null,soundCount:0,lastTexture:0,anchor:null,blockEnd:null,onsets:[],suppressImpactUntil:0,eventId:0,speechFallback:message.prefs?.speechFallback!==false};session=s;
 try{
  if(s.speechFallback){s.fastBackend=await probeFastBackend();if(s.fastBackend){s.ready=true;caption(s,'loading',`Apple Silicon ${s.fastBackend.model||'MLX Whisper'}에 연결했어요.`);}}
  s.stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
  s.context=new AudioContext({sampleRate:16000});await s.context.resume();
  if(s.context.sampleRate!==16000)throw new Error('이 브라우저가 16kHz 오디오 분석을 지원하지 않습니다.');
  s.source=s.context.createMediaStreamSource(s.stream);s.source.connect(s.context.destination);
  await s.context.audioWorklet.addModule(chrome.runtime.getURL('/audio/pcm-worklet.js'));
  s.worklet=new AudioWorkletNode(s.context,'sorimoi-pcm');const silent=s.context.createGain();silent.gain.value=0;s.source.connect(s.worklet);s.worklet.connect(silent);silent.connect(s.context.destination);
  s.stream.getAudioTracks()[0].onended=()=>{if(session===s){emit(s,{phase:'소리 연결이 끝났습니다.'},{phase:'ended',text:'소리 연결이 끝났습니다. 다시 켜주세요.'});stop();}};
  s.labels=[];try{const response=await fetch(chrome.runtime.getURL('/models/yamnet/classes.csv'));if(!response.ok)throw new Error('소리 분류표를 읽지 못했습니다.');s.labels=(await response.text()).trim().split(/\r?\n/).slice(1).map(l=>l.match(/^\d+,[^,]+,"?(.*?)"?$/)?.[1]||'');}catch(e){emit(s,{}, {soundError:e.message});}
  s.modelPromise=loadYamnet().then(model=>{emit(s,{}, {soundReady:true});return model;}).catch(e=>{emit(s,{}, {soundError:e.message});return null;});
  if(s.speechFallback){s.worker=new Worker(chrome.runtime.getURL('/speech-worker.js'));
  s.worker.onmessage=({data})=>{
   if(session!==s)return;
   if(data.type==='ready'){s.browserReady=true;if(!s.fastBackend){s.ready=true;caption(s,s.hasNative?'native':'listening',s.hasNative?'YouTube 자막을 표시하고 있어요.':'첫 재생으로 대사를 분석해요. 준비되면 다시 보기 버튼이 나와요.',{phase:'listening',modelLoadMs:data.load_ms});}if(s.pendingAudio){const pending=s.pendingAudio;s.pendingAudio=null;sendBrowserTranscription(s,pending);}}
   if(data.type==='error'){s.asrBusy=false;caption(s,'error','대사 분석을 시작하지 못했어요. 확장앱에서 자막 다시 연결을 눌러주세요.',{speechError:data.message});}
   if(data.type==='skipped'){s.asrBusy=false;}
   if(data.type==='text')handleTranscript(s,data);
  };
  s.worker.onerror=e=>{s.asrBusy=false;caption(s,'error','대사 분석이 중단됐어요. 확장앱에서 자막 다시 연결을 눌러주세요.',{speechError:e.message});};
  s.worker.postMessage({type:'load',modelRoot:chrome.runtime.getURL('/models/'),wasmRoot:chrome.runtime.getURL('/ort/')});}
  s.worklet.port.onmessage=({data})=>{
   if(session!==s||s.stopped)return;const audioBlock=data.audio,blockAt=Date.now()-Math.max(0,s.context.currentTime-data.endTime)*1000;const features=audioFeatures(audioBlock);s.level=features.level;
   if(features.rms>.001){s.lastSignal=Date.now();if(s.silentNotice){s.silentNotice=false;if(!s.preparedCount)caption(s,'listening','소리가 들어오고 있어요. 첫 재생으로 자막을 분석해요.');}}
   else if(!s.paused&&!s.silentNotice&&Date.now()-s.lastSignal>4000){s.silentNotice=true;if(!s.preparedCount)caption(s,'no-audio','현재 소리가 들어오지 않아요. 음소거 상태인지 확인해주세요.');}
   if(s.paused)return;const now=Date.now(),impact=s.detector.process(audioBlock,blockAt);
   const anchor=s.anchor,mediaEnd=anchor&&!anchor.paused&&blockAt-anchor.wall<650?anchor.time+(blockAt-anchor.wall)/1000*anchor.rate:null;
   s.blockEnd={mediaTime:mediaEnd,capturedAt:blockAt};
   if(impact&&mediaEnd!==null&&now-blockAt<150){impact.id=++s.eventId;impact.mediaTime=mediaEnd-audioBlock.length/32000*(anchor?.rate||1);impact.capturedAt=blockAt;impact.generation=s.generation;s.lastImpact=now;s.onsets.push({...impact});s.onsets=s.onsets.slice(-40);if(now>s.suppressImpactUntil)emitEvent(s,impact);}
   s.ring.push(audioBlock);if(features.rms>.0025)s.activeSamples+=audioBlock.length;
   if(!s.soundBusy&&s.ring.available>=15600&&now-s.lastSound>500){s.lastSound=now;classify(s,s.ring.latest(15600),s.generation,{...s.blockEnd,rate:anchor?.rate||1,clipId:s.clipId});}
   if(mediaEnd!==null&&s.ready&&!s.hasNative&&!s.asrBusy&&s.ring.available>=48000&&now-s.lastASR>3000&&features.rms>.0025&&(s.activeSamples>=8000||s.speechEvidence>now-4500)){
    const audio=s.ring.latest(80000);s.asrBusy=true;s.lastASR=now;s.activeSamples=0;if(!s.preparedCount)caption(s,'processing',s.fastBackend?'Apple Silicon에서 대사를 분석하고 있어요.':'대사를 분석하고 있어요. 준비되면 다시 보기 버튼이 나와요.');const requestId=++s.requestId;const request={audio,generation:s.generation,requestId,capturedAt:now,clipId:s.clipId,mediaStart:mediaEnd-audio.length/16000*(anchor?.rate||1),rate:anchor?.rate||1,language:'ko'};
    if(s.fastBackend){
     transcribeFast(request)
      .then(result=>handleTranscript(s,result))
      .catch(()=>{
       if(session!==s)return;
       s.fastBackend=null;
       if(s.browserReady){
        sendBrowserTranscription(s,request);
        caption(s,'processing','로컬 가속 연결이 끊겨 브라우저 분석으로 이어갑니다.');
       }else{
        s.pendingAudio=request;
        caption(s,'processing','로컬 가속 연결이 끊겨 브라우저 Whisper를 준비하고 있어요.');
       }
      });
    }
    else sendBrowserTranscription(s,request);
   }
  };
  if(!s.fastBackend){
   await caption(s,s.speechFallback?'loading':'disabled',s.speechFallback?'음성 인식기를 준비하고 있어요. 영상을 계속 재생해주세요.':'음성 분석이 꺼져 있어요. 확장앱 설정에서 켜주세요.',{phase:'listening',preparedCount:0});
  }
  return {ok:true};
 }catch(error){await stop();return {ok:false,error:error.message};}
}
async function classify(s,audio,generation,frame){s.soundBusy=true;let input,output;
 try{const model=await s.modelPromise;if(!model||session!==s||generation!==s.generation)return;
  input=tf.tensor1d(audio);output=await model.executeAsync(input);const scores=(Array.isArray(output)?output:Object.values(output)).find(t=>t.shape.at(-1)===521),values=await scores.data();
  if(session!==s||generation!==s.generation)return;
  let speechScore=0;for(let i=0;i<=12;i++)speechScore=Math.max(speechScore,values[i]);if(speechScore>.16)s.speechEvidence=Date.now();
  const sound=confidentSound(values,s.labels),now=Date.now();let competing=0;for(let i=0;i<521;i++)if(i<=12||i>=132&&i<=276||/breath|gasp|snort/i.test(s.labels[i]))competing=Math.max(competing,values[i]);if(competing>.5)s.suppressImpactUntil=now+750;
  if(!sound){s.soundCandidate=null;s.soundCount=0;return;}
  // A one-second classifier must never trigger a late impact animation.
  if(sound.kind==='impact'){const matched=s.onsets.filter(e=>e.generation===generation&&e.mediaTime>=frame.mediaTime-.975*frame.rate&&e.mediaTime<=frame.mediaTime);if(matched.length)await emit(s,{clipId:frame.clipId,soundCues:matched.map(e=>({...e,...sound,semantic:true}))});return;}
  if(s.soundCandidate===sound.text)s.soundCount++;else{s.soundCandidate=sound.text;s.soundCount=1;}
  if(s.soundCount>=2&&now-s.lastTexture>1600&&now-(s.lastImpact||0)>900&&now-frame.capturedAt<180&&frame.mediaTime!==null){s.lastTexture=now;await emitEvent(s,{...sound,id:++s.eventId,strength:s.level,ttl:1100,...frame,generation});}

 }catch(e){await emit(s,{}, {soundError:e.message});}finally{input?.dispose();if(output)tf.dispose(output);s.soundBusy=false;}
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
 if(message?.target!=='offscreen')return;
 if(message.type==='START'){start(message).then(respond,error=>respond({ok:false,error:error.message}));return true;}
 if(message.type==='STOP'){stop().then(()=>respond({ok:true}));return true;}
 if(message.type==='SUSPEND'&&session){session.paused=true;session.clipId=null;reset(session,-1);respond({ok:true});return;}
 if(message.type==='CONTEXT'&&session){const s=session;if(message.clipId&&s.clipId!==message.clipId){s.preparedCount=0;if(s.ready)caption(s,'listening','첫 재생으로 대사를 분석해요. 준비되면 다시 보기 버튼이 나와요.',{preparedCount:0});}if(s.generation!==message.generation||s.paused!==message.paused)reset(s,message.generation);s.paused=!!message.paused;s.hasNative=!!message.hasNative;s.clipId=message.clipId;s.anchor={time:message.time,wall:message.wall,rate:message.rate||1,paused:s.paused};respond({ok:true});}
});
