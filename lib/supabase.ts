import { createClient } from '@supabase/supabase-js';

// 重要：
// 1) 不要在模块顶层 throw —— 否则 next build 收集页面数据时（导入即触发）失败。
// 2) NEXT_PUBLIC_* 必须用「静态属性访问」process.env.NEXT_PUBLIC_XXX 读取，
//    Next 才会在构建期把它内联成字面量。动态写法 process.env[name] 不会被内联，
//    在 Cloudflare Worker 运行时取不到值（NEXT_PUBLIC 只在构建期内联，非运行时变量）。
// 3) SUPABASE_SECRET_KEY 是 Worker 运行时 secret，由 OpenNext 注入 process.env。

/**
 * 浏览器/匿名端 client：受 RLS 约束，只能读写当前登录用户允许的数据。
 * 用于前端组件与走用户 JWT 的请求。
 */
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!publishableKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return createClient(url, publishableKey);
}

/**
 * 服务端 client：使用 secret key，绕过 RLS，拥有完整读写权限。
 * 仅在服务端（API route / Cron / 脚本）使用，绝不暴露给浏览器。
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!secretKey) throw new Error('Missing SUPABASE_SECRET_KEY (server-only)');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
