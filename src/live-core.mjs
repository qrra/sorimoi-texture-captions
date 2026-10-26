export class AudioRing {
 constructor(capacity=192000){this.data=new Float32Array(capacity);this.written=0;this.available=0;}
 push(block){for(const sample of block){this.data[this.written++%this.data.length]=sample;}this.available=Math.min(this.data.length,this.available+block.length);}
 latest(length){const count=Math.min(length,this.available),out=new Float32Array(count),start=this.written-count;for(let i=0;i<count;i++)out[i]=this.data[(start+i)%this.data.length];return out;}
 clear(){this.written=0;this.available=0;}
}
export function audioFeatures(audio){let sum=0,crossings=0;for(let i=0;i<audio.length;i++){sum+=audio[i]**2;if(i&&audio[i]*audio[i-1]<0)crossings++;}const rms=Math.sqrt(sum/Math.max(1,audio.length));return {rms,level:Math.max(0,Math.min(1,(20*Math.log10(rms+1e-8)+55)/45)),roughness:crossings/Math.max(1,audio.length)};}
export function cleanTranscript(text){const t=String(text||'').trim().replace(/\s+/g,' ');if(!t||/^\s*[[(].*[\])]\s*$/.test(t))return '';if(t.length>180)return t.slice(0,180);return t;}
export function acceptSpeechResult(result,current,{paused=false,hasNative=false,now=Date.now()}={}){return result.generation===current&&!paused&&!hasNative&&now-result.capturedAt<14000;}
