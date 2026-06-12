import type { User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

import { createServiceClient } from '@/lib/supabase';

export function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

/**
 * 从请求 Bearer token 解析当前用户。未登录或 token 无效时返回 null，
 * 方便 MVP 阶段继续提供未登录可用的通用阅读体验。
 */
export async function getRequestUser(request: NextRequest): Promise<User | null> {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) {
    console.warn('auth skipped', error.message);
    return null;
  }

  return data.user;
}
