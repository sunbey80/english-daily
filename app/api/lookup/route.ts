/**
 * POST /api/lookup —— 入参 {word}：词形还原 → 查 word 表返回释义；
 * 同时把该词在该用户的 user_word 标记为"学习中/不认识"。
 * TODO: 接 FSRS 后，把这里的 due_at 简化逻辑替换为 rate(again)。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { lemmatizeText } from '@/lib/lemmatize';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type LookupWord = {
  id: number;
  lemma: string;
  zh_gloss: string | null;
};

function buildLookupCandidates(input: string) {
  const rawLower = input.toLowerCase();
  const tokens = lemmatizeText(input, { rescue: new Set([rawLower]) });
  const candidates = new Set<string>([rawLower]);

  for (const token of tokens) {
    candidates.add(token.lemma);
    candidates.add(token.rawLower);
  }

  return Array.from(candidates).filter((candidate) => /^[a-z]+(?:-[a-z]+)*$/.test(candidate));
}

function chooseBestWord(words: LookupWord[], candidates: string[]) {
  for (const candidate of candidates) {
    const word = words.find((item) => item.lemma === candidate);
    if (word) {
      return word;
    }
  }

  return null;
}

async function markUserWordLearning(userId: string | null, wordId: number) {
  if (!userId) {
    return false;
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from('user_word').upsert(
    {
      user_id: userId,
      word_id: wordId,
      state: 1,
      last_seen_at: now,
      due_at: now,
    },
    { onConflict: 'user_id,word_id' },
  );

  if (error) {
    // 查词本身不应因画像写入失败而中断；登录/冷启动阶段会补齐 profile。
    console.warn('lookup user_word upsert skipped', error.message);
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const word =
    payload && typeof payload === 'object' && 'word' in payload && typeof payload.word === 'string'
      ? payload.word.trim()
      : '';

  if (!word) {
    return NextResponse.json({ error: 'missing_word' }, { status: 400 });
  }

  const candidates = buildLookupCandidates(word);
  if (candidates.length === 0) {
    return NextResponse.json({ error: 'invalid_word', word }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('word')
    .select('id, lemma, zh_gloss')
    .in('lemma', candidates)
    .returns<LookupWord[]>();

  if (error) {
    console.error('POST /api/lookup failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  const matchedWord = chooseBestWord(data ?? [], candidates);
  if (!matchedWord) {
    return NextResponse.json({ error: 'word_not_found', word, candidates }, { status: 404 });
  }

  const user = await getRequestUser(request);
  const learned = await markUserWordLearning(user?.id ?? null, matchedWord.id);

  return NextResponse.json({
    word,
    lemma: matchedWord.lemma,
    zh_gloss: matchedWord.zh_gloss,
    learned,
  });
}
