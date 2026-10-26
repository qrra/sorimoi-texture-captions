import test from 'node:test';
import assert from 'node:assert/strict';
import {activeCues,validateProject,framesToCues,toVtt} from '../src/core.mjs';
import {parseVtt} from '../src/captions.js';
test('한글 WebVTT와 겹친 cue를 유지하고 ms로 변환한다',()=>{
 const {cues}=parseVtt('\uFEFFWEBVTT\n\n00:00:01.250 --> 00:00:03.000\n안녕 <b>소리</b>\n\n00:00:02.000 --> 00:00:04.000\n두 번째\n');
 assert.equal(cues[0].start_ms,1250);assert.equal(cues[0].text,'안녕 소리');assert.equal(activeCues(cues,2500).length,2);assert.equal(activeCues(cues,4000).length,0);
});
test('역방향 시간·과한 입력을 거절하고 표시 텍스트를 정리한다',()=>{
 assert.throws(()=>validateProject({schema:'sorimoi/1',cues:[{start_ms:4,end_ms:2,text:'a'}]}));
 const p=validateProject({schema:'sorimoi/1',cues:[{start_ms:0,end_ms:2000,text:'<img src=x>안녕',strength:20}]});
 assert.equal(p.cues[0].text,'안녕');assert.equal(p.cues[0].strength,1);assert.equal(p.cues[0].reviewed,false);
});
test('분류 창의 후보를 시간별로 합치고 낮은 점수·무음을 제외한다',()=>{
 const f={label:'Rustle',score:.7,runnerUp:.2,rms:.1,strength:.5};
 const cues=framesToCues([{...f,start_ms:0,end_ms:960},{...f,start_ms:480,end_ms:1440},{...f,start_ms:5000,end_ms:5960},{...f,start_ms:7000,end_ms:7960,rms:0},{...f,start_ms:9000,end_ms:9960,score:.1}]);
 assert.equal(cues.length,2);assert.equal(cues[0].end_ms,1440);assert.equal(cues[0].reviewed,false);
});
test('VTT 왕복과 구간 경계를 보존한다',()=>{
 const project={cues:[{text:'찰랑',kind:'sound',start_ms:1250,end_ms:3050},{text:'이야기',kind:'speech',start_ms:3050,end_ms:4100}]};
 const {cues}=parseVtt(toVtt(project));assert.equal(cues[0].text,'[찰랑]');assert.equal(activeCues(cues,3050).length,1);assert.equal(activeCues(cues,3050)[0].text,'이야기');
});
