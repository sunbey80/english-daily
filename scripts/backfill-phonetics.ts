/**
 * 给 word 表中缺 phonetic_us 的词批量回填美式音标（LLM 生成，存库）。
 * 幂等：只处理 phonetic_us 为空的词，可重复运行补齐。
 *
 * 用法： tsx --env-file=.env.local scripts/backfill-phonetics.ts
 */
import { createServiceClient } from '../lib/supabase';
import { phoneticizeWords } from '../lib/translate';

const BATCH = 60; // 每次 LLM 调用处理的词数
const MAX_ROUNDS = 20;

async function main() {
  const supabase = createServiceClient();
  let total = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase
      .from('word')
      .select('lemma')
      .is('phonetic_us', null)
      .limit(1000);
    if (error) throw error;

    const lemmas = (data ?? []).map((r) => r.lemma as string);
    if (lemmas.length === 0) {
      break;
    }
    console.log(`第 ${round + 1} 轮：取到 ${lemmas.length} 个缺音标词`);

    for (let i = 0; i < lemmas.length; i += BATCH) {
      const batch = lemmas.slice(i, i + BATCH);
      let map: Record<string, string> = {};
      try {
        map = await phoneticizeWords(batch);
      } catch (e) {
        console.warn(`  批次 ${i} 生成失败，跳过：`, (e as Error).message);
        continue;
      }
      const rows = batch
        .filter((w) => map[w.toLowerCase()])
        .map((w) => ({ lemma: w.toLowerCase(), phonetic_us: map[w.toLowerCase()] }));
      if (rows.length) {
        const { error: uErr } = await supabase.from('word').upsert(rows, { onConflict: 'lemma' });
        if (uErr) throw uErr;
      }
      total += rows.length;
      console.log(`  批 ${i}-${i + batch.length}：命中 ${rows.length}/${batch.length}，累计 ${total}`);
    }
  }
  console.log(`完成，共回填 ${total} 个音标。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
