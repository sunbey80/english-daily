/**
 * POST /api/lookup —— 入参 {word}：词形还原 → 查 word 表返回释义；
 * 同时把该词在该用户的 user_word 标记为"学习中/不认识"，触发 FSRS again（§6）。
 * TODO: 接 lemmatize + word 查询 + user_word upsert(rate(again))。
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
