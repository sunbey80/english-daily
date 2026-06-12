/**
 * GET /api/today —— 返回当前用户当日章节（个性化版优先，无则通用版）。
 * TODO: 接 Supabase Auth 后，从用户 JWT 解析 user_id，再优先查个性化章节。
 */
import { NextResponse } from 'next/server';

import { getTodayChapter } from '@/lib/today';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // MVP 暂不强制登录，先返回最新已发布通用版章节。
    const chapter = await getTodayChapter();

    if (!chapter) {
      return NextResponse.json({ error: 'no_chapter' }, { status: 404 });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('GET /api/today failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
