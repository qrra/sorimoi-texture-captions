import {TEXTURES,DEFAULT_PREFS,validateProject,activeCues,formatTime,toVtt} from './core.mjs';
import {demoProject,synthesizeDemo,wavBlob} from './demo.mjs';
import {parseVtt} from './captions.js';
import './style.css';
import './texture.css';
const $=s=>document.querySelector(s),extension=Boolean(globalThis.chrome?.runtime?.id);
let project=demoProject(),prefs={...DEFAULT_PREFS},mode='demo',samples=synthesizeDemo(),mediaFile=null,mediaURL=null,selectedId=project.cues[0].id,abort=null,playing=false,current=0.8,lastSig='',runId=0;
const icon=(name)=>({play:'▶',pause:'Ⅱ',open:'↥',save:'↓',arrow:'↗',add:'＋'}[name]||name);
document.querySelector('#app').innerHTML=`
<header class="topbar"><a class="brand" href="#"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 13v6m6-12v18m6-22v26m6-22v18m6-12v6"/></svg><strong>소리모이</strong><span>SORIMOI</span></a><div class="topmeta"><span class="dot"></span> 소리의 결을 읽다 <span class="tag">CHROME EXTENSION · 0.1</span></div><button id="helpBtn" class="icon-btn" aria-label="사용 안내">?</button></header>
<main><section class="intro"><div><p class="eyebrow">A LITTLE CLOSER TO SOUND</p><h1>듣는 소리에서,<br><em>느끼는 글자</em>로.</h1><p class="intro-copy">바스락거리는 마찰, 둥글게 번지는 물결, 나직한 숨결.<br>소리의 표면을 글자의 질감으로 만나보세요.</p></div><div class="intro-note"><span class="small-index">01 — TEXTURE STUDIO</span><p>눈으로 읽고,<br>감각으로 머무는 자막.</p><span>로컬 분석 · 검수 · 영상에 적용</span></div></section>
<section class="workspace" aria-label="반응형 자막 스튜디오"><aside class="texture-rail"><div class="rail-head"><span class="eyebrow">SOUND PALETTE</span><h2>여섯 가지 결</h2></div><div id="palette"></div><p class="rail-note">소리를 골라 결을 느껴보세요.<br>모든 체험음은 직접 합성했습니다.</p></aside>
<section class="preview-column"><div class="preview-top"><div><span class="dot"></span><strong id="projectTitle"></strong></div><span id="sourceBadge" class="source-badge">합성 체험 샘플</span></div><div id="stage" class="stage" data-texture="grain"><video id="video" playsinline></video><audio id="audio"></audio><div class="scene" aria-hidden="true"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="contour c1"></div><div class="contour c2"></div><div class="contour c3"></div><div class="surface-grain"></div><span class="scene-label">THE SURFACE OF SOUND</span></div><span id="chapter" class="chapter">01 / PAPER</span><div id="sounds" class="sound-stack"></div><div id="speech" class="speech-stack"></div><div class="stage-bottom"><span id="stageHint">마른 종이가 손끝에서 접히는 순간</span><span id="motionBadge">MOTION OFF</span></div></div><div class="transport"><button id="playBtn" class="play-btn" aria-label="재생">▶</button><span id="clock">00:00</span><input id="seek" type="range" min="0" max="24" step=".01" value=".8" aria-label="재생 위치"><span id="duration">00:24</span><button id="muteBtn" class="icon-btn" aria-label="소리 끄기">♪</button><button id="fullBtn" class="icon-btn" aria-label="전체 화면">⛶</button></div><div class="wave-wrap"><canvas id="wave" aria-label="소리의 음량 파형"></canvas><div id="waveCursor"></div><div class="wave-scale"><span>00:00</span><span>소리의 흔적</span><span id="waveEnd">00:24</span></div></div><div class="preview-foot"><span id="textureDescription">거친 가장자리 · 작은 입자 · 마른 마찰</span><button id="demoBtn" class="text-btn">체험 샘플로 돌아가기 ↺</button></div></section>
<aside class="settings"><div class="rail-head"><span class="eyebrow">MAKE IT YOURS</span><h2>감각 조절</h2></div><label class="range-label" for="amount">질감의 농도 <output id="amountValue">65%</output></label><input id="amount" type="range" min="0" max="1" step=".05" value=".65"><div class="range-caption"><span>은은하게</span><span>선명하게</span></div><label class="range-label" for="size">글자 크기 <output id="sizeValue">100%</output></label><input id="size" type="range" min=".8" max="1.5" step=".1" value="1"><div class="divider"></div><label class="toggle-row"><span>움직임 더하기<small>결을 따라 천천히 움직여요</small></span><input id="motion" type="checkbox" role="switch"></label><label class="toggle-row"><span>일반 자막으로 보기<small>질감과 기본 자막을 비교해요</small></span><input id="plain" type="checkbox" role="switch"></label><div class="divider"></div><p class="range-label">전달할 정보</p><div class="segmented" id="detail"><button data-level="1">대사</button><button data-level="2" class="selected">대사+소리</button><button data-level="3">상세</button></div><p class="settings-note">모션은 기본 꺼짐입니다.<br>움직임 없이도 소리의 결이 남아요.</p><div class="texture-card"><span id="textureNumber">TEXTURE 01</span><p id="textureWord" class="sori-line sound grain">바스락</p><small id="textureHint">마른 종이와 잔잔한 마찰</small></div></aside></section>
<section class="flowbar"><div><span class="step">1</span><label class="file-button">소리·영상 파일 열기<input id="mediaInput" type="file" accept="audio/*,video/*"></label><small>WAV · MP3 · MP4 등</small></div><div><span class="step">2</span><button id="analyzeBtn">소리 결 분석</button><small>YAMNet · 기기 내 분석</small></div><div><span class="step">3</span><button id="saveBtn" class="accent-btn">검수 자막 저장 ${icon('arrow')}</button><small id="saveHint">확장에서 영상에 적용</small></div></section>
<div class="statusbar"><p id="status" role="status">체험 샘플입니다. 재생하면 합성 소리와 수동으로 디자인한 자막을 함께 체험합니다.</p><button id="cancelBtn" hidden>분석 취소</button><progress id="progress" value="0" max="1" hidden></progress></div>
<section class="timeline-panel"><div class="section-heading"><div><p class="eyebrow">LISTEN · READ · REFINE</p><h2>소리의 타임라인 <span id="cueCount"></span></h2></div><div class="actions"><label class="outline-btn">VTT / JSON 가져오기<input id="captionInput" type="file" accept=".vtt,.json"></label><button id="newCue" class="outline-btn">＋ 자막 추가</button><div class="export-menu"><button id="jsonExport" class="outline-btn">JSON ↓</button><button id="vttExport" class="outline-btn">VTT ↓</button></div></div></div><div class="timeline-layout"><div class="cue-list" id="cueList" aria-label="자막 목록"></div><form id="editor" class="editor"><div class="editor-top"><span>선택한 자막</span><span id="reviewBadge"></span></div><label>자막 글자<input id="cueText" maxlength="200" required></label><div class="time-inputs"><label>시작 (초)<input id="cueStart" type="number" min="0" step=".01" required></label><label>끝 (초)<input id="cueEnd" type="number" min=".01" step=".01" required></label></div><div class="time-inputs"><label>종류<select id="cueKind"><option value="sound">소리</option><option value="speech">대사</option></select></label><label>질감<select id="cueTexture"></select></label></div><label>소리 설명<input id="cueLabel" maxlength="150"></label><label class="range-label" for="cueStrength">소리의 무게 <output id="strengthValue"></output></label><input id="cueStrength" type="range" min="0" max="1" step=".05"><p id="cueSource" class="editor-note"></p><div class="editor-actions"><button type="button" id="deleteCue" class="text-btn">삭제</button><button type="submit" class="accent-btn">수정 · 검수 완료 ✓</button></div></form></div></section>
<section class="project-settings"><div><h3>웹페이지 영상과 연결하기</h3><p>시간은 영상의 시작을 0초로 맞춥니다. 저장한 뒤 영상 탭의 소리모이 아이콘을 누르세요.</p></div><label>대상 영상 주소 (선택)<input id="sourceUrl" type="url" placeholder="https://www.youtube.com/watch?v=…"></label><label>분석 기준 점수<select id="threshold"><option value=".25">기본 · 0.25</option><option value=".4">보수적 · 0.40</option><option value=".15">더 많은 후보 · 0.15</option></select></label></section>
<footer><span>소리모이 <b>·</b> 소리에는 저마다의 표면이 있으니까.</span><div><button id="aboutBtn" class="text-btn">세 가지 오픈소스 ↗</button><span>LOCAL FIRST / MADE TO FEEL</span></div></footer></main>
<dialog id="help"><button class="close-dialog" aria-label="안내 닫기">×</button><p class="eyebrow">HOW TO FEEL SOUND</p><h2>소리의 결을 만나는 방법</h2><ol><li><b>체험:</b> 재생하거나 왼쪽 소리 팔레트를 고릅니다. 체험 소리는 합성음이며 AI 인식 결과가 아닙니다.</li><li><b>분석:</b> 5분 이하의 소리·영상 파일을 열고 ‘소리 결 분석’을 누릅니다. 파일은 이 기기에서 분석합니다.</li><li><b>대사:</b> 가지고 있는 WebVTT(.vtt)를 가져옵니다. 이 버전은 음성을 자동 전사하지 않습니다.</li><li><b>검수:</b> AI 후보의 시간·글자·질감을 확인하고 각각 ‘검수 완료’를 누릅니다. 분류 점수는 정확도나 확률을 뜻하지 않습니다.</li><li><b>적용:</b> ‘검수 자막 저장’ → 영상 탭 → 확장 아이콘 → ‘이 페이지 영상에 적용’. 새 영상으로 이동했다면 다시 적용합니다.</li></ol><p>일반 HTML5 영상용입니다. 별도 iframe·닫힌 Shadow DOM·일부 전체화면 방식과 Picture-in-Picture에서는 표시가 제한될 수 있습니다. 모델은 소리의 물리적 촉감을 측정하지 않으며, 질감은 사용자가 조정하는 시각 표현입니다.</p><div class="credits"><a href="https://github.com/wxt-dev/wxt" target="_blank" rel="noreferrer">WXT · MIT</a><a href="https://github.com/mozilla/vtt.js" target="_blank" rel="noreferrer">vtt.js · Apache 2.0</a><a href="https://www.kaggle.com/models/google/yamnet" target="_blank" rel="noreferrer">YAMNet · Apache 2.0</a></div></dialog>`;
const audio=$('#audio'),video=$('#video');let media=audio;
function status(text){$('#status').textContent=text;}
function duration(){return Number.isFinite(media.duration)?media.duration:(project.duration_ms||24000)/1000;}
function syncPrefs(){
 $('#amount').value=prefs.amount;$('#amountValue').textContent=Math.round(prefs.amount*100)+'%';$('#size').value=prefs.size;$('#sizeValue').textContent=Math.round(prefs.size*100)+'%';$('#motion').checked=prefs.motion;$('#plain').checked=prefs.plain;
 $('#stage').classList.toggle('sori-motion',prefs.motion);$('#stage').classList.toggle('sori-plain',prefs.plain);$('#motionBadge').textContent='MOTION '+(prefs.motion?'ON':'OFF');
 $$('#detail button').forEach(b=>b.classList.toggle('selected',Number(b.dataset.level)===prefs.detail));lastSig='';renderCurrent();
}
function $$(s){return [...document.querySelectorAll(s)];}
function initPalette(){
 const palette=$('#palette');Object.entries(TEXTURES).forEach(([key,t],i)=>{
  const btn=document.createElement('button');btn.className='palette-button';btn.dataset.texture=key;btn.style.setProperty('--swatch',t.color);
  const swatch=document.createElement('span');swatch.className='swatch swatch-'+key;const text=document.createElement('span');text.textContent=t.name;const num=document.createElement('small');num.textContent=String(i+1).padStart(2,'0');btn.append(swatch,text,num);
  btn.onclick=()=>{
   if(mode==='demo'){const index=Object.keys(TEXTURES).indexOf(key);media.currentTime=index*4+.8;current=media.currentTime;selectedId=project.cues.find(c=>c.texture===key)?.id;renderEditor();renderList();}
   else{const cue=project.cues.find(c=>c.id===selectedId);if(!cue){status('목록에서 자막을 먼저 선택해주세요.');return;}cue.texture=key;cue.reviewed=false;chooseCue(cue.id);status('선택한 자막의 질감을 바꿨습니다. 확인한 뒤 검수 완료를 눌러주세요.');}
   setTexture(key);lastSig='';renderCurrent();
  };palette.append(btn);
  const option=document.createElement('option');option.value=key;option.textContent=t.name;$('#cueTexture').append(option);
 });
}
function setTexture(key){
 const t=TEXTURES[key]||TEXTURES.velvet,i=Object.keys(TEXTURES).indexOf(key);$('#stage').dataset.texture=key;
 $$('.palette-button').forEach(b=>{b.classList.toggle('selected',b.dataset.texture===key);b.setAttribute('aria-pressed',String(b.dataset.texture===key));});
 $('#textureWord').textContent=t.word;$('#textureWord').className='sori-line sound '+key;$('#textureHint').textContent=t.hint;$('#textureNumber').textContent='TEXTURE '+String(i+1).padStart(2,'0');$('#textureDescription').textContent=t.hint;
 const captions=['마른 종이가 손끝에서 접히는 순간','단단한 표면을 가볍게 두드리는 순간','둥근 물결이 겹쳐지는 순간','공기가 가늘게 흩어지는 순간','부드러운 소리가 가까이 머무는 순간','낮은 진동이 천천히 남는 순간'];
 $('#stageHint').textContent=mode==='demo'?captions[i]:'분석 후보를 확인하고 질감을 다듬어주세요.';$('#chapter').textContent=String(i+1).padStart(2,'0')+' / '+key.toUpperCase();
}
function renderCurrent(){
 const t=media.src?media.currentTime:current;current=t;const d=duration();$('#seek').max=d;$('#seek').value=t;$('#clock').textContent=formatTime(t);$('#duration').textContent=formatTime(d);$('#waveEnd').textContent=formatTime(d);$('#waveCursor').style.left=(100*t/Math.max(.01,d))+'%';
 const active=activeCues(project.cues,t*1000,prefs.detail),sig=active.map(c=>JSON.stringify(c)).join('|')+JSON.stringify(prefs);
 if(sig===lastSig)return;lastSig=sig;$('#sounds').replaceChildren();$('#speech').replaceChildren();
 for(const c of [...active.filter(c=>c.kind==='sound').slice(0,2),...active.filter(c=>c.kind==='speech').slice(0,2)]){
  const p=document.createElement('p');p.className='sori-line '+c.kind+' '+(c.kind==='sound'?c.texture:'');p.textContent=c.kind==='sound'?'['+c.text+']':c.text;
  p.style.setProperty('--weight',1+(c.strength-.5)*.25*prefs.amount);p.style.zoom=prefs.size;
  if(c.kind==='sound')p.dataset.label=prefs.detail>=3?(c.label||'소리'):'';
  if(c.kind==='sound'){p.style.opacity=String(.62+prefs.amount*.38);setTexture(c.texture);}
  (c.kind==='sound'?$('#sounds'):$('#speech')).append(p);
 }
 $$('.cue-row').forEach(row=>row.classList.toggle('is-playing',active.some(c=>c.id===row.dataset.id)));
}
function drawWave(){
 const canvas=$('#wave'),rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;canvas.width=Math.max(1,rect.width*dpr);canvas.height=60*dpr;const c=canvas.getContext('2d');c.scale(dpr,dpr);c.clearRect(0,0,rect.width,60);
 if(!samples?.length)return;const count=Math.max(1,Math.floor(rect.width/4));for(let i=0;i<count;i++){const a=Math.floor(i*samples.length/count),b=Math.floor((i+1)*samples.length/count);let sum=0;for(let k=a;k<b;k++)sum+=samples[k]**2;const rms=Math.sqrt(sum/Math.max(1,b-a)),h=Math.max(2,Math.min(48,rms*650));c.fillStyle=i%3===0?'#b9c3a0':'#6e7867';c.fillRect(i*4,(60-h)/2,2,h);}
}
function updateHeader(){
 $('#projectTitle').textContent=project.title;$('#sourceBadge').textContent=mode==='demo'?'합성 샘플 · 수동 디자인':mode==='restored'?'저장된 자막 · 파일 연결 필요':'내 파일 · 검수 스튜디오';$('#sourceUrl').value=project.source_url||'';
 $('#stage').classList.toggle('has-video',media===video);$('#cueCount').textContent=`${project.cues.length}개 · 검수 ${project.cues.filter(c=>c.reviewed).length}개`;
 $('#analyzeBtn').disabled=!samples?.length;renderList();drawWave();lastSig='';renderCurrent();
}
function chooseCue(id,seek=true){selectedId=id;renderEditor();renderList();const c=project.cues.find(c=>c.id===id);if(c&&seek){current=c.start_ms/1000+.02;if(media.src)media.currentTime=current;lastSig='';renderCurrent();}}
function renderList(){
 const list=$('#cueList');list.replaceChildren();$('#cueCount').textContent=`${project.cues.length}개 · 검수 ${project.cues.filter(c=>c.reviewed).length}개`;
 if(!project.cues.length){const p=document.createElement('p');p.className='empty';p.textContent='아직 자막이 없어요. 소리를 분석하거나 VTT를 가져와주세요.';list.append(p);}
 project.cues.forEach(c=>{
  const b=document.createElement('button');b.className='cue-row'+(c.id===selectedId?' selected':'');b.dataset.id=c.id;
  const time=document.createElement('span');time.className='cue-time';time.textContent=formatTime(c.start_ms/1000)+' — '+formatTime(c.end_ms/1000);
  const label=document.createElement('span');label.className='cue-text';label.textContent=c.kind==='sound'?'['+c.text+']':c.text;
  const texture=document.createElement('span');texture.className='cue-texture';texture.textContent=c.kind==='speech'?'대사':TEXTURES[c.texture].name.split(' · ')[1];texture.style.color=c.kind==='sound'?TEXTURES[c.texture].color:'#ddd';
  const review=document.createElement('small');review.className='cue-review';review.textContent=c.reviewed?'✓ 검수':'검수 전';b.append(time,label,texture,review);b.onclick=()=>chooseCue(c.id);list.append(b);
 });
}
function renderEditor(){
 const c=project.cues.find(c=>c.id===selectedId);$('#editor').hidden=!c;if(!c)return;
 $('#cueText').value=c.text;$('#cueStart').value=(c.start_ms/1000).toFixed(2);$('#cueEnd').value=(c.end_ms/1000).toFixed(2);$('#cueKind').value=c.kind;$('#cueTexture').value=c.texture;$('#cueLabel').value=c.label||'';$('#cueStrength').value=c.strength;$('#strengthValue').textContent=Math.round(c.strength*100)+'%';$('#reviewBadge').textContent=c.reviewed?'✓ 검수 완료':'미검수 후보';
 $('#cueSource').textContent=c.source+(Number.isFinite(c.score)?` · 분류 점수 ${c.score.toFixed(3)} (확률 아님)`:'');
}
function setMedia(el,url){audio.pause();video.pause();playing=false;media=el;if(mediaURL)URL.revokeObjectURL(mediaURL);mediaURL=url;if(url){media.src=url;media.currentTime=0;}else{media.removeAttribute('src');media.load();}current=0;$('#playBtn').textContent='▶';$('#playBtn').setAttribute('aria-label','재생');}
function loadDemo(){if(abort){abort.abort();runId++;}mode='demo';mediaFile=null;samples=synthesizeDemo();project=demoProject();selectedId=project.cues[0].id;setMedia(audio,URL.createObjectURL(wavBlob(samples)));media.currentTime=.8;current=.8;updateHeader();renderEditor();status('합성 체험 샘플입니다. AI 분석 결과가 아닌, 소리와 글자의 감각을 비교하는 디자인 예시입니다.');}
async function openMedia(file){
 if(!file)return;if(file.size>200*1024*1024){status('200MB 이하의 파일을 선택해주세요.');return;}
 if(abort){status('진행 중인 분석을 취소한 뒤 파일을 열어주세요.');return;}
 const previousMode=mode;mode='file';mediaFile=file;samples=null;setMedia(file.type.startsWith('video/')?video:audio,URL.createObjectURL(file));
 if(previousMode==='demo'){project={schema:'sorimoi/1',title:file.name,source_url:'',duration_ms:0,cues:[],engine:{}};selectedId=null;}else{project.title=file.name;}
 updateHeader();renderEditor();status('파일을 읽는 중입니다…');$('#mediaInput').disabled=true;
 try{const {decodeFile}=await import('./analyze.js');samples=await decodeFile(file);project.duration_ms=Math.round(samples.length/16);drawWave();$('#analyzeBtn').disabled=false;status('파일을 준비했습니다. ‘소리 결 분석’을 누르거나, VTT 자막을 가져오세요. 파일은 기기 밖으로 전송되지 않습니다.');}
 catch(e){status('파일을 읽지 못했습니다: '+e.message);$('#analyzeBtn').disabled=true;}
 finally{$('#mediaInput').disabled=false;updateHeader();}
}
$('#editor').onsubmit=e=>{e.preventDefault();const c=project.cues.find(c=>c.id===selectedId);if(!c)return;const start=Number($('#cueStart').value)*1000,end=Number($('#cueEnd').value)*1000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<0){status('끝 시간은 시작 시간보다 뒤여야 합니다.');return;}
 Object.assign(c,{text:$('#cueText').value,start_ms:Math.round(start),end_ms:Math.round(end),kind:$('#cueKind').value,texture:$('#cueTexture').value,label:$('#cueLabel').value,strength:Number($('#cueStrength').value),reviewed:true});project.cues.sort((a,b)=>a.start_ms-b.start_ms);renderList();renderEditor();lastSig='';renderCurrent();status('수정하고 검수했습니다. 확장에 적용하려면 ‘검수 자막 저장’을 눌러주세요.');
};
$('#deleteCue').onclick=()=>{project.cues=project.cues.filter(c=>c.id!==selectedId);selectedId=project.cues[0]?.id;renderList();renderEditor();lastSig='';renderCurrent();};
$('#newCue').onclick=()=>{const c={id:crypto.randomUUID(),start_ms:Math.round(current*1000),end_ms:Math.round(current*1000+2000),text:'새 소리',texture:'velvet',kind:'sound',strength:.5,reviewed:false,source:'직접 작성'};project.cues.push(c);chooseCue(c.id,false);$('#cueText').focus();};
$('#cueStrength').oninput=e=>$('#strengthValue').textContent=Math.round(e.target.value*100)+'%';
$('#playBtn').onclick=async()=>{if(!media.src){status('미리 볼 소리·영상 파일을 열어주세요.');return;}if(media.paused){if(media.ended)media.currentTime=0;try{await media.play();}catch(e){status('재생할 수 없습니다: '+e.message);}}else media.pause();};
for(const m of [audio,video]){m.addEventListener('play',()=>{playing=true;$('#playBtn').textContent='Ⅱ';$('#playBtn').setAttribute('aria-label','일시 정지');});m.addEventListener('pause',()=>{playing=false;$('#playBtn').textContent='▶';$('#playBtn').setAttribute('aria-label','재생');});m.addEventListener('timeupdate',renderCurrent);m.addEventListener('loadedmetadata',()=>{project.duration_ms=Math.round(m.duration*1000);renderCurrent();});m.addEventListener('error',()=>status('이 브라우저가 해당 미디어를 재생하지 못했습니다. WAV·MP3·MP4 파일을 시도해주세요.'));}
$('#seek').oninput=e=>{current=Number(e.target.value);if(media.src)media.currentTime=current;renderCurrent();};
$('#muteBtn').onclick=()=>{media.muted=!media.muted;$('#muteBtn').textContent=media.muted?'×♪':'♪';$('#muteBtn').setAttribute('aria-label',media.muted?'소리 켜기':'소리 끄기');};
$('#fullBtn').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('#stage').requestFullscreen().catch(e=>status(e.message));};
$('#amount').oninput=e=>{prefs.amount=Number(e.target.value);syncPrefs();};$('#size').oninput=e=>{prefs.size=Number(e.target.value);syncPrefs();};$('#motion').onchange=e=>{prefs.motion=e.target.checked;syncPrefs();};$('#plain').onchange=e=>{prefs.plain=e.target.checked;syncPrefs();};
$$('#detail button').forEach(b=>b.onclick=()=>{prefs.detail=Number(b.dataset.level);syncPrefs();});$('#demoBtn').onclick=loadDemo;$('#mediaInput').onchange=e=>openMedia(e.target.files[0]);
$('#captionInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(abort){status('분석을 취소한 뒤 자막을 가져와주세요.');return;}if(file.size>5*1024*1024){status('자막 파일은 5MB 이하만 지원합니다.');return;}
 try{const text=await file.text();if(file.name.toLowerCase().endsWith('.json')){project=validateProject(JSON.parse(text));if(mode==='demo'){setMedia(audio,'');samples=null;}mode='restored';}
 else{const result=parseVtt(text);if(mode==='demo'){setMedia(audio,'');samples=null;project={schema:'sorimoi/1',title:file.name,source_url:'',duration_ms:0,cues:[],engine:{}};mode='restored';}project.cues=[...project.cues.filter(c=>c.kind!=='speech'),...result.cues].sort((a,b)=>a.start_ms-b.start_ms);if(result.errors.length)status(`자막을 가져왔습니다. 구문 오류 ${result.errors.length}개가 있어 일부 구간을 건너뛰었습니다.`);}
 selectedId=project.cues[0]?.id;updateHeader();renderEditor();status(`자막 ${project.cues.length}개를 가져왔습니다. 시간·글자를 확인하고 검수해주세요.`);
 }catch(err){status(err.message);}finally{e.target.value='';}
};
$('#analyzeBtn').onclick=async()=>{
 if(!samples?.length||abort)return;abort=new AbortController();const thisRun=++runId,signal=abort.signal;media.pause();$('#analyzeBtn').disabled=true;$('#cancelBtn').hidden=false;$('#progress').hidden=false;$('#progress').value=0;status('기기 내 소리 모델을 준비합니다. 처음에는 잠시 걸릴 수 있어요.');
 try{const {analyzeAudio}=await import('./analyze.js');const result=await analyzeAudio(samples,{threshold:Number($('#threshold').value),signal,onProgress:p=>{$('#progress').value=p;status(`소리를 분석합니다 · ${Math.round(p*100)}%`);}});
  if(signal.aborted||thisRun!==runId)return;
  project.cues=[...project.cues.filter(c=>c.kind==='speech'||c.reviewed),...result.cues.map(c=>({...c,id:crypto.randomUUID()}))].sort((a,b)=>a.start_ms-b.start_ms);project.engine={sound:'YAMNet tfjs/1',threshold:Number($('#threshold').value),frame_ms:960,hop_ms:480,backend:result.backend};mode=mode==='demo'?'demo':mode;selectedId=result.cues.length?project.cues.find(c=>!c.reviewed)?.id:project.cues[0]?.id;updateHeader();renderEditor();
  status(result.cues.length?`${result.cues.length}개의 소리 후보를 찾았습니다. 시작·끝은 약 0.48초 간격의 추정치입니다. 후보를 듣고 검수해주세요.`:'설정한 기준을 넘는 질감 소리 후보를 찾지 못했습니다. 기준 점수를 낮추거나 직접 자막을 추가할 수 있습니다.');
 }catch(e){status(e.name==='AbortError'?'분석을 취소했습니다.':'분석을 완료하지 못했습니다: '+e.message);}
 finally{abort=null;$('#analyzeBtn').disabled=!samples?.length;$('#cancelBtn').hidden=true;$('#progress').hidden=true;}
};
$('#cancelBtn').onclick=()=>{abort?.abort();status('진행 중인 분석 창을 마친 뒤 취소합니다…');};
$('#sourceUrl').onchange=e=>project.source_url=e.target.value.trim();
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#jsonExport').onclick=()=>download(new Blob([JSON.stringify(validateProject(project),null,2)],{type:'application/json'}),'sorimoi-project.json');$('#vttExport').onclick=()=>download(new Blob([toVtt(project)],{type:'text/vtt'}),'sorimoi-captions.vtt');
$('#saveBtn').onclick=async()=>{try{project.source_url=$('#sourceUrl').value.trim();if(project.source_url){const url=new URL(project.source_url);if(!/^https?:$/.test(url.protocol))throw new Error('영상 주소는 http 또는 https 주소를 넣어주세요.');}
 const valid=validateProject(project);if(!valid.cues.some(c=>c.reviewed))throw new Error('먼저 자막을 검수해주세요.');
 if(extension){await chrome.storage.local.set({project:valid,prefs});status(`검수한 자막 ${valid.cues.filter(c=>c.reviewed).length}개를 저장했습니다. 영상 탭에서 소리모이 아이콘 → ‘이 페이지 영상에 적용’을 누르세요.`);}
 else{download(new Blob([JSON.stringify(valid,null,2)],{type:'application/json'}),'sorimoi-project.json');status('JSON을 저장했습니다. 설치한 소리모이 확장의 스튜디오에서 가져온 뒤 저장해주세요.');}
 }catch(e){status(e.message);}};
$('#helpBtn').onclick=$('#aboutBtn').onclick=()=>$('#help').showModal();$('.close-dialog').onclick=()=>$('#help').close();$('#help').addEventListener('click',e=>{if(e.target===$('#help'))$('#help').close();});
initPalette();loadDemo();syncPrefs();new ResizeObserver(drawWave).observe($('#wave'));
if(!extension)$('#saveHint').textContent='확장으로 가져올 JSON 저장';
if(extension){const saved=await chrome.storage.local.get(['project','prefs']);if(saved.prefs){prefs={...DEFAULT_PREFS,...saved.prefs};syncPrefs();}if(saved.project){try{project=validateProject(saved.project);mode='restored';samples=null;setMedia(audio,'');selectedId=project.cues[0]?.id;updateHeader();renderEditor();status('저장한 자막을 불러왔습니다. 소리·영상 파일을 다시 열면 이어서 검수할 수 있습니다.');}catch(e){status('저장된 자막을 읽지 못했습니다: '+e.message);}}}
function loop(){if(playing)renderCurrent();requestAnimationFrame(loop);}loop();
