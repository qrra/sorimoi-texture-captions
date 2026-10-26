// Serialized by chrome.scripting: all DOM helpers must remain in this function.
export function installLiveOverlay(prefs,textureCSS){
 const KEY='__sorimoiLiveV2';window[KEY]?.destroy();window.__sorimoiOverlayV1?.destroy();
 const host=document.createElement('div');host.dataset.sorimoiLive='';const root=host.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=textureCSS+`:host{all:initial;display:block;position:fixed;pointer-events:none;z-index:2147483646;contain:layout style}.body{height:100%;width:100%;position:relative}.speech-zone{position:absolute;bottom:23%;left:4%;right:4%;display:flex;justify-content:center}.speech{font-size:clamp(17px,2vw,27px)!important;background:#101715e8!important;padding:8px 14px!important;border-radius:8px;transition:transform 120ms,color 200ms;max-width:100%}.sound-zone{position:absolute;bottom:40%;left:3%;right:3%;display:flex;justify-content:center}.sound{font-size:clamp(24px,3vw,40px)!important;transition:transform 140ms}.info{position:absolute;top:10%;left:6%;right:6%;display:flex;align-items:center;gap:6px;font:10px/1.6 'Malgun Gothic',system-ui,sans-serif;color:#e2e8d7;text-shadow:0 1px 4px #000;opacity:.88}.dot{width:6px;height:6px;background:#c2d59d;border-radius:50%;box-shadow:0 0 7px #b5d08a}.meter{height:2px;background:#c1d5a1;width:var(--level,0%);position:absolute;bottom:20%;left:10%;max-width:80%;transition:width 120ms;opacity:.6}.sori-line.sound::after{font-size:10px!important}.speech[data-feel=air]{font-weight:400;letter-spacing:.13em;color:#dfddfa!important}.speech[data-feel=bass]{font-weight:850;color:#d5dfc5!important}.speech[data-feel=grain]{font-weight:650;letter-spacing:.09em}.speech[data-feel=velvet]{font-weight:550;color:#f0dfeb!important}`;
 const body=document.createElement('div');body.className='body'+(prefs.motion?' sori-motion':'')+(prefs.plain?' sori-plain':'');
 const speechZone=document.createElement('div'),soundZone=document.createElement('div'),info=document.createElement('div'),dot=document.createElement('span'),label=document.createElement('span'),meter=document.createElement('div');
 speechZone.className='speech-zone';soundZone.className='sound-zone';info.className='info';dot.className='dot';label.textContent='소리모이 · 재생 소리에 연결하는 중';meter.className='meter';info.append(dot,label);body.append(info,speechZone,soundZone,meter);root.append(style,body);document.documentElement.append(host);
 let video=null,player=null,removed=false,timer,generation=0,lastURL='',lastTime=0,lastWall=0,lastContext='',lastNative='',speech='',speechAt=0,sound='',soundAt=0,soundTexture='velvet',level=0,feel='velvet',phase='연결 중',nativeStyle=null,sourceLabel='',lastPaint='';
 const send=data=>chrome.runtime.sendMessage({target:'background',type:'SORIMOI_CONTEXT',...data}).catch(()=>{});
 function pickVideo(){
  const active=document.querySelector('ytd-reel-video-renderer[is-active] video, ytd-shorts[is-active] video');if(active&&active.getBoundingClientRect().height>100)return active;
  return [...document.querySelectorAll('video')].map(v=>{const r=v.getBoundingClientRect();const area=Math.max(0,Math.min(r.right,innerWidth)-Math.max(r.left,0))*Math.max(0,Math.min(r.bottom,innerHeight)-Math.max(r.top,0));return {v,area,playing:!v.paused};}).filter(x=>x.area>10000).sort((a,b)=>(Number(b.playing)-Number(a.playing))||b.area-a.area)[0]?.v||null;
 }
 function clearText(){speech='';sound='';lastNative='';speechAt=0;soundAt=0;lastPaint='';speechZone.replaceChildren();soundZone.replaceChildren();}
 function nativeText(){if(!player)return '';return [...player.querySelectorAll('.ytp-caption-segment')].map(e=>e.textContent).join(' ').replace(/\s+/g,' ').trim().slice(0,240);}
 function render(){
  if(removed)return;const now=Date.now(),next=pickVideo();
  if(next!==video||location.href!==lastURL){nativeStyle?.remove();nativeStyle=null;video=next;lastURL=location.href;generation++;clearText();lastContext='';lastTime=video?.currentTime||0;lastWall=now;
   player=video?.closest('ytd-reel-video-renderer,.html5-video-player,ytd-player')||video?.parentElement;
  }
  if(!video){host.style.display='none';if(lastContext!=='none'){lastContext='none';generation++;send({generation,paused:true,hasNative:false,url:location.href});}timer=setTimeout(render,250);return;}
  const r=video.getBoundingClientRect();host.style.display=r.height>50&&r.width>50?'block':'none';host.style.left=r.left+'px';host.style.top=r.top+'px';host.style.width=r.width+'px';host.style.height=r.height+'px';
  const expected=(now-lastWall)/1000*(video.paused?0:video.playbackRate),delta=video.currentTime-lastTime;
  if(now-lastWall<1000&&(Math.abs(delta-expected)>1.5||delta<-.35)){generation++;clearText();lastContext='';}
  lastTime=video.currentTime;lastWall=now;
  const native=nativeText();if(native){if(!nativeStyle){nativeStyle=document.createElement('style');nativeStyle.textContent='.ytp-caption-window-container{visibility:hidden!important}';player?.append(nativeStyle);}speech=native;speechAt=now;sourceLabel='YouTube 자막';lastNative=native;}
  else if(lastNative){lastNative='';speech='';speechAt=0;lastPaint='';}
  const context=JSON.stringify([generation,video.paused,!!native,video.playbackRate]);if(context!==lastContext){lastContext=context;send({generation,paused:video.paused||video.ended,hasNative:!!native,rate:video.playbackRate,url:location.href});}
  const parent=document.fullscreenElement||document.documentElement;if(host.parentElement!==parent&&parent.tagName!=='VIDEO')parent.append(host);
  if(video.paused){speechZone.style.opacity='.7';soundZone.style.opacity='.5';}else{speechZone.style.opacity='1';soundZone.style.opacity='1';}
  const shownSpeech=now-speechAt<7000?speech:'',shownSound=now-soundAt<2100?sound:'';
  const sig=JSON.stringify([shownSpeech,shownSound,soundTexture,sourceLabel]);if(sig!==lastPaint){lastPaint=sig;speechZone.replaceChildren();soundZone.replaceChildren();
   if(shownSpeech){const el=document.createElement('p');el.className='sori-line speech';el.textContent=shownSpeech;el.dataset.feel=feel;speechZone.append(el);}
   if(shownSound&&prefs.detail!==1){const el=document.createElement('p');el.className='sori-line sound '+soundTexture;el.textContent='['+shownSound+']';soundZone.append(el);}
  }
  const text=speechZone.firstElementChild;if(text){text.style.transform=`scale(${1+level*.07*(prefs.amount??.65)})`;text.dataset.feel=feel;text.style.fontSize=(Math.round((18+level*3)*(prefs.size||1)))+'px';}
  const effect=soundZone.firstElementChild;if(effect)effect.style.setProperty('--weight',String(1+level*.1));
  body.style.setProperty('--level',Math.round(level*80)+'%');label.textContent='소리모이 · '+(video.paused?'일시정지':shownSpeech?sourceLabel:phase);
  timer=setTimeout(render,100);
 }
 const listener=(message)=>{if(message.type!=='SORIMOI_LIVE')return;if(message.generation!==undefined&&message.generation!==generation)return;
  if(message.phase)phase=message.phase;
  if(message.level!==undefined)level=.5*level+.5*Math.max(0,Math.min(1,message.level));
  if(message.feel)feel=message.feel;
  if(message.sound){sound=message.sound;soundTexture=message.texture||'velvet';soundAt=Date.now();}
  if(message.text&&!lastNative&&!video?.paused){speech=message.text;speechAt=Date.now();sourceLabel=`후행 음성 인식 · 처리 ${Math.max(1,Math.round((message.lag_ms||0)/1000))}초`;}
 };
 chrome.runtime.onMessage.addListener(listener);render();
 window[KEY]={destroy(){removed=true;clearTimeout(timer);nativeStyle?.remove();chrome.runtime.onMessage.removeListener(listener);host.remove();delete window[KEY];}};
 return {ok:true};
}
export function removeLiveOverlay(){window.__sorimoiLiveV2?.destroy();return true;}
