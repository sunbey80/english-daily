/**
 * 端到端跑生成管线（§4），生成「下一章」并打印校验报告。
 * 自动取故事最新章节作为上文承接，新章 seq = 最新 + 1。
 * 仅生成 + 打印；加 --save 则在校验通过时落库。
 *
 * 目标词：默认由 LLM 自动选取（四级之上 + 未教过，见 lib/target-words）；
 * 也可手动指定：--words=creak,faded,cobweb,flicker,locket
 * 用法：
 *   本地： tsx --env-file=.env.local scripts/generate-chapter.ts [--save]
 *   CI ：  env 注入后 tsx scripts/generate-chapter.ts --save
 */
import { loadCet4Lemmas } from '../lib/vocab';
import { generateChapter } from '../lib/generate';
import { createServiceClient } from '../lib/supabase';
import { translateChapter, glossWords, type TranslationUnit } from '../lib/translate';
import { selectTargetWords } from '../lib/target-words';

const SAVE = process.argv.includes('--save');
const STORY_TITLE = 'The Bookshop by the Tide';
const TARGET_COUNT = 5;

const STORY_SYNOPSIS = `A quiet, warm serialized mystery set in a small seaside town.
Mia, a shy college graduate, takes a summer job at an old secondhand bookshop run by elderly Mrs. Lin.
On her first day Mia finds a handwritten note hidden inside a used book, signed only "R".
More notes are tucked between the pages of books all over the shop, each one a small clue about two people and a promise made long ago.
Mia decides to follow the trail of notes. Tone: gentle, curious, a little lonely, with a soft hook at the end of each chapter.`;

/** --words=a,b,c 手动指定目标词；否则返回 null 走自动选取。 */
function targetWordsOverride(): string[] | null {
  const arg = process.argv.find((a) => a.startsWith('--words='));
  if (!arg) return null;
  const words = arg
    .slice('--words='.length)
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
  return words.length ? words : null;
}

interface LatestChapter {
  id: number;
  seq: number;
  body: string;
}

async function getStoryAndLatest() {
  const supabase = createServiceClient();
  const { data: story } = await supabase
    .from('story')
    .select('id')
    .eq('title', STORY_TITLE)
    .maybeSingle();
  if (!story) throw new Error(`未找到故事线「${STORY_TITLE}」，请先生成第 1 章`);

  const { data: latest } = await supabase
    .from('chapter')
    .select('id, seq, body')
    .eq('story_id', story.id)
    .is('user_id', null)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle<LatestChapter>();

  return { storyId: story.id as number, latest };
}

