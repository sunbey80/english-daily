/**
 * POST /api/play/answer —— 入参 {word_id, correct}：把一次答题作为复习事件
 * 喂给 FSRS（rate），回写 user_word，使游戏与阅读共用同一份词汇画像。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { initState, rate, type SrsState } from '@/lib/fsrs';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type UserWordRow = {
  state: number;
  exposures: number;
  stability: number;
  difficulty: number;
  due_at: string | null;
  last_seen_at: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const wordId =
      payload && typeof payload === 'object' && 'word_id' in payload && typeof payload.word_id === 'number'
        ? payload.word_id
        : null;
    const correct =
      payload && typeof payload === 'object' && 'correct' in payload && typeof payload.correct === 'boolean'
        ? payload.correct
        : null;

    if (wordId === null || correct === null) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: row } = await supabase
      .from('user_word')
      .select('state, exposures, stability, difficulty, due_at, last_seen_at')
      .eq('user_id', user.id)
      .eq('word_id', wordId)
      .maybeSingle<UserWordRow>();

    const prev: SrsState = row
      ? {
          state: row.state,
          exposures: row.exposures,
          stability: row.stability,
          difficulty: row.difficulty,
          due_at: row.due_at,
          last_seen_at: row.last_seen_at,
        }
      : initState();

    const next = rate(prev, correct ? 'good' : 'again');

    const { error } = await supabase.from('user_word').upsert(
      {
        user_id: user.id,
        word_id: wordId,
        state: next.state,
        exposures: next.exposures,
        stability: next.stability,
        difficulty: next.difficulty,
        due_at: next.due_at,
        last_seen_at: next.last_seen_at,
      },
      { onConflict: 'user_id,word_id' },
    );

    if (error) {
      console.error('POST /api/play/answer upsert failed', error);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, state: next.state });
  } catch (error) {
    console.error('POST /api/play/answer failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
