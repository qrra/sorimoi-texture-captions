import {browser} from 'wxt/browser';
import {installLiveOverlay,removeLiveOverlay} from '../src/live-overlay.mjs';
import {DEFAULT_PREFS} from '../src/core.mjs';
import textureCSS from '../src/texture.css?inline';
export default defineBackground(()=>{
 let creating:Promise<void>|null=null;
 const contexts=()=>browser.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT' as any]});
 async function ensureOffscreen(){if((await contexts()).length)return;if(!creating)creating=browser.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA','AUDIO_PLAYBACK','WORKERS'] as any,justification:'사용자가 켠 탭의 소리를 기기 내에서 인식하고 자막으로 표시합니다.'}).finally(()=>creating=null);await creating;}
 async function state(){return (await browser.storage.session.get('liveState')).liveState||{phase:'idle'};}
 async function stop(){const current=await state();if((await contexts()).length)await browser.runtime.sendMessage({target:'offscreen',type:'STOP'}).catch(()=>{});if(current.tabId)await browser.scripting.executeScript({target:{tabId:current.tabId},func:removeLiveOverlay}).catch(()=>{});await browser.storage.session.set({liveState:{phase:'idle'}});await browser.action.setBadgeText({text:''});}
 browser.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.target!=='background')return;
  (async()=>{
   if(message.type==='STATUS')return state();
   if(message.type==='REPLAY'){const current=await state();if(!current.tabId)return {ok:false,error:'먼저 효과음을 켜주세요.'};return browser.tabs.sendMessage(current.tabId,{type:'SORIMOI_REPLAY'});}
   if(message.type==='STOP'){await stop();return {ok:true};}
   if(message.type==='START'){
    await stop();const [tab]=await browser.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!/^https?:\/\//.test(tab.url||''))throw new Error('YouTube 쇼츠나 일반 영상 페이지를 연 뒤 눌러주세요.');
    const prefs={...DEFAULT_PREFS,...(await browser.storage.local.get('prefs')).prefs};
    await browser.storage.session.set({liveState:{phase:'connecting',tabId:tab.id,text:'재생 소리를 연결합니다.'}});
    try{await ensureOffscreen();const streamId=await browser.tabCapture.getMediaStreamId({targetTabId:tab.id});const result=await browser.runtime.sendMessage({target:'offscreen',type:'START',streamId,tabId:tab.id,prefs});if(!result?.ok)throw new Error(result?.error||'소리 연결 실패');await browser.scripting.executeScript({target:{tabId:tab.id},func:installLiveOverlay,args:[prefs,textureCSS]});await browser.action.setBadgeText({text:'ON'});await browser.action.setBadgeBackgroundColor({color:'#506740'});return {ok:true};}
    catch(error){await stop();throw error;}
   }
   if(message.type==='SORIMOI_CONTEXT'){
    const current=await state();if(sender.tab?.id!==current.tabId)return {ok:false};if((await contexts()).length)await browser.runtime.sendMessage({...message,target:'offscreen',type:'CONTEXT'}).catch(()=>{});return {ok:true};
   }
   if(message.type==='LIVE_UPDATE'){
    const current=await state();if(!sender.url?.startsWith(browser.runtime.getURL('/offscreen.html'))||current.tabId!==message.tabId)return {ok:false};
    const next={...current,...message.state};if(message.state)await browser.storage.session.set({liveState:next});
    await browser.tabs.sendMessage(current.tabId,{type:'SORIMOI_LIVE',...message.payload}).catch(()=>{});return {ok:true};
   }
  })().then(respond,error=>respond({ok:false,error:error.message}));return true;
 });
 browser.tabs.onRemoved.addListener(async tabId=>{if((await state()).tabId===tabId)await stop();});
 browser.tabs.onUpdated.addListener(async(tabId,change)=>{if(change.status==='loading'&&(await state()).tabId===tabId)await stop();});
});