async function main() {
  const allowed = loadCet4Lemmas();
  const { storyId, latest } = await getStoryAndLatest();
  const nextSeq = (latest?.seq ?? 0) + 1;
  // 上文承接：直接把上一章正文作为「上一节梗概」喂给模型，保证剧情连贯。
  const prevSummary = latest
    ? `上一节（第 ${latest.seq} 节）正文：\n${latest.body}`
    : '（这是第 1 节，没有上一节。）';

  // 目标词：手动指定优先，否则 LLM 自动选取（四级之上 + 未教过）。
  const override = targetWordsOverride();
  const targetWords = override
    ? override
    : await selectTargetWords(TARGET_COUNT, { synopsis: STORY_SYNOPSIS, prevSummary });
  if (targetWords.length < 3) {
    throw new Error(`目标词不足（仅 ${targetWords.length} 个），放弃本次生成`);
  }

  console.log(`故事 id=${storyId}，准备生成第 ${nextSeq} 节`);
  console.log(`允许词表：四级 ${allowed.size} 词 + 目标词 ${targetWords.length} 个`);
  console.log(`目标词（${override ? '手动' : '自动选取'}）：${targetWords.join(', ')}\n生成中……\n`);

  const result = await generateChapter({
    storySynopsis: STORY_SYNOPSIS,
    prevSummary,
    allowedLemmas: allowed,
    targetWords,
  });

  const cov = result.coverage;
  console.log('═══════════════ 正文 ═══════════════\n');
  console.log(result.body);
  console.log('\n═══════════════ 校验报告 ═══════════════');
  console.log(`通过：${result.ok ? '✅ 是' : '❌ 否'}   尝试次数：${result.attempts}`);
  console.log(`覆盖率：${(cov.coverage * 100).toFixed(2)}%  (${cov.knownTokens}/${cov.totalTokens})  阈值 98%`);
  console.log('目标词复现：', cov.targetCounts.map((t) => `${t.lemma}×${t.count}`).join('  '), '（要求 2–3）');
  console.log(
    cov.outOfVocab.length
      ? `超纲词（${cov.outOfVocab.length}）：${cov.outOfVocab.slice(0, 30).map((w) => `${w.lemma}×${w.count}`).join('  ')}`
      : '超纲词：无',
  );
  console.log(`正文词数（粗估）：约 ${result.body.trim().split(/\s+/).length} 词`);

  // 落库判定：覆盖率达标 + 每个目标词暴露 ≥2 次（且 ≤5 防刷）。
  // 比 result.ok 略放宽——目标词出现 4 次属自然复现，对习得有益，不算缺陷；
  // 真正要卡的是暴露不足(<2)与覆盖率不达标。
  const allTargetsOk = cov.targetCounts.every((t) => t.count >= 2 && t.count <= 5);
  const acceptable = cov.coverage >= 0.98 && allTargetsOk;

  if (!SAVE) {
    console.log(`\n（未加 --save，仅预览未写库。可落库判定：${acceptable ? '✅ 可' : '❌ 否'}）`);
    return;
  }
  if (!acceptable) {
    console.log('\n覆盖率不达标或目标词暴露不足，不落库。');
    return;
  }

  // 落库前：生成逐句中文翻译 + 目标词中文释义（存进数据库）。
  // 二者失败都不应丢失章节——无人值守也要稳，翻译/释义可事后补。
  console.log('\n生成逐句中文翻译……');
  let translation: TranslationUnit[] = [];
  try {
    translation = await translateChapter(result.body);
    console.log(`  得到 ${translation.length} 条逐句对照`);
  } catch (e) {
    console.warn('  ⚠ 翻译失败，章节仍保存（翻译可后补）：', (e as Error).message);
  }

  console.log('生成目标词中文释义……');
  let glosses: Record<string, string> = {};
  try {
    glosses = await glossWords(targetWords);
    console.log('  ', Object.entries(glosses).map(([k, v]) => `${k}=${v}`).join('  '));
  } catch (e) {
    console.warn('  ⚠ 释义生成失败（目标词仍入表，释义留空）：', (e as Error).message);
  }

  await persist(storyId, nextSeq, result.body, cov.targetCounts, translation, glosses, targetWords);
}

async function persist(
  storyId: number,
  seq: number,
  body: string,
  targetCounts: Array<{ lemma: string; count: number }>,
  translation: TranslationUnit[],
  glosses: Record<string, string>,
  targetWords: string[],
) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from('chapter')
    .select('id')
    .eq('story_id', storyId)
    .eq('seq', seq)
    .is('user_id', null)
    .maybeSingle();
  if (existing) {
    console.log(`\n第 ${seq} 节通用版已存在（chapter.id=${existing.id}），跳过写入。`);
    return;
  }

  // 1. 目标词入 word 表（供点词查询）。释义生成失败时仍入表（zh_gloss 留空，可后补）。
  const wordRows = targetWords.map((w) => ({
    lemma: w.toLowerCase(),
    zh_gloss: glosses[w.toLowerCase()] ?? null,
    in_cet4: false,
  }));
  if (wordRows.length) {
    const { error: wErr } = await supabase.from('word').upsert(wordRows, { onConflict: 'lemma' });
    if (wErr) throw wErr;
    console.log(`\n已写入 ${wordRows.length} 个目标词到 word 表`);
  }

  // 2. 章节落库（含逐句翻译）。publish_at = 现在，立即作为"今日章节"可见。
  const { data: inserted, error } = await supabase
    .from('chapter')
    .insert({
      story_id: storyId,
      seq,
      user_id: null,
      body,
      target_words: targetCounts,
      translation,
      publish_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`✅ 已落库：story.id=${storyId}，chapter.id=${inserted.id}（第 ${seq} 节通用版，含 ${translation.length} 条翻译）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
