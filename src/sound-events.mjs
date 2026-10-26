// Acoustic shapes describe the sound, never the object that made it.
export class ImpactDetector {
 constructor(){this.reset();}
 reset(){this.floor=.006;this.previous=0;this.last=-Infinity;this.low=0;this.id=0;this.age=0;}
 process(samples,now){
  let energy=0,lowEnergy=0,peak=0,crossings=0;
  for(let i=0;i<samples.length;i++){const x=samples[i];energy+=x*x;peak=Math.max(peak,Math.abs(x));this.low+=.085*(x-this.low);lowEnergy+=this.low*this.low;if(i&&x*samples[i-1]<0)crossings++;}
  const rms=Math.sqrt(energy/Math.max(1,samples.length)),duration=samples.length/16000,bass=lowEnergy/Math.max(1e-9,energy),roughness=crossings/Math.max(1,samples.length),rise=rms/Math.max(.008,this.previous),contrast=rms/Math.max(.006,this.floor);
  this.age+=duration;this.floor+=(rms-this.floor)*(1-Math.exp(-duration/1.2));this.previous=rms;
  if(this.age<.2||rms<.032||peak<.11||rise<1.7||contrast<2.8||now-this.last<420)return null;
  this.last=now;const strength=Math.min(1,Math.max(.1,(20*Math.log10(rms/.032))/20)),heavy=bass>.38;
  return {id:++this.id,text:heavy?(strength>.55?'쾅':'쿵'):(roughness>.28?'착':'탁'),texture:heavy?'bass':'tap',strength,kind:'impact',ttl:650+strength*220};
 }
}

function labelStyle(label){
 const l=label.toLowerCase();let text,texture,kind='texture',family;
 if(/slam|bang|explosion/.test(l)){text='쾅';texture='bass';kind='impact';family='slam';}
 else if(/thump|thud/.test(l)){text='쿵';texture='bass';kind='impact';family='thud';}
 else if(/clap|applause/.test(l)){text='짝';texture='tap';kind='impact';family='clap';}
 else if(/water tap/.test(l)){text='찰랑';texture='water';family='water';}
 else if(/knock|tap|click|snap|slap|wood block/.test(l)){text='탁';texture='tap';kind='impact';family='tap';}
 else if(/bark|dog/.test(l)){text='멍';texture='tap';kind='impact';family='dog';}
 else if(/rustl|crumpl|crinkl|paper|scratch|scrap|crackl/.test(l)){text=/crackl/.test(l)?'파직':'바스락';texture='grain';family='grain';}
 else if(/drip/.test(l)){text='똑';texture='water';family='water';}
 else if(/water|pour|splash|liquid|stream|rain|wave/.test(l)){text='찰랑';texture='water';family='water';}
 else if(/wind|breath|blow|whoosh|gasp|snort/.test(l)){text='후우';texture='air';family='air';}
 else return null;
 return {text,texture,kind,family};
}
export function confidentSound(values,labels){
 let chosen=null,speech=0,music=0;const families=new Map();let unknown=0;
 for(let i=0;i<values.length;i++){const v=values[i],label=labels[i]||'',style=labelStyle(label);
  if(i<=12)speech=Math.max(speech,v);if(i>=132&&i<=276)music=Math.max(music,v);
  if(style){if(v>(families.get(style.family)||0))families.set(style.family,v);if(!chosen||v>chosen.score)chosen={...style,score:v};}
  else if(!/^(Door|Animal|Domestic animals, pets|Human sounds|Hands|Inside.*|Outside.*|Sound effect)$/i.test(label))unknown=Math.max(unknown,v);
 }
 if(!chosen||chosen.score<.38||speech>.28||music>.28)return null;
 let competitor=unknown;for(const [family,value]of families)if(family!==chosen.family)competitor=Math.max(competitor,value);
 if(chosen.score-competitor<.10)return null;
 return chosen;
}
