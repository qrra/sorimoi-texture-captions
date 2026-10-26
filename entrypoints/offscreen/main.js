import * as tf from '@tensorflow/tfjs';
import {AudioRing,audioFeatures} from '../../src/live-core.mjs';
import {ImpactDetector,confidentSound} from '../../src/sound-events.mjs';
import {speechCues,groupSpeech,timelyEvent} from '../../src/timeline.mjs';
import {loadYamnet} from '../../src/analyze.js';
let session=null;
async function emit(s,payload={},state){if(session!==s||s.stopped)return;await chrome.runtime.sendMessage({target:'background',type:'LIVE_UPDATE',tabId:s.tabId,payload,state}).catch(()=>{});}
async function emitEvent(s,event){const now=Date.now(),a=s.anchor;if(!a||!timelyEvent(event,{time:a.time+(now-a.wall)/1000*a.rate,now,generation:s.generation,paused:s.paused,rate:a.rate}))return;await emit(s,{generation:s.generation,event});}
async function stop(){const old=session;session=null;if(!old)return;old.stopped=true;old.worker?.terminate();old.stream?.getTracks().forEach(t=>t.stop());old.source?.disconnect();old.worklet?.disconnect();await old.context?.close().catch(()=>{});old.ring.clear();}
function reset(s,generation){s.generation=generation;s.ring.clear();s.speechEvidence=0;s.lastASR=0;s.lastSound=0;s.requestId++;s.detector.reset();s.soundCandidate=null;s.soundCount=0;s.lastTexture=0;s.anchor=null;s.blockEnd=null;s.onsets=[];s.suppressImpactUntil=0;}
async function start(message){
 await stop();const s={tabId:message.tabId,generation:0,ring:new AudioRing(),stopped:false,paused:false,hasNative:false,asrBusy:false,soundBusy:false,lastASR:0,lastSound:0,requestId:0,ready:false,level:0,speechEvidence:0,lastSignal:Date.now(),silentNotice:false,detector:new ImpactDetector(),soundCandidate:null,soundCount:0,lastTexture:0,anchor:null,blockEnd:null,onsets:[],suppressImpactUntil:0,eventId:0,speechFallback:message.prefs?.speechFallback!==false};session=s;
 try{
  s.stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:false});
  s.context=new AudioContext({sampleRate:16000});await s.context.resume();
  if(s.context.sampleRate!==16000)throw new Error('이 브라우저가 16kHz 오디오 분석을 지원하지 않습니다.');
  s.source=s.context.createMediaStreamSource(s.stream);s.source.connect(s.context.destination);
  await s.context.audioWorklet.addModule(chrome.runtime.getURL('/audio/pcm-worklet.js'));
  s.worklet=new AudioWorkletNode(s.context,'sorimoi-pcm');const silent=s.context.createGain();silent.gain.value=0;s.source.connect(s.worklet);s.worklet.connect(silent);silent.connect(s.context.destination);
  s.stream.getAudioTracks()[0].onended=()=>{if(session===s){emit(s,{phase:'소리 연결이 끝났습니다.'},{phase:'ended',text:'소리 연결이 끝났습니다. 다시 켜주세요.'});stop();}};
  const response=await fetch(chrome.runtime.getURL('/models/yamnet/classes.csv'));s.labels=(await response.text()).trim().split(/\r?\n/).slice(1).map(l=>l.match(/^\d+,[^,]+,"?(.*?)"?$/)?.[1]||'');
  s.modelPromise=loadYamnet().then(model=>{emit(s,{phase:'소리를 듣는 중'},{phase:'listening',text:'효과음에 연결했습니다. 팝업을 닫고 영상을 보세요.'});return model;}).catch(e=>{emit(s,{phase:'효과음 모델 오류'},{soundError:e.message});return null;});
  if(s.speechFallback){s.worker=new Worker(chrome.runtime.getURL('/speech-worker.js'));
  s.worker.onmessage=({data})=>{
   if(session!==s)return;
   if(data.type==='ready'){s.ready=true;emit(s,{phase:'소리를 듣는 중'},{phase:'listening',text:'재생 소리를 인식 중입니다.',modelLoadMs:data.load_ms});}
   if(data.type==='error'){s.asrBusy=false;emit(s,{phase:'YouTube 자막·효과음 표시 중'},{speechError:data.message,text:'음성 모델 오류: '+data.message});}
   if(data.type==='skipped'){s.asrBusy=false;}
   if(data.type==='text'){s.asrBusy=false;if(data.clipId!==s.clipId)return;const cues=groupSpeech(speechCues(data));if(cues.length)emit(s,{cues,clipId:s.clipId},{phase:'listening',text:'대사 구간을 준비했습니다. 다음 반복에 맞춰 표시합니다.',asrMs:data.elapsed_ms});
   }
  };
  s.worker.onerror=e=>{s.asrBusy=false;emit(s,{phase:'음성 모델을 시작하지 못했습니다.'},{speechError:e.message,text:e.message});};
  s.worker.postMessage({type:'load',modelRoot:chrome.runtime.getURL('/models/'),wasmRoot:chrome.runtime.getURL('/ort/')});}
  s.worklet.port.onmessage=({data})=>{
   if(session!==s||s.stopped)return;const audioBlock=data.audio,blockAt=Date.now()-Math.max(0,s.context.currentTime-data.endTime)*1000;const features=audioFeatures(audioBlock);s.level=features.level;
   if(features.rms>.001){s.lastSignal=Date.now();if(s.silentNotice){s.silentNotice=false;emit(s,{phase:'소리를 듣는 중'},{text:'재생 소리를 인식 중입니다.'});}}
   else if(!s.paused&&!s.silentNotice&&Date.now()-s.lastSignal>4000){s.silentNotice=true;emit(s,{phase:'소리가 작습니다 · 영상 음소거 확인'},{text:'소리 입력이 작거나 없습니다. 영상·탭 음소거를 확인해주세요.'});}
   if(s.paused)return;const now=Date.now(),impact=s.detector.process(audioBlock,blockAt);
   const anchor=s.anchor,mediaEnd=anchor&&!anchor.paused&&blockAt-anchor.wall<650?anchor.time+(blockAt-anchor.wall)/1000*anchor.rate:null;
   s.blockEnd={mediaTime:mediaEnd,capturedAt:blockAt};
   if(impact&&mediaEnd!==null&&now-blockAt<150){impact.id=++s.eventId;impact.mediaTime=mediaEnd-audioBlock.length/32000*(anchor?.rate||1);impact.capturedAt=blockAt;impact.generation=s.generation;s.lastImpact=now;s.onsets.push({...impact});s.onsets=s.onsets.slice(-40);if(now>s.suppressImpactUntil)emitEvent(s,impact);}
   s.ring.push(audioBlock);
   if(!s.soundBusy&&s.ring.available>=15600&&now-s.lastSound>500){s.lastSound=now;classify(s,s.ring.latest(15600),s.generation,{...s.blockEnd,rate:anchor?.rate||1,clipId:s.clipId});}
   if(mediaEnd!==null&&s.ready&&!s.hasNative&&!s.asrBusy&&s.ring.available>=48000&&now-s.lastASR>3000&&features.rms>.003&&s.speechEvidence>now-4500){
    const audio=s.ring.latest(80000);s.asrBusy=true;s.lastASR=now;const requestId=++s.requestId;s.worker.postMessage({type:'transcribe',audio,generation:s.generation,requestId,capturedAt:now,clipId:s.clipId,mediaStart:mediaEnd-audio.length/16000*(anchor?.rate||1),rate:anchor?.rate||1,language:'ko'},[audio.buffer]);
   }
  };
  await emit(s,{phase:'효과음 연결 중'},{phase:'listening',text:'소리의 강약에 반응합니다. 효과음 종류 모델을 준비합니다.'});return {ok:true};
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
 if(message.type==='CONTEXT'&&session){const s=session;if(s.generation!==message.generation||s.paused!==message.paused)reset(s,message.generation);s.paused=!!message.paused;s.hasNative=!!message.hasNative;s.clipId=message.clipId;s.anchor={time:message.time,wall:message.wall,rate:message.rate||1,paused:s.paused};respond({ok:true});}
});
