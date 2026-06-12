/**
 * GET /api/today —— 返回当前用户当日章节（个性化版优先，无则通用版）。
 * TODO: 取用户 JWT → 查 chapter（user_id=本人 且 publish_at<=now 优先，否则 user_id is null）。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
