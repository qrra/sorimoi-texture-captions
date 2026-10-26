export const DEMO_CUES=[
 {text:'바스락',texture:'grain',label:'종이의 마른 마찰',start_ms:500,end_ms:3500},
 {text:'톡, 톡',texture:'tap',label:'나무를 두드리는 단단함',start_ms:4400,end_ms:7300},
 {text:'찰랑',texture:'water',label:'물방울의 둥근 여운',start_ms:8400,end_ms:11500},
 {text:'사아아',texture:'air',label:'공기가 퍼지는 가는 결',start_ms:12400,end_ms:15500},
 {text:'나직이',texture:'velvet',label:'가까이 감싸는 부드러움',start_ms:16400,end_ms:19500},
 {text:'우웅',texture:'bass',label:'낮고 묵직한 울림',start_ms:20400,end_ms:23500},
].map((c,i)=>({...c,id:`demo-${i}`,kind:'sound',strength:[.55,.8,.6,.35,.3,.75][i],reviewed:true,source:'직접 합성한 체험용 소리 · 수동 디자인'}));
export function demoProject(){return {schema:'sorimoi/1',title:'여섯 가지 소리의 표면',source_url:'',duration_ms:24000,cues:DEMO_CUES.map(c=>({...c})),engine:{demo:true}};}
export function synthesizeDemo(){
 const sampleRate=16000,samples=new Float32Array(24*sampleRate);let seed=27,low=0;
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296*2-1;};
 for(let i=0;i<samples.length;i++){
  const t=i/sampleRate,section=Math.floor(t/4),u=t%4,env=Math.min(1,Math.max(0,(u-.2)*3))*Math.min(1,(4-u)*3),n=random();low=low*.97+n*.03;let s=0;
  if(section===0)s=(n*.08+low*.3)*(Math.sin(u*17)**6+.15)*(random()>.97?2:1);
  if(section===1){const z=u%.68;s=(Math.sin(z*1300)+Math.sin(z*2100)*.35)*Math.exp(-z*42)*.26;}
  if(section===2){const z=u%.71;s=Math.sin(2*Math.PI*(920*z-310*z*z))*Math.exp(-z*10)*.22+low*.2;}
  if(section===3)s=(n*.035+low*.35)*(.5+.5*Math.sin(u*1.4));
  if(section===4)s=(low*.35+Math.sin(t*2*Math.PI*174)*.018)*Math.sin(u*.8)**2;
  if(section===5)s=(Math.sin(t*2*Math.PI*72)*.1+Math.sin(t*2*Math.PI*74)*.04)*Math.sin(Math.PI*u/4);
  samples[i]=Math.max(-1,Math.min(1,s*env));
 }
 return samples;
}
export function wavBlob(samples,sampleRate=16000){
 const b=new ArrayBuffer(44+samples.length*2),d=new DataView(b);const put=(o,s)=>[...s].forEach((c,i)=>d.setUint8(o+i,c.charCodeAt(0)));
 put(0,'RIFF');d.setUint32(4,36+samples.length*2,true);put(8,'WAVE');put(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sampleRate,true);d.setUint32(28,sampleRate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);put(36,'data');d.setUint32(40,samples.length*2,true);
 samples.forEach((s,i)=>d.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true));return new Blob([b],{type:'audio/wav'});
}
