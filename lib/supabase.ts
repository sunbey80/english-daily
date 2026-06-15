import { createClient } from '@supabase/supabase-js';

// 注意：env 校验放在函数内（调用时），不要放模块顶层。
// 顶层 throw 会在 next build 收集页面数据时（导入路由模块即触发）报错，
// 导致构建失败（"Failed to collect page data"）。
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

/**
 * 浏览器/匿名端 client：受 RLS 约束，只能读写当前登录用户允许的数据。
 * 用于前端组件与走用户 JWT 的请求。
 */
export function createBrowserClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  );
}

/**
 * 服务端 client：使用 secret key，绕过 RLS，拥有完整读写权限。
 * 仅在服务端（API route / Cron / 脚本）使用，绝不暴露给浏览器。
 */
export function createServiceClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SECRET_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
