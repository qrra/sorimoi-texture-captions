import {browser} from 'wxt/browser';
import {installOverlay,removeOverlay} from '../../src/inject.mjs';
import {DEFAULT_PREFS,validateProject} from '../../src/core.mjs';
import css from '../../src/texture.css?inline';
import './style.css';
const $=s=>document.querySelector(s);let data=await browser.storage.local.get(['project','prefs']);
$('#summary').textContent=data.project?`${data.project.title} · 검수 ${data.project.cues.filter(c=>c.reviewed).length}개`:'스튜디오에서 파일을 분석하거나 체험 자막을 저장해주세요.';
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
