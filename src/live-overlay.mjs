// Self-contained because chrome.scripting serializes this function.
export function installLiveOverlay(prefs={}){
 const KEY='__sorimoiLiveV2';try{window[KEY]?.destroy();}catch{}try{window.__sorimoiOverlayV1?.destroy();}catch{}document.querySelectorAll('[data-sorimoi-live],[data-sorimoi-native]').forEach(n=>n.remove());for(const n of document.querySelectorAll('style'))if(n.textContent.trim()==='.ytp-caption-window-container{visibility:hidden!important}')n.remove();
 const host=document.createElement('div');host.dataset.sorimoiLive='';const root=host.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=`
 :host{all:initial;position:fixed;display:block;pointer-events:none;z-index:2147483646;contain:layout style;overflow:clip}
 .stage{position:relative;width:100%;height:100%;overflow:hidden}
 .word{position:absolute;left:46%;top:60%;margin:0;line-height:1.1;white-space:nowrap;translate:-50% -50%;font-family:'Malgun Gothic',system-ui,sans-serif;font-weight:950;letter-spacing:-.06em;color:#fff1d7;-webkit-text-stroke:.6px #28201bc0;text-shadow:0 2px 1px #261d19,0 5px 14px #0007;transform-origin:50% 80%;will-change:transform,opacity}
 .word[data-texture=tap]{color:#ffd6a4;text-shadow:0 3px 0 #8a4b2c,0 5px 10px #0008}
 .word[data-texture=bass]{color:#f1f0da;text-shadow:0 3px 0 #7e8064,0 6px 1px #35372c,0 7px 14px #0008}
 .word[data-texture=grain]{color:#ead4ad;letter-spacing:.06em;text-shadow:1px 0 #5d4939,-1px 1px #fff2d3,0 3px 9px #0008}
 .word[data-texture=water]{color:#c1f2f6;font-weight:600;letter-spacing:.08em;text-shadow:0 2px 0 #367c87,0 5px 0 #8bdae52b,0 3px 9px #0008}
 .word[data-texture=air]{color:#e1e5ff;font-weight:300;letter-spacing:.18em;text-shadow:0 0 4px #b0b6ff,0 2px 7px #0008}
 .asr{position:absolute;bottom:14%;left:8%;right:8%;margin:0;text-align:center;color:#fff;font:500 20px/1.35 'Malgun Gothic',sans-serif;text-shadow:0 1px 2px #000,0 0 5px #000;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .asr .active{font-weight:850;color:#fff7c8}.asr span{color:#f1f1e9}
 .guide{position:absolute;top:12px;left:12px;right:12px;width:max-content;max-width:calc(100% - 24px);padding:8px 11px;border-radius:10px;background:#141b18d9;color:#f7f7ef;font:12px/1.5 'Malgun Gothic',system-ui;box-sizing:border-box}.status{display:block;max-width:270px}.guide button{pointer-events:auto;display:block;margin-top:6px;padding:6px 10px;border:1px solid #b7c59b;border-radius:6px;background:#d3ddba;color:#172015;font:700 12px/1.4 'Malgun Gothic',system-ui;cursor:pointer}.guide[hidden],.guide button[hidden]{display:none}
 @media(prefers-reduced-motion:reduce){.word{will-change:opacity}}
 `;
 const stage=document.createElement('div');stage.className='stage';const asr=document.createElement('p');asr.className='asr';const status=document.createElement('span'),guide=document.createElement('div'),replay=document.createElement('button');guide.className='guide';status.className='status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='영상을 연결하고 있어요…';replay.textContent='자막과 함께 다시 보기';replay.hidden=true;guide.append(status,replay);stage.append(asr,guide);root.append(style,stage);document.documentElement.append(host);
 let video=null,player=null,removed=false,timer,generation=0,lastURL='',lastTime=0,lastWall=0,lastContext='',word=null,wordAt=0,wordTTL=0,asrAt=0,lastEvent=null,readyAt=Date.now(),lastAnchor=0,clipEpoch=0,clipId=null,cues=[],latestRecognized=null,soundCues=[],playedSounds=new Set(),nativeStyle=null,ccTried=false,captionState='loading',captionMessage='음성 인식기를 준비하고 있어요. 영상을 계속 재생해주세요.',dismissed=false,lastGuide='',sessionNonce=crypto.randomUUID();
 const motion=prefs.impactMotion!==false&&!matchMedia('(prefers-reduced-motion: reduce)').matches,amount=Math.max(0,Math.min(1,prefs.amount??.65));
 const sizeScale=()=>Math.max(.8,Math.min(1.8,Number(prefs.size)||1.3));
 function applyTextSize(){const size=sizeScale();asr.style.fontSize=`${Math.round(20*size)}px`;if(nativeStyle)nativeStyle.textContent=`.ytp-caption-window-container .caption-window,.ytp-caption-window-container .captions-text,.ytp-caption-window-container .caption-visual-line{background:transparent!important;box-shadow:none!important}.ytp-caption-window-container .ytp-caption-segment{background:transparent!important;text-shadow:0 1px 3px #000,0 0 5px #000;font-size:${Math.round(21*size)}px!important;line-height:1.25}`;}
 const send=data=>{try{chrome.runtime.sendMessage({target:'background',type:'SORIMOI_CONTEXT',...data}).catch(()=>{});}catch{captionMessage='확장앱이 새로고침됐어요. 이 영상 페이지도 새로고침해주세요.';}};
 function pickVideo(){const active=document.querySelector('ytd-reel-video-renderer[is-active] video, ytd-shorts[is-active] video');if(active&&active.getBoundingClientRect().height>100)return active;
  return [...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();return {v,area:Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0)),playing:!v.paused};}).filter(x=>x.area>10000).sort((a,b)=>(Number(b.playing)-Number(a.playing))||b.area-a.area)[0]?.v||null;}
 function clear(){playedSounds.clear();word?.remove();word=null;asr.textContent='';lastEvent=null;latestRecognized=null;}
 function remember(incoming){cues=[...cues.filter(old=>!incoming.some(c=>Math.min(old.end,c.end)-Math.max(old.start,c.start)>.5*Math.min(old.end-old.start,c.end-c.start))),...incoming].sort((a,b)=>a.start-b.start).slice(-500);const latest=[...incoming].sort((a,b)=>a.end-b.end).at(-1);if(latest)latestRecognized={cue:latest,receivedAt:Date.now()};}
 function paint(event){if(!video||video.paused)return;const now=Date.now();if(event.generation!==generation||!Number.isFinite(event.mediaTime)||!Number.isFinite(event.capturedAt)||now-event.capturedAt>180||now-event.capturedAt< -50||Math.abs(video.currentTime-event.mediaTime)>.22*Math.max(.5,video.playbackRate))return;if(lastEvent?.id===event.id&&now-wordAt<1000||lastEvent?.semantic&&!event.semantic&&now-wordAt<250)return;
  word?.remove();word=document.createElement('p');word.className='word';word.dataset.texture=event.texture;word.dataset.kind=event.kind;word.textContent=String(event.text||'').slice(0,4);stage.append(word);
   const strength=Math.max(0,Math.min(1,event.strength??.5)),w=host.getBoundingClientRect().width,font=Math.min(72,Math.max(22,w*(event.kind==='impact'?.105:.075)))*sizeScale();
  word.style.fontSize=font+'px';word.style.left=event.kind==='impact'?'46%':'40%';word.style.top=event.kind==='impact'?'60%':'66%';wordAt=now;wordTTL=Math.min(1300,event.ttl||900);lastEvent=event;const pop=1+strength*amount*.85;
  if(motion){let frames;
   if(event.kind==='impact')frames=[{opacity:1,transform:'scale(.8)'},{opacity:1,transform:`scale(${pop},${pop*.92})`,offset:.14},{opacity:1,transform:'scale(.94,1.04)',offset:.30},{opacity:1,transform:'scale(1)',offset:.45},{opacity:1,transform:'scale(1)',offset:.73},{opacity:0,transform:'scale(.97)'}];
   else if(event.texture==='grain')frames=[{opacity:1,transform:'translateX(-2px)'},{opacity:1,transform:'translate(1px,-1px)',offset:.2},{opacity:1,transform:'translate(-1px,1px)',offset:.4},{opacity:1,transform:'translate(1px,0)',offset:.6},{opacity:0,transform:'translate(-1px,0)'}];
   else frames=[{opacity:1,transform:'scale(.9,.97)'},{opacity:1,transform:'scale(1.06,1)',offset:.3},{opacity:.9,transform:'translateY(-3px) scale(1)',offset:.7},{opacity:0,transform:'translateY(-6px) scale(1.03)'}];
   word.animate(frames,{duration:wordTTL,easing:'cubic-bezier(.2,.7,.25,1)',fill:'forwards'});
  }else word.animate([{opacity:1},{opacity:1,offset:.12},{opacity:1,offset:.75},{opacity:0}],{duration:wordTTL,fill:'forwards'});
 }
 function render(){if(removed)return;const now=Date.now(),next=pickVideo();if(next!==video||location.href!==lastURL){nativeStyle?.remove();nativeStyle=null;video=next;lastURL=location.href;clipId=sessionNonce+'-'+(++clipEpoch);ccTried=false;dismissed=false;captionState='loading';captionMessage='첫 재생으로 자막을 준비해요. 영상을 계속 재생해주세요.';generation++;clear();cues=[];soundCues=[];lastContext='';lastTime=video?.currentTime||0;lastWall=now;player=video?.closest('ytd-reel-video-renderer,.html5-video-player,ytd-player')||video?.parentElement;
   if(player){nativeStyle=document.createElement('style');nativeStyle.dataset.sorimoiNative='';player.append(nativeStyle);applyTextSize();}
  }
  if(!video){host.style.display='none';if(lastContext!=='none'){lastContext='none';generation++;send({generation,paused:true,hasNative:false,url:location.href});}timer=setTimeout(render,100);return;}
  const r=video.getBoundingClientRect();host.style.display=r.height>50&&r.width>50?'block':'none';host.style.left=r.left+'px';host.style.top=r.top+'px';host.style.width=r.width+'px';host.style.height=r.height+'px';
  const expected=(now-lastWall)/1000*(video.paused?0:video.playbackRate),delta=video.currentTime-lastTime;
  if(now-lastWall<1000&&(Math.abs(delta-expected)>1.5||delta<-.35)){generation++;clear();lastContext='';}lastTime=video.currentTime;lastWall=now;
  const nativeText=[...player?.querySelectorAll('.ytp-caption-segment')||[]].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>n.textContent).join(' ').trim();
  const cc=player?.querySelector('.ytp-subtitles-button'),available=cc&&!cc.disabled&&!/사용 불가|unavailable|not available/i.test((cc.getAttribute('aria-label')||'')+' '+(cc.getAttribute('title')||''));
  if(available&&!ccTried){ccTried=true;if(cc.getAttribute('aria-pressed')==='false')cc.click();}
  const hasNative=!!nativeText||!!(available&&cc.getAttribute('aria-pressed')==='true'),context=JSON.stringify([generation,video.paused,hasNative,video.playbackRate]);if(context!==lastContext||now-lastAnchor>250){lastContext=context;lastAnchor=now;send({generation,paused:video.paused||video.ended,hasNative,rate:video.playbackRate,time:video.currentTime,wall:now,clipId,url:location.href});}
  if(!video.paused){for(const c of soundCues){const id=c.mediaTime.toFixed(2)+'-'+c.text;if(!playedSounds.has(id)&&video.currentTime>=c.mediaTime&&video.currentTime-c.mediaTime<.07*video.playbackRate){playedSounds.add(id);paint({...c,id:'cached-'+id,generation,mediaTime:video.currentTime,capturedAt:now});}}}
  if(video.paused||now-wordAt>wordTTL){word?.remove();word=null;}const alignedCue=!hasNative&&prefs.speechFallback!==false?cues.find(c=>video.currentTime>=c.start&&video.currentTime<c.end):null;const delayedCue=!hasNative&&prefs.speechFallback!==false&&latestRecognized&&now-latestRecognized.receivedAt<6000?latestRecognized.cue:null;const cue=alignedCue||delayedCue;if(cue?.words?.length){asr.replaceChildren(...cue.words.map(w=>{const span=document.createElement('span');span.textContent=w.text+' ';if(video.currentTime>=w.start&&video.currentTime<w.end)span.className='active';return span;}));}else asr.textContent=cue?.text||'';const nativeConnected=!!nativeText,prepared=cues.length>0;
  let guideText=hasNative&&!nativeText?'YouTube 자막을 켰어요. 현재 구간의 대사를 기다리고 있어요.':nativeConnected?'YouTube 자막을 연결했어요.':prepared?'분석한 구간의 자막이 준비됐어요.':prefs.speechFallback===false?'음성 분석이 꺼져 있어요. 확장앱에서 자막 분석을 켜주세요.':captionMessage;
  if(video.paused&&!prepared&&!nativeConnected)guideText='영상을 재생하면 자막을 분석해요.';
  guide.hidden=nativeConnected||!!cue||prepared&&dismissed;replay.hidden=!prepared||nativeConnected;
  if(guideText!==lastGuide){lastGuide=guideText;status.textContent=guideText;}

  const parent=document.fullscreenElement||document.documentElement;if(host.parentElement!==parent&&parent.tagName!=='VIDEO')parent.append(host);timer=setTimeout(render,25);
 }
 const doReplay=()=>{if(!video||!cues.length)return false;video.currentTime=Math.max(0,cues[0].start-.15);dismissed=true;video.play().catch(()=>{});return true;};replay.onclick=doReplay;
 const listener=(message,_sender,respond)=>{
  if(message.type==='SORIMOI_REPLAY'){if(!video||!cues.length){respond?.({ok:false,error:'아직 분석된 대사가 없습니다. 영상 소리를 한 번 재생해주세요.'});return;}doReplay();respond?.({ok:true});return;}
  if(message.type==='SORIMOI_TEXT_SIZE'){prefs.size=Number(message.size)||1.3;applyTextSize();return;}
  if(message.type!=='SORIMOI_LIVE'||message.generation!==undefined&&message.generation!==generation)return;if(message.event)paint(message.event);if(message.captionState){captionState=message.captionState;if(message.captionMessage)captionMessage=message.captionMessage;}
  if(message.clipId===clipId&&Array.isArray(message.soundCues)){for(const c of message.soundCues)if(Number.isFinite(c.mediaTime)&&typeof c.text==='string'&&!soundCues.some(old=>Math.abs(old.mediaTime-c.mediaTime)<.12)){soundCues.push(c);}soundCues=soundCues.slice(-500);}
  if(message.clipId===clipId&&Array.isArray(message.cues))remember(message.cues.filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>c.start&&typeof c.text==='string'));
 };
 chrome.runtime.onMessage.addListener(listener);render();window[KEY]={destroy(){removed=true;clearTimeout(timer);nativeStyle?.remove();chrome.runtime.onMessage.removeListener(listener);clear();host.remove();delete window[KEY];}};return {ok:true,hasVideo:!!video};
}
export function removeLiveOverlay(){window.__sorimoiLiveV2?.destroy();return true;}
