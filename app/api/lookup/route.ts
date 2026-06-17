/**
 * POST /api/lookup —— 入参 {word}：词形还原 → 查 word 表返回释义；
 * 可选 save=true 时，把该词在当前用户的 user_word 标记为"学习中/不认识"。
 * TODO: 接 FSRS 后，把这里的 due_at 简化逻辑替换为 rate(again)。
 */
import { type NextRequest, NextResponse } from 'next/server';

import { getRequestUser } from '@/lib/auth';
import { defineWord } from '@/lib/llm-define';
import { lookupCandidates } from '@/lib/lookup-lemma';
import { getUsPhonetic } from '@/lib/phonetic';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type LookupWord = {
  id: number;
  lemma: string;
  zh_gloss: string | null;
  phonetic_us: string | null;
};

// 注：单词查询用轻量的 lookupCandidates（无 wink 依赖），
// 避免把 13MB 的 wink-lexicon 打进 Worker。详见 lib/lookup-lemma.ts。
function buildLookupCandidates(input: string) {
  return lookupCandidates(input);
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

/** 该词是否已在当前用户的生词本（user_word 存在该行）。 */
async function isInNotebook(userId: string | null, wordId: number): Promise<boolean> {
  if (!userId) {
    return false;
  }
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('user_word')
    .select('word_id')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .maybeSingle();
  return Boolean(data);
}

// 库里没有的词：用 LLM 现生成释义+音标，写入 word 表缓存后返回。
async function createFallbackWord(candidates: string[]) {
  const target = candidates[0]; // 点击词的小写原形
  if (!target) {
    return null;
  }
  const def = await defineWord(target);
  if (!def) {
    return null;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('word')
    .upsert(
      {
        lemma: target,
        zh_gloss: def.zh_gloss,
        phonetic_us: def.phonetic_us,
      },
      { onConflict: 'lemma', ignoreDuplicates: false },
    )
    .select('id, lemma, zh_gloss, phonetic_us')
    .single<LookupWord>();

  if (error) {
    throw error;
  }

  return data;
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
  const save =
    payload && typeof payload === 'object' && 'save' in payload && payload.save === true;

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
    .select('id, lemma, zh_gloss, phonetic_us')
    .in('lemma', candidates)
    .returns<LookupWord[]>();

  if (error) {
    console.error('POST /api/lookup failed', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }

  let matchedWord = chooseBestWord(data ?? [], candidates);
  if (!matchedWord) {
    try {
      matchedWord = await createFallbackWord(candidates);
    } catch (createError) {
      console.error('POST /api/lookup fallback insert failed', createError);
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }
  }

  if (!matchedWord) {
    return NextResponse.json({ error: 'word_not_found', word, candidates }, { status: 404 });
  }

  const user = await getRequestUser(request);
  // save=true：写入并返回 true；save=false：返回该词是否已在生词本。
  const saved = save
    ? await markUserWordLearning(user?.id ?? null, matchedWord.id)
    : await isInNotebook(user?.id ?? null, matchedWord.id);
  // 优先用库里存的美式音标（LLM 生成的词典风格）；缺失才回退第三方接口。
  const phoneticUs =
    matchedWord.phonetic_us ?? (await getUsPhonetic([...candidates, matchedWord.lemma]));

  return NextResponse.json({
    word,
    lemma: matchedWord.lemma,
    zh_gloss: matchedWord.zh_gloss,
    phonetic_us: phoneticUs,
    authenticated: Boolean(user),
    saved,
  });
}
