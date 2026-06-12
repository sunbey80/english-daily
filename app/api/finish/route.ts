/**
 * POST /api/finish —— 入参 {chapter_id}：标记读完，
 * 对本章未被点的目标词触发 FSRS good（隐式熟悉度提升，§6）。
 * TODO: 取本章 target_words，排除本次会话点过的词，对其余 rate(good)。
 */
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ error: 'not_implemented' }, { status: 501 });
}
