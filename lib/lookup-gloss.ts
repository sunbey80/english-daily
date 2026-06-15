/**
 * MVP 临时释义兜底：当前章节目标词可能不在四级词表 word 表中。
 * 后续应替换为正式词库/词典接口，这里先保证“能查 + 能收录”。
 */
const FALLBACK_GLOSS: Record<string, string> = {
  attic: 'n. 阁楼',
  crooked: 'adj. 弯曲的；歪斜的',
  dusty: 'adj. 布满灰尘的',
  murmur: 'n./v. 低语；咕哝',
  scribble: 'n./v. 潦草的字迹；乱写',
};

export function getFallbackGloss(candidates: string[]) {
  for (const lemma of candidates) {
    const zhGloss = FALLBACK_GLOSS[lemma];
    if (zhGloss) {
      return { lemma, zh_gloss: zhGloss };
    }
  }

  return null;
}
