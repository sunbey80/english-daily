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
import { translateChapter, glossWords, phoneticizeWords, type TranslationUnit } from '../lib/translate';
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

  // 落库判定 + 「孤儿词容错」：覆盖率达标 + 目标词暴露落在 [2,5]。
  // 比 result.ok 略放宽——目标词出现 4 次属自然复现，对习得有益，不算缺陷。
  // 容错：个别目标词重试多次仍无法自然写入（count<2，多为 0），不应废掉整章——
  //   丢弃这些「孤儿词」，用其余目标词落库，前提是：① 仍有 ≥3 个达标目标词；
  //   ② 把孤儿词计为超纲后重算覆盖率仍达标。过度复现(>5)不在容错之列（仍作废）。
  const MIN_RECUR = 2;
  const MAX_RECUR = 5;
  const MIN_KEPT_TARGETS = 3;

  const overExposed = cov.targetCounts.filter((t) => t.count > MAX_RECUR);
  const keptTargets = cov.targetCounts.filter((t) => t.count >= MIN_RECUR && t.count <= MAX_RECUR);
  const droppedTargets = cov.targetCounts.filter((t) => t.count < MIN_RECUR);

  // 丢词后覆盖率重算：被丢的孤儿词若出现过，其 token 由「已知」转为「超纲」。
  const droppedAppearances = droppedTargets.reduce((s, t) => s + t.count, 0);
  const adjustedCoverage =
    cov.totalTokens === 0 ? 0 : (cov.knownTokens - droppedAppearances) / cov.totalTokens;

  const acceptable =
    overExposed.length === 0 && keptTargets.length >= MIN_KEPT_TARGETS && adjustedCoverage >= 0.98;

  if (!SAVE) {
    console.log(`\n（未加 --save，仅预览未写库。可落库判定：${acceptable ? '✅ 可' : '❌ 否'}）`);
    return;
  }
  if (!acceptable) {
    const why =
      overExposed.length > 0
        ? `目标词过度复现：${overExposed.map((t) => `${t.lemma}×${t.count}`).join(' ')}`
        : keptTargets.length < MIN_KEPT_TARGETS
          ? `达标目标词不足 ${MIN_KEPT_TARGETS} 个（仅 ${keptTargets.length} 个）`
          : `丢词后覆盖率 ${(adjustedCoverage * 100).toFixed(2)}% 仍不达标`;
    console.log(`\n不落库：${why}。`);
    return;
  }

  // 落库用「保留下来的目标词」：丢掉的孤儿词不入 word 表、不计入 chapter.target_words，
  // 避免被误标为「已教过」而污染后续自动选词。
  const keptLemmas = keptTargets.map((t) => t.lemma);
  if (droppedTargets.length > 0) {
    console.log(
      `\n⚠ 丢弃无法自然写入的目标词：${droppedTargets.map((t) => `${t.lemma}×${t.count}`).join(' ')}` +
        `（保留 ${keptLemmas.join(', ')}，丢词后覆盖率 ${(adjustedCoverage * 100).toFixed(2)}%）`,
    );
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
    glosses = await glossWords(keptLemmas);
    console.log('  ', Object.entries(glosses).map(([k, v]) => `${k}=${v}`).join('  '));
  } catch (e) {
    console.warn('  ⚠ 释义生成失败（目标词仍入表，释义留空）：', (e as Error).message);
  }

  console.log('生成目标词美式音标……');
  let phonetics: Record<string, string> = {};
  try {
    phonetics = await phoneticizeWords(keptLemmas);
    console.log('  ', Object.entries(phonetics).map(([k, v]) => `${k}=${v}`).join('  '));
  } catch (e) {
    console.warn('  ⚠ 音标生成失败（留空，可后补）：', (e as Error).message);
  }

  await persist(storyId, nextSeq, result.body, keptTargets, translation, glosses, phonetics, keptLemmas);
}

async function persist(
  storyId: number,
  seq: number,
  body: string,
  targetCounts: Array<{ lemma: string; count: number }>,
  translation: TranslationUnit[],
  glosses: Record<string, string>,
  phonetics: Record<string, string>,
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

  // 1. 目标词入 word 表（供点词查询）。释义/音标失败时仍入表（对应字段留空，可后补）。
  const wordRows = targetWords.map((w) => ({
    lemma: w.toLowerCase(),
    zh_gloss: glosses[w.toLowerCase()] ?? null,
    phonetic_us: phonetics[w.toLowerCase()] ?? null,
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
