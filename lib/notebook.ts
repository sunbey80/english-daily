import { createServiceClient } from '@/lib/supabase';

export type NotebookItem = {
  word_id: number;
  lemma: string;
  zh_gloss: string | null;
  state: number;
  exposures: number;
  last_seen_at: string | null;
  due_at: string | null;
  source_chapter: { id: number; seq: number } | null;
};

type UserWordRow = {
  word_id: number;
  state: number;
  exposures: number;
  last_seen_at: string | null;
  due_at: string | null;
};

type WordRow = {
  id: number;
  lemma: string;
  zh_gloss: string | null;
};

export async function getNotebookItems(userId: string | null) {
  if (!userId) {
    return [];
  }

  const supabase = createServiceClient();
  const { data: userWords, error: userWordsError } = await supabase
    .from('user_word')
    .select('word_id, state, exposures, last_seen_at, due_at')
    .eq('user_id', userId)
    .eq('state', 1)
    .order('last_seen_at', { ascending: false, nullsFirst: false })
    .returns<UserWordRow[]>();

  if (userWordsError) {
    throw userWordsError;
  }

  if (!userWords || userWords.length === 0) {
    return [];
  }

  const wordIds = userWords.map((item) => item.word_id);
  const { data: words, error: wordsError } = await supabase
    .from('word')
    .select('id, lemma, zh_gloss')
    .in('id', wordIds)
    .returns<WordRow[]>();

  if (wordsError) {
    throw wordsError;
  }

  const wordsById = new Map((words ?? []).map((word) => [word.id, word]));

  return userWords
    .map<NotebookItem | null>((item) => {
      const word = wordsById.get(item.word_id);
      if (!word) {
        return null;
      }

      return {
        word_id: item.word_id,
        lemma: word.lemma,
        zh_gloss: word.zh_gloss,
        state: item.state,
        exposures: item.exposures,
        last_seen_at: item.last_seen_at,
        due_at: item.due_at,
        // 当前 schema 尚未记录“点词来自哪一章”，先保留字段，后续加事件表或关联表再回填。
        source_chapter: null,
      };
    })
    .filter((item): item is NotebookItem => item !== null);
}
