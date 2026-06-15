/**
 * POST /api/profile —— 登录后确保 profile 行存在。
 * 冷启动词表初始化属于下一步任务，这里只创建业务用户壳。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('profile').upsert(
    {
      id: user.id,
      level: 'cet4',
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.error('POST /api/profile failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
