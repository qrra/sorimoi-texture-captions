export const TEXTURES = {
  grain:{name:'바스락 · 입자',word:'바스락',hint:'마른 종이와 잔잔한 마찰',color:'#d9c59d'},
  tap:{name:'톡톡 · 단단함',word:'톡, 톡',hint:'짧고 선명한 표면의 접촉',color:'#f0b28c'},
  water:{name:'찰랑 · 유동',word:'찰랑',hint:'둥글게 퍼지고 겹치는 물결',color:'#9ed3d9'},
  air:{name:'사아 · 숨결',word:'사아아',hint:'가늘고 넓게 번지는 공기',color:'#c6c8ef'},
  velvet:{name:'나직 · 부드러움',word:'나직이',hint:'가까이 감싸는 부드러운 결',color:'#dcb8ce'},
  bass:{name:'웅 · 무게',word:'우웅',hint:'낮게 눌리고 길게 남는 울림',color:'#b8c5aa'},
};
export const DEFAULT_PREFS={motion:false,amount:0.65,detail:2,plain:false,size:1};
export function stripMarkup(value){return String(value).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
export function validateProject(input){
  if(!input||input.schema!=='sorimoi/1'||!Array.isArray(input.cues))throw new Error('소리모이 JSON 형식이 아닙니다.');
  if(input.cues.length>10000)throw new Error('자막은 최대 10,000개까지 불러올 수 있습니다.');
  const cues=input.cues.map((c,i)=>{
    if(!Number.isFinite(c.start_ms)||!Number.isFinite(c.end_ms)||c.start_ms<0||c.end_ms<=c.start_ms||c.end_ms>86400000)throw new Error(`${i+1}번째 자막의 시작·끝 시간을 확인해주세요.`);
    if(typeof c.text!=='string'||c.text.length>1500)throw new Error(`${i+1}번째 자막의 글자가 너무 길거나 잘못되었습니다.`);
    return {id:String(c.id||`cue-${i}`).slice(0,100),start_ms:Math.round(c.start_ms),end_ms:Math.round(c.end_ms),text:stripMarkup(c.text),kind:c.kind==='speech'?'speech':'sound',texture:TEXTURES[c.texture]?c.texture:'velvet',strength:Math.max(0,Math.min(1,Number(c.strength)||0.5)),reviewed:c.reviewed===true,score:Number.isFinite(c.score)?c.score:null,label:String(c.label||'').slice(0,150),source:String(c.source||'manual').slice(0,100)};
  }).sort((a,b)=>a.start_ms-b.start_ms);
  const duration=Number(input.duration_ms);
  return {schema:'sorimoi/1',title:String(input.title||'새 자막').slice(0,180),source_url:String(input.source_url||'').slice(0,2000),duration_ms:Number.isFinite(duration)&&duration>0?Math.min(86400000,duration):Math.max(0,...cues.map(c=>c.end_ms)),cues,engine:input.engine||{}};
}
export function activeCues(cues,timeMs,detail=2){return cues.filter(c=>timeMs>=c.start_ms&&timeMs<c.end_ms&&(detail>1||c.kind==='speech'));}
export function soundStyle(label){
 const l=label.toLowerCase();
 if(/rustl|crumpl|crinkl|paper|scratch|scrap|sand|crackl|rattle|ratchet|sizzle|fry/.test(l))return {texture:'grain',text:/sizzle|fry/.test(l)?'지글지글':'바스락',label:'마찰·입자 소리'};
 if(/water|rain|stream|pour|drip|splash|liquid|bubbl|gurg|trickl|ocean|wave|boil/.test(l))return {texture:'water',text:/drip/.test(l)?'또르륵':'찰랑',label:'물소리'};
 if(/wind|breath|blow|whisper|wheez|whoosh|hiss|sigh|sniff/.test(l))return {texture:'air',text:/whisper/.test(l)?'소곤소곤':'사아아',label:'숨결·공기 소리'};
 if(/tap|knock|click|tick|snap|clap|slap|bang|chop|thump|footstep|doorbell|ding|chime|bell/.test(l))return {texture:'tap',text:/bell|ding|chime/.test(l)?'딩동':/clap/.test(l)?'짝짝':'톡, 톡',label:/bell|ding|chime/.test(l)?'종·초인종 소리':'단단한 접촉음'};
 if(/rumbl|thunder|engine|hum|drone|bass|roar|vibrat|boom/.test(l))return {texture:'bass',text:'우웅',label:'낮은 울림'};
 if(/bark|dog/.test(l))return {texture:'tap',text:'멍멍',label:'개 짖는 소리'};
 return null;
}
export function framesToCues(frames,{threshold=0.25}={}){
 const out=[];
 for(const f of frames){
   const style=soundStyle(f.label);if(!style||f.score<threshold||f.score-f.runnerUp<0.035||f.rms<0.0015)continue;
   let previous=out.findLast(c=>c.label===f.label&&f.start_ms-c.end_ms<=250);
   if(previous){previous.end_ms=Math.max(previous.end_ms,f.end_ms);previous.score=Math.max(previous.score,f.score);previous.strength=Math.max(previous.strength,f.strength);}
   else out.push({id:`sound-${out.length}-${f.start_ms}`,start_ms:f.start_ms,end_ms:f.end_ms,text:style.text,label:f.label,texture:style.texture,strength:f.strength,score:f.score,source:'YAMNet tfjs/1',reviewed:false,kind:'sound'});
 }
 return out;
}
export function toVtt(project){
 const stamp=ms=>{const h=Math.floor(ms/3600000),m=Math.floor(ms/60000)%60,s=Math.floor(ms/1000)%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
 return 'WEBVTT\n\n'+project.cues.map((c,i)=>`${i+1}\n${stamp(c.start_ms)} --> ${stamp(c.end_ms)}\n${c.kind==='sound'?'['+c.text+']':c.text}\n`).join('\n');
}
export function formatTime(sec){const s=Math.max(0,Math.floor(sec));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;}
