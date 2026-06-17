/**
 * 一次性归一 word.phonetic_us 的音标写法，统一为词典学习版常规符号。
 * 规则（可扩展）：ɹ→r，ɛ→e。幂等，可重复运行。
 *
 * 用法： tsx --env-file=.env.local scripts/normalize-phonetics.ts
 */
import { createServiceClient } from '../lib/supabase';

// 窄式 IPA → 词典常规写法 的替换规则。
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/ɹ/g, 'r'], // 卷舌近音 → r
  [/ɛ/g, 'e'], // DRESS 元音 → e
];

function normalize(phonetic: string): string {
  let out = phonetic;
  for (const [re, to] of REPLACEMENTS) {
    out = out.replace(re, to);
  }
  return out;
}

async function main() {
  const supabase = createServiceClient();
  const PAGE = 1000;
  let from = 0;
  let changed = 0;
  let scanned = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('word')
      .select('lemma, phonetic_us')
      .not('phonetic_us', 'is', null)
      .order('lemma')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) break;
    scanned += rows.length;

    const updates = rows
      .map((r) => ({ lemma: r.lemma as string, phonetic_us: normalize(r.phonetic_us as string) }))
      .filter((r, i) => r.phonetic_us !== (rows[i].phonetic_us as string));

    if (updates.length) {
      const { error: uErr } = await supabase.from('word').upsert(updates, { onConflict: 'lemma' });
      if (uErr) throw uErr;
      changed += updates.length;
    }
    console.log(`扫描 ${scanned}，本页改写 ${updates.length}，累计改写 ${changed}`);

    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`完成。共扫描 ${scanned}，改写 ${changed}。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
