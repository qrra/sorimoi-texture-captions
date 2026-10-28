import {browser} from 'wxt/browser';
import {installOverlay,removeOverlay} from '../../src/inject.mjs';
import {DEFAULT_PREFS,validateProject} from '../../src/core.mjs';
import css from '../../src/texture.css?inline';
import './style.css';
const $=s=>document.querySelector(s);let data=await browser.storage.local.get(['project','prefs']);
// Older builds had no size control; their stored 1.0 was the implicit default.
if(data.prefs?.size==null||Number(data.prefs.size)===1){data.prefs={...data.prefs,size:DEFAULT_PREFS.size};await browser.storage.local.set({prefs:data.prefs});}
$('#motion').checked=data.prefs?.impactMotion!==false;$('#speechFallback').checked=data.prefs?.speechFallback!==false;$('#amount').value=data.prefs?.amount??.65;$('#size').value=data.prefs?.size??DEFAULT_PREFS.size;$('#sizeValue').value=`${Math.round(Number($('#size').value)*100)}%`;
$('#size').oninput=()=>{$('#sizeValue').value=`${Math.round(Number($('#size').value)*100)}%`;};
for(const id of ['motion','amount','speechFallback','size'])$('#'+id).onchange=async()=>{data=await browser.storage.local.get('prefs');const prefs={...DEFAULT_PREFS,...data.prefs,impactMotion:$('#motion').checked,speechFallback:$('#speechFallback').checked,amount:Number($('#amount').value),size:Number($('#size').value)};await browser.storage.local.set({prefs});if(id==='size')await browser.runtime.sendMessage({target:'background',type:'UPDATE_TEXT_SIZE',size:prefs.size});};
async function refresh(){try{
 const [state,tabs]=await Promise.all([browser.runtime.sendMessage({target:'background',type:'STATUS'}),browser.tabs.query({active:true,currentWindow:true})]);
 const on=state?.tabId===tabs[0]?.id&&state?.phase&&!['idle','ended'].includes(state.phase);
 $('#liveStart').hidden=false;$('#liveStart').textContent=on?'자막 다시 연결':'자막 시작';$('#liveStop').hidden=!on;$('#replay').hidden=!on||!state.preparedCount;
 $('#summary').textContent=on?(state.text||'자막을 준비하고 있어요.'):state?.phase==='ended'&&state.tabId===tabs[0]?.id?(state.text||'자막 시작을 다시 눌러주세요.'):'영상을 재생하고 자막 시작을 눌러주세요.';
 }catch{$('#summary').textContent='연결이 끊겼어요. 확장 관리에서 새로고침 후 다시 열어주세요.';}}

$('#liveStart').onclick=async()=>{try{$('#liveStart').disabled=true;$('#status').textContent='현재 탭 소리를 연결합니다…';const result=await browser.runtime.sendMessage({target:'background',type:'START'});if(!result?.ok)throw new Error(result?.error||'소리에 연결하지 못했습니다.');$('#status').textContent='영상 위에 자막 준비 상태가 표시됩니다. 팝업을 닫아도 됩니다.';await refresh();}catch(e){$('#status').textContent=e.message;}finally{$('#liveStart').disabled=false;}};
$('#liveStop').onclick=async()=>{await browser.runtime.sendMessage({target:'background',type:'STOP'});$('#status').textContent='자막을 껐습니다.';await refresh();};
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

$('#replay').onclick=async()=>{const r=await browser.runtime.sendMessage({target:'background',type:'REPLAY'});$('#status').textContent=r?.ok?'분석된 구간을 시간에 맞춰 다시 재생합니다.':r?.error||'아직 분석된 대사가 없습니다.';};
