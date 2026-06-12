/**
 * GET /api/notebook —— 返回用户生词本（state=1 的词 + 出处章节，§6）。
 * TODO: 查 user_word(state=1) join word，附出处章节。
 */
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
