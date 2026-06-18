/**
 * 生词闯关组局逻辑（见 doc/生词闯关-H5游戏方案.md）。
 * 题目数据全部来自现有库：user_word(state=1) 到期词 + word 释义/音标 +
 * chapter.translation 原句搜索 + 本地干扰项。**不调用任何 LLM/外部接口**。
 */
import { createServiceClient } from '@/lib/supabase';

export type PlayQuestionType = 'cloze' | 'choice' | 'listen';

export interface PlayQuestion {
  word_id: number;
  lemma: string;
  zh_gloss: string | null;
  phonetic_us: string | null;
  type: PlayQuestionType;
  /** cloze：挖空后的英文原句 + 整句中文 */
  sentence?: { en: string; zh: string };
  /** cloze：首字母提示（其余以下划线表示，由前端按 answer 长度渲染） */
  hint?: string;
  /** choice / listen：4 个英文选项（含正确项），已打乱 */
  options?: string[];
  /** 正确答案（小写）。本游戏为自学性质，由前端本地判分，故可下发。 */
  answer: string;
}

type WordRow = {
  id: number;
  lemma: string;
  zh_gloss: string | null;
  phonetic_us: string | null;
};

type Unit = { en: string; zh: string };

// 规则法识别"原句里该词的实际词形"：先精确匹配 lemma，再尝试常见屈折后缀。
// 命中即把这个真实词形作为填空答案（用户拼出的就是句子里出现的形态）。
const INFLECTION_SUFFIXES = ['', 's', 'es', 'ed', 'd', 'ing', 'ly', 'er', 'est', 'ies', 'ied', "'s"];

function findSurfaceForm(en: string, lemma: string): string | null {
  const tokens = en.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
  const lo = lemma.toLowerCase();

  for (const tok of tokens) {
    if (tok.toLowerCase() === lo) {
      return tok;
    }
  }
  for (const tok of tokens) {
    const t = tok.toLowerCase();
    if (t.startsWith(lo)) {
      const suffix = t.slice(lo.length);
      if (INFLECTION_SUFFIXES.includes(suffix)) {
        return tok;
      }
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 在所有原句里找包含该词的最短句子（越短越好出题），返回真实词形。 */
function findContext(units: Unit[], lemma: string): (Unit & { surface: string }) | null {
  let best: (Unit & { surface: string }) | null = null;
  for (const unit of units) {
    const surface = findSurfaceForm(unit.en, lemma);
    if (surface && (!best || unit.en.length < best.en.length)) {
      best = { en: unit.en, zh: unit.zh, surface };
    }
  }
  return best;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickOptions(answerLemma: string, pool: string[]): string[] {
  const others = shuffle(pool.filter((l) => l.toLowerCase() !== answerLemma.toLowerCase()));
  return shuffle([answerLemma, ...others.slice(0, 3)]);
}

function makeCloze(word: WordRow, ctx: Unit & { surface: string }): PlayQuestion {
  const masked = ctx.en.replace(new RegExp(`\\b${escapeRegExp(ctx.surface)}\\b`), '____');
  return {
    word_id: word.id,
    lemma: word.lemma,
    zh_gloss: word.zh_gloss,
    phonetic_us: word.phonetic_us,
    type: 'cloze',
    sentence: { en: masked, zh: ctx.zh },
    hint: ctx.surface[0],
    answer: ctx.surface.toLowerCase(),
  };
}

function makeOptionQuestion(
  word: WordRow,
  type: 'choice' | 'listen',
  pool: string[],
): PlayQuestion {
  return {
    word_id: word.id,
    lemma: word.lemma,
    zh_gloss: word.zh_gloss,
    phonetic_us: word.phonetic_us,
    type,
    options: pickOptions(word.lemma, pool),
    answer: word.lemma.toLowerCase(),
  };
}

/**
 * 组一局题：取到期/学习中的词，能找到原句的出"情境填空"，
 * 否则出"看中选英"（有释义）或"听音抓词"（兜底），交替制造听力题。
 */
export async function buildPlaySession(userId: string, limit = 10): Promise<PlayQuestion[]> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  // 学习中的词，优先到期早的；多取一些，后面挑能出题的。
  const { data: userWords, error: uwError } = await supabase
    .from('user_word')
    .select('word_id, due_at')
    .eq('user_id', userId)
    .eq('state', 1)
    .order('due_at', { ascending: true, nullsFirst: true })
    .limit(limit * 3)
    .returns<{ word_id: number; due_at: string | null }[]>();
  if (uwError) {
    throw uwError;
  }
  if (!userWords || userWords.length === 0) {
    return [];
  }

  const wordIds = userWords.map((w) => w.word_id);
  const { data: words, error: wError } = await supabase
    .from('word')
    .select('id, lemma, zh_gloss, phonetic_us')
    .in('id', wordIds)
    .returns<WordRow[]>();
  if (wError) {
    throw wError;
  }
  const wordById = new Map((words ?? []).map((w) => [w.id, w]));

  // 干扰项词池（有中文释义的词）。
  const { data: pool } = await supabase
    .from('word')
    .select('lemma')
    .not('zh_gloss', 'is', null)
    .limit(400)
    .returns<{ lemma: string }[]>();
  const poolLemmas = [...new Set((pool ?? []).map((w) => w.lemma))];

  // 原句池：所有已发布通用章节的逐句翻译。
  const { data: chapters } = await supabase
    .from('chapter')
    .select('translation')
    .is('user_id', null)
    .lte('publish_at', nowIso)
    .returns<{ translation: unknown }[]>();
  const units: Unit[] = [];
  for (const ch of chapters ?? []) {
    if (Array.isArray(ch.translation)) {
      for (const u of ch.translation) {
        if (u && typeof u === 'object' && typeof (u as Unit).en === 'string' && typeof (u as Unit).zh === 'string') {
          units.push({ en: (u as Unit).en, zh: (u as Unit).zh });
        }
      }
    }
  }

  const questions: PlayQuestion[] = [];
  let optionTypeFlip = 0;
  for (const uw of userWords) {
    if (questions.length >= limit) {
      break;
    }
    const word = wordById.get(uw.word_id);
    if (!word) {
      continue;
    }

    const ctx = findContext(units, word.lemma);
    if (ctx) {
      questions.push(makeCloze(word, ctx));
      continue;
    }

    // 没原句：有释义→看中选英 / 听音抓词交替；都没有→只能听音。
    const canChoice = Boolean(word.zh_gloss);
    const type: 'choice' | 'listen' = canChoice && optionTypeFlip % 2 === 0 ? 'choice' : 'listen';
    optionTypeFlip += 1;
    if (poolLemmas.length < 4) {
      continue; // 词池不足，无法生成 4 选项
    }
    questions.push(makeOptionQuestion(word, type, poolLemmas));
  }

  return questions;
}
