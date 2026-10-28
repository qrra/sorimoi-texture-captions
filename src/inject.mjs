// This function is serialized by chrome.scripting. Keep all dependencies inside.
export function installOverlay(project,prefs,css){
 const KEY='__sorimoiOverlayV1';window[KEY]?.destroy();
 const videos=[...document.querySelectorAll('video')].filter(v=>v.getBoundingClientRect().width>100);
 const video=videos.sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0];
 if(!video)return {ok:false,error:'이 페이지에서 표시 중인 HTML5 영상을 찾지 못했습니다. 영상을 먼저 열어주세요.'};
 const host=document.createElement('div');host.setAttribute('data-sorimoi','');
 const root=host.attachShadow({mode:'open'}),style=document.createElement('style');
 style.textContent=css+':host{all:initial;position:fixed;pointer-events:none;z-index:2147483645;display:block;contain:layout style}.stack{width:100%;height:100%;position:relative;font-family:system-ui}.sound-zone{position:absolute;bottom:28%;width:100%;display:flex;align-items:center;justify-content:center;gap:32px}.speech-zone{position:absolute;bottom:10%;width:100%;display:flex;flex-direction:column;align-items:center;gap:5px}.sori-line{box-sizing:border-box}.sound{font-size:clamp(22px,3vw,44px)!important}.speech{font-size:clamp(16px,2vw,26px)!important}.notice{position:absolute;top:15px;left:15px;background:#242629ed;color:#eee;font:12px system-ui;padding:8px 12px;border-radius:6px}';
 const stack=document.createElement('div');stack.className='stack'+(prefs.motion?' sori-motion':'')+(prefs.plain?' sori-plain':'');
 const sounds=document.createElement('div'),speech=document.createElement('div');sounds.className='sound-zone';speech.className='speech-zone';stack.append(sounds,speech);root.append(style,stack);
 let parent=document.fullscreenElement||document.documentElement;parent.append(host);let raf,last='',destroyed=false;const initialUrl=location.href;
 const sizeListener=message=>{if(message?.type!=='SORIMOI_TEXT_SIZE')return;prefs.size=Math.max(.8,Math.min(1.8,Number(message.size)||1.3));for(const el of [...sounds.children,...speech.children])el.style.zoom=String(prefs.size);};
 chrome.runtime?.onMessage?.addListener(sizeListener);
 const tick=()=>{
  if(destroyed)return;const rect=video.getBoundingClientRect();host.style.left=rect.left+'px';host.style.top=rect.top+'px';host.style.width=rect.width+'px';host.style.height=rect.height+'px';
  const visible=rect.width>0&&rect.height>0&&document.contains(video)&&location.href===initialUrl;host.style.display=visible?'block':'none';
  const now=video.currentTime*1000,active=project.cues.filter(c=>c.reviewed&&now>=c.start_ms&&now<c.end_ms&&(prefs.detail>1||c.kind==='speech'));
  const sig=active.map(c=>c.id).join('|');if(last!==sig){last=sig;sounds.replaceChildren();speech.replaceChildren();
   for(const c of [...active.filter(c=>c.kind==='sound').slice(0,2),...active.filter(c=>c.kind==='speech').slice(0,2)]){
    const el=document.createElement('p');el.className='sori-line '+c.kind+' '+(c.kind==='sound'?c.texture:'');el.textContent=c.kind==='sound'?'['+c.text+']':c.text;
    el.style.setProperty('--weight',String(1+(c.strength-.5)*.25*prefs.amount));el.style.zoom=String(prefs.size||1);
    if(c.kind==='sound')el.dataset.label=prefs.detail>=3?(c.label||'소리'):'';
    (c.kind==='sound'?sounds:speech).append(el);
   }
  }
  raf=requestAnimationFrame(tick);
 };
 const fs=()=>{const target=document.fullscreenElement||document.documentElement;if(target!==parent){parent=target;parent.append(host);}};
 document.addEventListener('fullscreenchange',fs);tick();
 window[KEY]={destroy(){destroyed=true;cancelAnimationFrame(raf);document.removeEventListener('fullscreenchange',fs);chrome.runtime?.onMessage?.removeListener(sizeListener);host.remove();delete window[KEY];}};
 return {ok:true,count:project.cues.filter(c=>c.reviewed).length,title:document.title};
}
export function removeOverlay(){window.__sorimoiOverlayV1?.destroy();return true;}
