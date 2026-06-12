/**
 * 覆盖率 + 目标词复现校验（§4.2 第 4 步）。
 *
 * 生成管线绝不信模型自报，必须程序化校验：
 *   a. 词形还原全文 → 统计每个词
 *   b. 已知词覆盖率 = known_tokens / total_tokens，要求 ≥ 98%
 *   c. 每个 target_word 复现次数须落在 [minRecur, maxRecur]（默认 2–3）
 */
import { lemmatizeText } from './lemmatize';

export interface CoverageOptions {
  /** 已知词覆盖率阈值，默认 0.98（i+1 原则） */
  minCoverage?: number;
  /** 目标词最少复现次数，默认 2 */
  minRecur?: number;
  /** 目标词最多复现次数，默认 3 */
  maxRecur?: number;
}

export interface CoverageResult {
  passed: boolean;
  coverage: number; // 已知词覆盖率
  totalTokens: number; // 内容词总数（按出现次数）
  knownTokens: number; // 落在允许词表内的词数
  /** 超纲词（既不在允许词表、也不是目标词）及其出现次数 */
  outOfVocab: Array<{ lemma: string; count: number }>;
  /** 每个目标词的实际复现次数 */
  targetCounts: Array<{ lemma: string; count: number }>;
  /** 复现次数不达标的目标词（含缺漏说明，用于反馈模型改写） */
  targetIssues: Array<{ lemma: string; count: number; expected: string }>;
}

/**
 * @param text         模型生成的正文
 * @param allowedLemmas 允许词表（已知词，如四级核心词 + 用户已习得词），lemma 集合
 * @param targetWords  本章目标词 lemma 列表（这些词允许出现且要求复现）
 */
export function checkCoverage(
  text: string,
  allowedLemmas: Set<string>,
  targetWords: string[],
  opts: CoverageOptions = {},
): CoverageResult {
  const minCoverage = opts.minCoverage ?? 0.98;
  const minRecur = opts.minRecur ?? 2;
  const maxRecur = opts.maxRecur ?? 3;

  const targetSet = new Set(targetWords.map((w) => w.toLowerCase()));
  // rescue：把误判为专名、但其实是已知/目标词的大写词（如标牌 "Attic"）救回。
  const rescue = new Set<string>([...allowedLemmas, ...targetSet]);
  const tokens = lemmatizeText(text, { rescue });

  // 某 token 是否命中给定词集：lemma 或 原形小写 任一匹配即可。
  // 兜底原形小写，是为了应对 wink-lemmatizer 过度还原（如 crooked→crook），
  // 此时原形 "crooked" 仍能与允许词表/目标词对齐。
  const hits = (set: Set<string>, lemma: string, rawLower: string) =>
    set.has(lemma) || set.has(rawLower);

  let totalTokens = 0;
  let knownTokens = 0;
  const outOfVocabMap = new Map<string, number>();
  const targetCountMap = new Map<string, number>();

  for (const { lemma, rawLower } of tokens) {
    totalTokens += 1;
    if (hits(targetSet, lemma, rawLower) || hits(allowedLemmas, lemma, rawLower)) {
      knownTokens += 1;
    } else {
      outOfVocabMap.set(lemma, (outOfVocabMap.get(lemma) ?? 0) + 1);
    }
    // 目标词复现计数：命中哪个目标词就给哪个 +1
    if (targetSet.has(lemma)) targetCountMap.set(lemma, (targetCountMap.get(lemma) ?? 0) + 1);
    else if (targetSet.has(rawLower)) targetCountMap.set(rawLower, (targetCountMap.get(rawLower) ?? 0) + 1);
  }

  const coverage = totalTokens === 0 ? 0 : knownTokens / totalTokens;

  const targetCounts = targetWords.map((w) => ({
    lemma: w.toLowerCase(),
    count: targetCountMap.get(w.toLowerCase()) ?? 0,
  }));

  const targetIssues = targetCounts
    .filter((t) => t.count < minRecur || t.count > maxRecur)
    .map((t) => ({
      lemma: t.lemma,
      count: t.count,
      expected: `${minRecur}-${maxRecur}`,
    }));

  const outOfVocab = [...outOfVocabMap.entries()]
    .map(([lemma, count]) => ({ lemma, count }))
    .sort((a, b) => b.count - a.count);

  const passed = coverage >= minCoverage && targetIssues.length === 0;

  return {
    passed,
    coverage,
    totalTokens,
    knownTokens,
    outOfVocab,
    targetCounts,
    targetIssues,
  };
}
