import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// OpenNext Cloudflare 适配配置。
// MVP 阶段页面均 force-dynamic，无需 ISR 增量缓存，默认配置即可。
export default defineCloudflareConfig();
