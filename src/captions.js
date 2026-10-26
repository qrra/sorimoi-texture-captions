import vtt from 'vtt.js';
import {stripMarkup} from './core.mjs';
export function parseVtt(input){
 const errors=[],cues=[];
 const parser=new vtt.WebVTT.Parser({VTTCue:vtt.VTTCue,VTTRegion:vtt.VTTRegion},vtt.WebVTT.StringDecoder());
 parser.oncue=c=>{if(c.endTime>c.startTime)cues.push({id:`vtt-${cues.length}`,start_ms:Math.round(c.startTime*1000),end_ms:Math.round(c.endTime*1000),text:stripMarkup(c.text),kind:'speech',texture:'velvet',strength:0.45,reviewed:false,source:'vtt.js 0.13.0'});};
 parser.onparsingerror=e=>errors.push(e.message);
 parser.parse(input.replace(/^\uFEFF/,''));parser.flush();
 if(!cues.length)throw new Error('읽을 수 있는 WebVTT 자막이 없습니다. WEBVTT 헤더와 시간을 확인해주세요.');
 return {cues,errors};
}
