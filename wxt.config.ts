import { defineConfig } from 'wxt';
export default defineConfig({
  vite:()=>({build:{target:'chrome120',chunkSizeWarningLimit:2000}}),
  manifest: {
    name:'소리모이 · 쇼츠 라이브 자막', version:'0.2.0',minimum_chrome_version:'120',
    description:'쇼츠·영상의 탭 소리를 기기 내에서 듣고, 대사와 효과음을 질감 있는 자막으로 표시합니다.',
    permissions:['storage','activeTab','scripting','tabCapture','offscreen'],
    content_security_policy:{extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'; connect-src 'self' blob: data:"}
  }
});
