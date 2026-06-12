/**
 * GET /api/notebook —— 返回用户生词本（state=1 的词 + 出处章节，§6）。
 * 未登录时返回空列表；MVP 阶段不强制登录。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { getNotebookItems } from '@/lib/notebook';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const items = await getNotebookItems(user?.id ?? null);

    return NextResponse.json({
      authenticated: Boolean(user),
      items,
    });
  } catch (error) {
    console.error('GET /api/notebook failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
