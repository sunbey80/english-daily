import { createServiceClient } from '@/lib/supabase';

export type TargetWord = {
  lemma: string;
  count: number;
};

export type TodayChapter = {
  id: number;
  seq: number;
  body: string;
  target_words: TargetWord[];
};

type ChapterRow = {
  id: number;
  seq: number;
  body: string;
  target_words: unknown;
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

function toTodayChapter(row: ChapterRow): TodayChapter {
  return {
    id: row.id,
    seq: row.seq,
    body: row.body,
    target_words: normalizeTargetWords(row.target_words),
  };
}

async function getLatestPublishedGenericChapter(nowIso: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('chapter')
    .select('id, seq, body, target_words')
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
    .select('id, seq, body, target_words')
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
