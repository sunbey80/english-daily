/**
 * GET /api/play/session —— 发一局生词闯关题目（需登录）。
 * 题目数据全来自现有库，不调用任何模型/外部接口。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { buildPlaySession } from '@/lib/play';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false, questions: [] });
    }

    const questions = await buildPlaySession(user.id, 10);
    return NextResponse.json({ authenticated: true, questions });
  } catch (error) {
    console.error('GET /api/play/session failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
