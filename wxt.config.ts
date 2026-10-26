import { defineConfig } from 'wxt';
export default defineConfig({
  vite:()=>({build:{target:'chrome120',chunkSizeWarningLimit:2000}}),
  manifest: {
    name:'소리모이 · 소리의 결', version:'0.1.0',minimum_chrome_version:'120',
    description:'검수한 소리 이벤트와 대사를 질감 있는 자막으로 표시합니다.',
    permissions:['storage','activeTab','scripting'],
    content_security_policy:{extension_pages:"script-src 'self'; object-src 'self'"}
  }
});
