import {browser} from 'wxt/browser';
import {installOverlay,removeOverlay} from '../../src/inject.mjs';
import {DEFAULT_PREFS,validateProject} from '../../src/core.mjs';
import css from '../../src/texture.css?inline';
import './style.css';
const $=s=>document.querySelector(s);let data=await browser.storage.local.get(['project','prefs']);
$('#motion').checked=!!data.prefs?.motion;$('#amount').value=data.prefs?.amount??.65;
for(const id of ['motion','amount'])$('#'+id).onchange=async()=>{data=await browser.storage.local.get('prefs');await browser.storage.local.set({prefs:{...DEFAULT_PREFS,...data.prefs,motion:$('#motion').checked,amount:Number($('#amount').value)}});};
async function refresh(){try{const state=await browser.runtime.sendMessage({target:'background',type:'STATUS'});const on=state?.phase&&state.phase!=='idle'&&state.phase!=='ended';$('#liveStart').hidden=!!on;$('#liveStop').hidden=!on;if(on){$('#summary').textContent=state.text||'재생 소리에 연결했습니다.';if(state.speechError)$('#status').textContent='음성 모델 오류: '+state.speechError;}else $('#summary').textContent='쇼츠나 영상을 재생한 뒤 아래 버튼을 누르세요.';}catch(e){$('#status').textContent=e.message;}}
$('#liveStart').onclick=async()=>{try{$('#liveStart').disabled=true;$('#status').textContent='현재 탭 소리를 연결합니다…';const result=await browser.runtime.sendMessage({target:'background',type:'START'});if(!result?.ok)throw new Error(result?.error||'소리에 연결하지 못했습니다.');$('#status').textContent='연결했습니다. 팝업을 닫고 영상을 보세요.';await refresh();}catch(e){$('#status').textContent=e.message;}finally{$('#liveStart').disabled=false;}};
$('#liveStop').onclick=async()=>{await browser.runtime.sendMessage({target:'background',type:'STOP'});$('#status').textContent='탭 소리 분석과 라이브 자막을 껐습니다.';await refresh();};
refresh();setInterval(refresh,1200);
$('#studio').onclick=()=>browser.tabs.create({url:browser.runtime.getURL('/studio.html')});
async function run(fn,args=[]){
 const [tab]=await browser.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw new Error('열린 페이지를 찾을 수 없습니다.');
 if(!/^https?:|^file:/.test(tab.url||''))throw new Error('일반 웹페이지의 영상을 연 뒤 눌러주세요.');
 return (await browser.scripting.executeScript({target:{tabId:tab.id},func:fn,args}))[0]?.result;
}
$('#apply').onclick=async()=>{try{
 data=await browser.storage.local.get(['project','prefs']);if(!data.project)throw new Error('먼저 스튜디오에서 자막을 저장해주세요.');
 const p=validateProject(data.project);if(!p.cues.some(c=>c.reviewed))throw new Error('스튜디오에서 자막을 검수하고 저장해주세요.');
 const [tab]=await browser.tabs.query({active:true,currentWindow:true});
 if(p.source_url){const a=new URL(p.source_url),b=new URL(tab.url);const same=a.hostname===b.hostname&&a.pathname===b.pathname&&a.searchParams.get('v')===b.searchParams.get('v');if(!same)throw new Error('저장된 영상 주소와 다릅니다. 스튜디오에서 대상 영상 주소를 확인해주세요.');}
 const result=await run(installOverlay,[p,{...DEFAULT_PREFS,...data.prefs},css]);if(!result?.ok)throw new Error(result?.error||'자막을 표시하지 못했습니다.');$('#status').textContent=`검수한 자막 ${result.count}개를 연결했습니다. 영상의 재생 시간에 맞춰 표시합니다.`;
}catch(e){$('#status').textContent=e.message;}};
$('#remove').onclick=async()=>{try{await run(removeOverlay);$('#status').textContent='이 페이지의 소리모이 자막을 껐습니다.';}catch(e){$('#status').textContent=e.message;}};
