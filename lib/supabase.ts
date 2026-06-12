import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

/**
 * 浏览器/匿名端 client：受 RLS 约束，只能读写当前登录用户允许的数据。
 * 用于前端组件与走用户 JWT 的请求。
 */
export function createBrowserClient() {
  if (!publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return createClient(url!, publishableKey);
}

/**
 * 服务端 client：使用 secret key，绕过 RLS，拥有完整读写权限。
 * 仅在服务端（API route / Cron / 脚本）使用，绝不暴露给浏览器。
 */
export function createServiceClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY (server-only)');
  }
  return createClient(url!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
