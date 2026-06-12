/**
 * 允许词表加载（生成与校验共用）。
 *
 * MVP 通用版：允许词表 = 四级核心词（data/cet4.json）。
 * 后续个性化版：允许词表 = 用户 user_word 中 state=2（已习得）的 lemma 集合。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface Cet4Entry {
  word: string;
  lemma: string;
  zh_gloss: string;
}

let cet4Cache: Set<string> | null = null;

/** 读取四级词表的 lemma 集合（带进程内缓存）。 */
export function loadCet4Lemmas(): Set<string> {
  if (cet4Cache) return cet4Cache;
  const file = resolve(process.cwd(), 'data/cet4.json');
  const entries: Cet4Entry[] = JSON.parse(readFileSync(file, 'utf8'));
  cet4Cache = new Set(entries.map((e) => e.lemma));
  return cet4Cache;
}
