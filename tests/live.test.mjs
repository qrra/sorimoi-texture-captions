import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioRing,audioFeatures,cleanTranscript,acceptSpeechResult} from '../src/live-core.mjs';
test('최근 오디오만 유한한 메모리에 보관하고 쇼츠 이동 때 비운다',()=>{const ring=new AudioRing(4);ring.push([1,2,3]);ring.push([4,5,6]);assert.deepEqual([...ring.latest(4)],[3,4,5,6]);ring.clear();assert.equal(ring.latest(4).length,0);});
test('음량·마찰 지표는 유한하며 무음이 흔들림을 만들지 않는다',()=>{assert.equal(audioFeatures(new Float32Array(100)).level,0);const f=audioFeatures(Float32Array.from([.5,-.5,.5,-.5]));assert.equal(f.rms,.5);assert.equal(f.roughness,.75);});
test('쇼츠 이동·정지·오래된 추론 결과를 버리고 현재 재생의 결과만 받는다',()=>{const result={generation:2,capturedAt:10000};assert.equal(acceptSpeechResult(result,3,{now:11000}),false);assert.equal(acceptSpeechResult(result,2,{now:25000}),false);assert.equal(acceptSpeechResult(result,2,{now:11000,paused:true}),false);assert.equal(acceptSpeechResult(result,2,{now:11000,hasNative:true}),false);assert.equal(acceptSpeechResult(result,2,{now:11000}),true);});
test('ASR 메타 태그를 대사로 표시하지 않고 실제 마무리 대사는 보존한다',()=>{assert.equal(cleanTranscript('[음악]'),'');assert.equal(cleanTranscript('시청해 주셔서 감사합니다.'),'시청해 주셔서 감사합니다.');assert.equal(cleanTranscript('종이가 바스락거려요.'),'종이가 바스락거려요.');});
