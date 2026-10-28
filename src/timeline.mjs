export function speechCues(result){
 const start=result.mediaStart,rate=result.rate||1,duration=result.duration;
 if(!Number.isFinite(start)||!Number.isFinite(duration)||duration<=0||!Array.isArray(result.chunks))return [];
 const words=result.chunks.slice(0,50).flatMap(c=>{const a=c.timestamp?.[0],b=c.timestamp?.[1]??duration,text=String(c.text||'').trim().replace(/\s+/g,' ');
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<=a||a>=duration||!text||text.length>240)return [];
  const envelope=result.volumeEnvelope||[],overlap=envelope.map(frame=>({frame,duration:Math.max(0,Math.min(b,frame.end)-Math.max(a,frame.start))})).filter(x=>x.duration>0);
  const total=overlap.reduce((sum,x)=>sum+x.duration,0),rms=total?Math.sqrt(overlap.reduce((sum,x)=>sum+x.frame.rms**2*x.duration,0)/total):null;
  return [{start:start+a*rate,end:start+Math.min(b,duration)*rate,text,rms}];});
 const logged=words.map(w=>Number.isFinite(w.rms)?20*Math.log10(w.rms+1e-5):null).filter(Number.isFinite).sort((a,b)=>a-b);
 const low=logged[Math.floor((logged.length-1)*.1)]??-50,high=logged[Math.ceil((logged.length-1)*.9)]??low+1;
 return words.map(w=>{const spread=high-low,db=Number.isFinite(w.rms)?20*Math.log10(w.rms+1e-5):null;return {...w,volume:Number.isFinite(db)&&spread>=3?Math.max(0,Math.min(1,(db-low)/spread)):.5};});
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
