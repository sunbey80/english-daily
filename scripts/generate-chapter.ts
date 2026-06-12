/**
 * 端到端跑一遍生成管线（§4），生成第一章并打印校验报告。
 * 仅生成 + 打印，不写库——先人工确认内容质量与覆盖率达标，再决定落库。
 *
 * 用法： tsx --env-file=.env.local scripts/generate-chapter.ts
 */
import { loadCet4Lemmas } from '../lib/vocab';
import { generateChapter } from '../lib/generate';
import { createServiceClient } from '../lib/supabase';

const SAVE = process.argv.includes('--save');
const STORY_TITLE = 'The Bookshop by the Tide';

// ── 第一条四级故事线设定（草稿，可改）─────────────────────
const STORY_SYNOPSIS = `A quiet, warm serialized mystery set in a small seaside town.
Mia, a shy college graduate, takes a summer job at an old secondhand bookshop run by elderly Mrs. Lin.
On her first day Mia finds a handwritten note hidden inside a used book, signed only "R".
More notes are tucked between the pages of books all over the shop, each one a small clue about two people and a promise made long ago.
Mia decides to follow the trail of notes. Tone: gentle, curious, a little lonely, with a soft hook at the end of each chapter.`;

const PREV_SUMMARY = '（这是第 1 节，没有上一节。）Mia 第一天来到海边的旧书店报到。';

// 第一章目标词（均在四级之上，本章要"教"的新词）
const TARGET_WORDS = ['dusty', 'attic', 'scribble', 'murmur', 'crooked'];

async function main() {
  const allowed = loadCet4Lemmas();
  console.log(`允许词表：四级 ${allowed.size} 词 + 目标词 ${TARGET_WORDS.length} 个`);
  console.log(`目标词：${TARGET_WORDS.join(', ')}\n生成中……\n`);

  const result = await generateChapter({
    storySynopsis: STORY_SYNOPSIS,
    prevSummary: PREV_SUMMARY,
    allowedLemmas: allowed,
    targetWords: TARGET_WORDS,
  });

  const cov = result.coverage;
  console.log('═══════════════ 正文 ═══════════════\n');
  console.log(result.body);
  console.log('\n═══════════════ 校验报告 ═══════════════');
  console.log(`通过：${result.ok ? '✅ 是' : '❌ 否'}   尝试次数：${result.attempts}`);
  console.log(`覆盖率：${(cov.coverage * 100).toFixed(2)}%  (${cov.knownTokens}/${cov.totalTokens})  阈值 98%`);
  console.log('目标词复现：', cov.targetCounts.map((t) => `${t.lemma}×${t.count}`).join('  '), '（要求 2–3）');
  if (cov.outOfVocab.length) {
    console.log(`超纲词（${cov.outOfVocab.length} 个）：`, cov.outOfVocab.slice(0, 30).map((w) => `${w.lemma}×${w.count}`).join('  '));
  } else {
    console.log('超纲词：无');
  }
  // 词数粗估
  const words = result.body.trim().split(/\s+/).length;
  console.log(`正文词数（粗估）：约 ${words} 词`);

  if (!SAVE) {
    console.log('\n（未加 --save，仅预览未写库。加 --save 可在校验通过时落库。）');
    return;
  }
  if (!result.ok) {
    console.log('\n校验未通过，按 §4.3 降级策略不落库。');
    return;
  }
  await persist(result.body, cov.targetCounts);
}

/** 校验通过后落库：upsert 故事线 + 写入第 1 章通用版。 */
async function persist(
  body: string,
  targetCounts: Array<{ lemma: string; count: number }>,
) {
  const supabase = createServiceClient();

  // 1. 故事线（按 title 幂等）
  let storyId: number;
  const { data: existing } = await supabase
    .from('story')
    .select('id')
    .eq('title', STORY_TITLE)
    .maybeSingle();
  if (existing) {
    storyId = existing.id;
  } else {
    const { data, error } = await supabase
      .from('story')
      .insert({ title: STORY_TITLE, level: 'cet4', source: 'original', synopsis: STORY_SYNOPSIS })
      .select('id')
      .single();
    if (error) throw error;
    storyId = data.id;
  }

  // 2. 第 1 章通用版（user_id = null）。已存在则跳过，避免重复。
  const { data: chap } = await supabase
    .from('chapter')
    .select('id')
    .eq('story_id', storyId)
    .eq('seq', 1)
    .is('user_id', null)
    .maybeSingle();
  if (chap) {
    console.log(`\n第 1 章通用版已存在（chapter.id=${chap.id}），跳过写入。`);
    return;
  }

  // publish_at = 当日 08:00 北京时间（= UTC 00:00）
  const today = new Date();
  const publishAt = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 0, 0, 0));

  const { data: inserted, error } = await supabase
    .from('chapter')
    .insert({
      story_id: storyId,
      seq: 1,
      user_id: null,
      body,
      target_words: targetCounts,
      publish_at: publishAt.toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  console.log(`\n✅ 已落库：story.id=${storyId}，chapter.id=${inserted.id}（第 1 章通用版）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
