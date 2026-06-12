/**
 * 词形还原（§3.3）—— 决定词表准确性，是整个画像的地基。
 *
 * 流程：分词 → 词性标注(POS) → 按词性还原 → 过滤专名/数字/非词。
 * run / ran / running / runs 必须归并为 lemma = "run"，否则同一个词
 * 会被当成多个词反复"教"，画像直接报废。
 *
 * 依赖：
 *   - wink-pos-tagger  分词 + Penn Treebank 词性标注
 *   - wink-lemmatizer  按词性还原（名词/动词/形容词）
 */
// @ts-ignore -- 这两个库无类型声明
import posTagger from 'wink-pos-tagger';
// @ts-ignore
import lemmatizer from 'wink-lemmatizer';

const tagger = posTagger();

export interface LemmaToken {
  raw: string; // 原始 token
  rawLower: string; // 原始 token 的小写形（用于兜底匹配过度还原的词，如 crooked）
  lemma: string; // 还原后的原形（小写）
  pos: string; // Penn Treebank 词性
}

export interface LemmatizeOptions {
  /** 已知/目标词小写集合：用于把误判为专名的大写普通词救回（见 isContentWord）。 */
  rescue?: Set<string>;
}

/**
 * 是否为内容词（计入词表）。过滤专名、数字、标点、符号、非纯字母词。
 * rescue：已知/目标词的小写集合。POS 标注器会把句首或标牌中大写的普通词
 * （如标牌 "Attic"）误判为专名 NNP；若其小写形在 rescue 中，则救回当普通词，
 * 避免目标词/已知词被漏计。真正的人名地名（不在 rescue 中）仍被过滤。
 */
function isContentWord(value: string, pos: string, rescue?: Set<string>): boolean {
  // 仅保留纯字母（含连字符内的字母），过滤标点/符号/含数字的 token
  if (!/^[a-zA-Z]+(?:-[a-zA-Z]+)*$/.test(value)) return false;
  // 基数词/数字不计入
  if (pos === 'CD') return false;
  // 专有名词不计入（人名地名等），除非其小写形是已知/目标词
  if (pos === 'NNP' || pos === 'NNPS') {
    return rescue?.has(value.toLowerCase()) ?? false;
  }
  return true;
}

/** 把 Penn 词性映射到 wink-lemmatizer 的还原类别并还原。 */
function lemmatizeByPos(word: string, pos: string): string {
  const w = word.toLowerCase();
  if (pos.startsWith('VB')) return lemmatizer.verb(w); // 动词
  if (pos.startsWith('NN')) return lemmatizer.noun(w); // 名词（普通名词，专名已被过滤）
  if (pos.startsWith('JJ')) return lemmatizer.adjective(w); // 形容词
  // 副词及其它词性 wink-lemmatizer 不处理，保留小写原形
  return w;
}

/**
 * 对整段文本做词形还原，返回内容词的 LemmaToken 列表（已过滤专名/数字/非词）。
 */
export function lemmatizeText(text: string, opts: LemmatizeOptions = {}): LemmaToken[] {
  const tagged = tagger.tagSentence(text) as Array<{
    value: string;
    pos: string;
  }>;
  const out: LemmaToken[] = [];
  for (const t of tagged) {
    if (!isContentWord(t.value, t.pos, opts.rescue)) continue;
    out.push({
      raw: t.value,
      rawLower: t.value.toLowerCase(),
      lemma: lemmatizeByPos(t.value, t.pos),
      pos: t.pos,
    });
  }
  return out;
}

/**
 * 统计每个 lemma 出现次数（覆盖率与复现校验的基础数据）。
 */
export function countLemmas(text: string, opts: LemmatizeOptions = {}): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { lemma } of lemmatizeText(text, opts)) {
    counts.set(lemma, (counts.get(lemma) ?? 0) + 1);
  }
  return counts;
}

/** 文本中去重后的 lemma 集合。 */
export function uniqueLemmas(text: string): Set<string> {
  return new Set(countLemmas(text).keys());
}
