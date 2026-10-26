export function speechCues(result){
 const start=result.mediaStart,rate=result.rate||1,duration=result.duration;
 if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0||!Array.isArray(result.chunks))return [];
 return result.chunks.slice(0,50).flatMap(c=>{const a=c.timestamp?.[0],b=c.timestamp?.[1]??duration,text=String(c.text||'').trim().replace(/\s+/g,' ');
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||a>=duration||!text||text.length>240)return [];
  return [{start:start+a*rate,end:start+Math.min(b,duration)*rate,text}];});
}
export function mergeSpeech(existing,incoming){
 const next=existing.filter(old=>!incoming.some(c=>Math.min(old.end,c.end)-Math.max(old.start,c.start)>.5*Math.min(old.end-old.start,c.end-c.start)));
 return [...next,...incoming].sort((a,b)=>a.start-b.start).slice(-500);
}
export function cueAt(cues,time){return cues.find(c=>time>=c.start&&time<c.end)||null;}
export function timelyEvent(event,{time,now,generation,paused,rate=1}){
 return !paused&&event.generation===generation&&Number.isFinite(event.mediaTime)&&Number.isFinite(event.capturedAt)&&now-event.capturedAt>=-50&&now-event.capturedAt<180&&Math.abs(time-event.mediaTime)<.22*Math.max(.5,rate);
}

export function groupSpeech(words){
 const groups=[];let current;
 for(const w of words){if(!current||w.start-current.end>.45||current.text.length+w.text.length>24||current.words.length>=5){current={start:w.start,end:w.end,text:w.text,words:[w]};groups.push(current);}else{current.end=w.end;current.text+=' '+w.text;current.words.push(w);}}
 return groups;
}
