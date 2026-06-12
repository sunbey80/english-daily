/**
 * POST /api/generate —— 内部接口，仅 Cron 调用（§6）。
 * 用 GENERATE_SECRET 保护，不对外暴露。跑 §4 生成管线并回填。
 * TODO: 选目标词 → 取上下文 → generateChapter → 写 chapter + 更新 synopsis/user_word。
 */
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const secret = req.headers.get('x-generate-secret');
  if (!process.env.GENERATE_SECRET || secret !== process.env.GENERATE_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
