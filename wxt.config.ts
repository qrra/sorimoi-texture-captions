import { defineConfig } from 'wxt';
export default defineConfig({
  vite:()=>({build:{target:'chrome120',chunkSizeWarningLimit:2000}}),
  manifest: {
    name:'소리모이 · 소리가 되는 글자', version:'0.4.0',minimum_chrome_version:'120',
    description:'쇼츠의 충격음·마찰·물소리를 작고 질감 있는 글자로 표현합니다.',
    permissions:['storage','activeTab','scripting','tabCapture','offscreen'],
    host_permissions:['http://127.0.0.1:8765/*'],
    content_security_policy:{extension_pages:"script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'; connect-src 'self' blob: data: http://127.0.0.1:8765"}
  }
});
