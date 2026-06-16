import { createServiceClient } from '@/lib/supabase';
import type { TranslationUnit } from '@/lib/translate';

export type TargetWord = {
  lemma: string;
  count: number;
};

export type TodayChapter = {
  id: number;
  seq: number;
  body: string;
  target_words: TargetWord[];
  translation_units: TranslationUnit[];
};

type ChapterRow = {
  id: number;
  seq: number;
  body: string;
  target_words: unknown;
  translation: unknown;
};

function normalizeTargetWords(value: unknown): TargetWord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is TargetWord =>
        typeof item === 'object' &&
        item !== null &&
        'lemma' in item &&
        'count' in item &&
        typeof item.lemma === 'string' &&
        typeof item.count === 'number',
    )
    .map((item) => ({ lemma: item.lemma, count: item.count }));
}

/** 章节中文逐句对照存于 chapter.translation（jsonb）。这里做形状校验。 */
function normalizeTranslation(value: unknown): TranslationUnit[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is TranslationUnit =>
        typeof item === 'object' &&
        item !== null &&
        'en' in item &&
        'zh' in item &&
        'paragraph' in item &&
        typeof item.en === 'string' &&
        typeof item.zh === 'string' &&
        typeof item.paragraph === 'number',
    )
    .map((item) => ({ en: item.en, zh: item.zh, paragraph: item.paragraph }));
}

function toTodayChapter(row: ChapterRow): TodayChapter {
  return {
    id: row.id,
    seq: row.seq,
    body: row.body,
    target_words: normalizeTargetWords(row.target_words),
    translation_units: normalizeTranslation(row.translation),
  };
}

const CHAPTER_COLUMNS = 'id, seq, body, target_words, translation';

async function getLatestPublishedGenericChapter(nowIso: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('chapter')
    .select(CHAPTER_COLUMNS)
    .is('user_id', null)
    .lte('publish_at', nowIso)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle<ChapterRow>();

  if (error) {
    throw error;
  }

  return data ? toTodayChapter(data) : null;
}

async function getLatestPublishedUserChapter(userId: string, nowIso: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('chapter')
    .select(CHAPTER_COLUMNS)
    .eq('user_id', userId)
    .lte('publish_at', nowIso)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle<ChapterRow>();

  if (error) {
    throw error;
  }

  return data ? toTodayChapter(data) : null;
}

/**
 * 读取当日已发布章节：个性化版优先，无则回退通用版。
 * 当前 MVP 还未接登录，调用方先不传 userId；接 Auth 后在这里复用同一分支。
 */
export async function getTodayChapter(userId?: string | null) {
  const nowIso = new Date().toISOString();

  if (userId) {
    const userChapter = await getLatestPublishedUserChapter(userId, nowIso);
    if (userChapter) {
      return userChapter;
    }
  }

  return getLatestPublishedGenericChapter(nowIso);
}

export type ChapterSummary = {
  id: number;
  seq: number;
  excerpt: string;
  publish_at: string | null;
};

/** 取正文开头一小段作为列表摘要（去掉便条星号与换行）。 */
function makeExcerpt(body: string, max = 90): string {
  const text = body.replace(/[*\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** 全部已发布的通用版章节，按 seq 倒序（最新在前），用于「全部篇章」列表。 */
export async function getPublishedChapters(): Promise<ChapterSummary[]> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('chapter')
    .select('id, seq, body, publish_at')
    .is('user_id', null)
    .lte('publish_at', nowIso)
    .order('seq', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as number,
    seq: r.seq as number,
    excerpt: makeExcerpt(r.body as string),
    publish_at: (r.publish_at as string | null) ?? null,
  }));
}

/** 按 seq 取指定通用版章节（仅已发布），用于历史篇章阅读页。 */
export async function getChapterBySeq(seq: number): Promise<TodayChapter | null> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('chapter')
    .select(CHAPTER_COLUMNS)
    .is('user_id', null)
    .eq('seq', seq)
    .lte('publish_at', nowIso)
    .maybeSingle<ChapterRow>();
  if (error) throw error;
  return data ? toTodayChapter(data) : null;
}
